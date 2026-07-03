/**
 * AI Notes Fill Manager
 * 
 * Integrates with BetterNotes to auto-fill note content using AI.
 * 
 * Flow:
 * 1. User selects a BetterNotes template 
 * 2. User selects a prompt of type "noteText"
 * 3. System extracts current note content / PDF context
 * 4. AI generates structured content
 * 5. Content is inserted into the note
 * 
 * Requires: BetterNotes plugin installed.
 */

import { config } from "../../../package.json";
import { isPro, requirePro } from "../../validation/core";
import { PromptsManager, PromptDefinition } from "./Prompts";
import { ReferenceManager, ReferenceMode } from "./Reference";
import Meet from "../Meet/api";

export interface NoteTemplate {
  id: string;
  name: string;
  content: string;       // Template with placeholder sections
  description?: string;
}

const DEFAULT_TEMPLATE: NoteTemplate = {
  id: "default-template",
  name: "文献精读模板",
  description: "包含标题、内容、数据、方法、实验、结论等区块",
  content: `# 文献信息
- **标题**: 
- **作者**: 
- **期刊**: 
- **年份**: 

# 研究背景
> 

# 研究方法
> 

# 实验设计
> 

# 核心数据
> 

# 主要结论
> 

# 关键记录
> 

# 待解决问题
> 

# 灵感与想法
> `,
};

export class NotesFillManager {
  private templates: NoteTemplate[] = [];

  constructor() {
    this.templates = this.loadTemplates();
    if (this.templates.length === 0) {
      this.templates.push(DEFAULT_TEMPLATE);
      this.saveTemplates();
    }
  }

  /**
   * Load templates from preferences.
   */
  private loadTemplates(): NoteTemplate[] {
    try {
      const raw = Zotero.Prefs.get(`${config.addonRef}.proNoteTemplates`) as string;
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  /**
   * Save templates to preferences.
   */
  private saveTemplates(): void {
    Zotero.Prefs.set(`${config.addonRef}.proNoteTemplates`, JSON.stringify(this.templates));
  }

  /**
   * Get all available templates.
   */
  getTemplates(): NoteTemplate[] {
    return [...this.templates];
  }

  /**
   * Add a template.
   */
  addTemplate(template: NoteTemplate): void {
    this.templates.push(template);
    this.saveTemplates();
  }

  /**
   * Remove a template.
   */
  removeTemplate(id: string): void {
    this.templates = this.templates.filter((t) => t.id !== id);
    this.saveTemplates();
  }

  /**
   * Find a prompt for note filling.
   * Returns prompts of type "noteText".
   */
  findFillPrompts(promptsManager: PromptsManager): PromptDefinition[] {
    return promptsManager.getByType("noteText");
  }

  /**
   * Execute AI fill: take template + prompt -> generate content -> insert.
   */
  async fillNote(
    template: NoteTemplate,
    promptDef: PromptDefinition,
    promptsManager: PromptsManager,
    additionalContext?: string
  ): Promise<{ success: boolean; text?: string; error?: string }> {
    requirePro("notesFill");

    // Check BetterNotes availability
    if (!this.isBetterNotesAvailable()) {
      return {
        success: false,
        error: "BetterNotes plugin is required for AI note filling. Please install and restart Zotero.",
      };
    }

    const popupWin = new ztoolkit.ProgressWindow("AI Fill Note", {
      closeTime: -1,
      closeOtherProgressWindows: true,
    }).show();

    try {
      popupWin.createLine({ text: "Gathering context...", type: "default" });

      // Get context from current PDF or selected item
      let context = "";

      // Try PDF context first
      if (Zotero_Tabs.selectedIndex > 0) {
        const reader = await ztoolkit.Reader.getReader();
        if (reader) {
          const pageCount: number = await (reader._iframeWindow as any).wrappedJSObject.eval(
            `PDFViewerApplication.pdfViewer.pagesCount`
          );
          // Get first 3 pages as context
          const texts: string[] = [];
          for (let i = 0; i < Math.min(pageCount, 3); i++) {
            try {
              const text = await (reader._iframeWindow as any).wrappedJSObject.eval(`
                (async () => {
                  const page = await PDFViewerApplication.pdfViewer.pdfDocument.getPage(${i + 1});
                  const textContent = await page.getTextContent();
                  return textContent.items.map(item => item.str).join(" ");
                })();
              `);
              if (text) texts.push(text);
            } catch {}
          }
          context = texts.join("\n\n");
        }
      }

      // Fallback to selected item metadata
      if (!context && ZoteroPane.getSelectedItems().length > 0) {
        const item = ZoteroPane.getSelectedItems()[0];
        const creator = (item as any).getField("firstCreator") || item.getField("title") as string || "";
        const fields = [
          `Title: ${item.getField("title")}`,
          `Authors: ${creator.replace(/\n/g, "; ")}`,
          `Abstract: ${item.getField("abstractNote")}`,
          `Publication: ${item.getField("publicationTitle")}`,
          `Date: ${item.getField("date")}`,
        ];
        context = fields.join("\n");
      }

      if (additionalContext) {
        context += "\n\nAdditional Context:\n" + additionalContext;
      }

      popupWin.createLine({ text: "Generating content...", type: "default" });

      // Build fill prompt
      const fillPrompt = promptDef.prompt
        .replace("{{template}}", template.content)
        .replace("{{input}}", context || "No context available")
        .replace("{{name}}", template.name);

      const fillInstruction = `You are filling an academic note template. 
Below is the paper context and the template. Fill in each section thoroughly in 简体中文.

TEMPLATE:
${template.content}

CONTEXT:
${context}

TASK:
Fill in the template sections above with relevant information from the context. 
Keep the same section headers. Fill in the ">" placeholder areas with substantive content.
If information is not available in the context, write "[待补充]".

Return the COMPLETE filled template in markdown format.`;

      // Call GPT
      const finalPrompt = fillInstruction + "\n\n" + (fillPrompt.includes("{{") ? fillPrompt : "");
      
      const response = await Meet.OpenAI.getGPTResponse(finalPrompt);

      popupWin.createLine({ text: "Inserting into note...", type: "default" });

      // Insert into note
      if (response) {
        try {
          // Convert markdown to HTML for BetterNotes insertion
          const markdown = require("markdown-it")({
            breaks: true,
            xhtmlOut: true,
            html: true,
          });
          const htmlContent = markdown.render(response);
          Meet.BetterNotes.insertEditorText(htmlContent);
        } catch {
          // Fallback: copy to clipboard
          new ztoolkit.Clipboard().addText(response, "text/unicode").copy();
          popupWin.createLine({
            text: "Content copied to clipboard (paste manually)",
            type: "default",
          });
        }
      }

      popupWin.createLine({ text: "Note filled successfully!", type: "success" });
      popupWin.startCloseTimer(3000);

      return { success: true, text: response };

    } catch (e: any) {
      popupWin.createLine({ text: `Error: ${e.message}`, type: "fail" });
      popupWin.startCloseTimer(5000);
      return { success: false, error: e.message };
    }
  }

  /**
   * Check if BetterNotes is available.
   */
  isBetterNotesAvailable(): boolean {
    try {
      return !!(Zotero as any).BetterNotes?.api?.editor;
    } catch {
      return false;
    }
  }
}
