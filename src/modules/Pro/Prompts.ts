/**
 * Custom Prompts System
 * 
 * Supports multiple prompt types with different input sources:
 * - selectedText     : Currently selected PDF text
 * - pageText         : Current page full text
 * - pagesText        : Specified page range text
 * - fulltext         : Full PDF text
 * - clipboard        : Clipboard content
 * - noteText         : Selected note content
 * - abstractPagesText: First two pages text
 * 
 * Users can add custom prompts in settings with name, type, and prompt text.
 */

import { config } from "../../../package.json";
import { isPro, getLicenseInfo } from "../../validation/core";
import Meet from "../Meet/api";

export type PromptType =
  | "selectedText"
  | "pageText"
  | "pagesText"
  | "fulltext"
  | "clipboard"
  | "noteText"
  | "abstractPagesText";

export interface PromptDefinition {
  id: string;
  name: string;
  type: PromptType;
  prompt: string;
  icon?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromptRunResult {
  success: boolean;
  text?: string;
  error?: string;
  inputContent?: string;
}

const PROMPT_PREF_KEY = `${config.addonRef}.proPrompts`;

const DEFAULT_PROMPTS: PromptDefinition[] = [
  {
    id: "translate-selected",
    name: "翻译选中",
    type: "selectedText",
    prompt: "Translate the following text to 简体中文:\n\n{{input}}",
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "explain-selected",
    name: "解释选中",
    type: "selectedText",
    prompt: "Explain the following academic text in simple terms in 简体中文:\n\n{{input}}",
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "summarize-selected",
    name: "概括选中",
    type: "selectedText",
    prompt: "Summarize the following text in 2-3 sentences in 简体中文:\n\n{{input}}",
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "analyze-page",
    name: "分析当前页",
    type: "pageText",
    prompt: "Analyze the following page content from an academic paper. Explain key concepts and arguments in 简体中文:\n\n{{input}}",
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "question-page",
    name: "针对当前页提问",
    type: "pageText",
    prompt: "Based on the following page content, answer the question. Context:\n\n{{input}}\n\nQuestion: {{query}}",
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "abstract-summary",
    name: "摘要概括",
    type: "abstractPagesText",
    prompt: "Based on the first two pages of this paper, write a brief summary in 简体中文 including:\n1. Research problem\n2. Main approach\n3. Key findings\n\nContent:\n{{input}}",
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "fulltext-summary",
    name: "全文总结",
    type: "fulltext",
    prompt: "Summarize the following paper comprehensively in 简体中文. Include:\n- Research background\n- Methods\n- Key findings\n- Conclusions\n\nContent:\n{{input}}",
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "clipboard-process",
    name: "处理剪贴板",
    type: "clipboard",
    prompt: "Process the following content. {{query}}\n\nContent:\n{{input}}",
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "note-analyze",
    name: "分析笔记",
    type: "noteText",
    prompt: "Analyze the following note content and provide insights in 简体中文:\n\n{{input}}",
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export class PromptsManager {
  private prompts: PromptDefinition[] = [];
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.loadPrompts();
    this.initialized = true;
  }

  /**
   * Load prompts from preferences.
   */
  loadPrompts(): PromptDefinition[] {
    try {
      const stored = Zotero.Prefs.get(PROMPT_PREF_KEY) as string;
      if (stored) {
        this.prompts = JSON.parse(stored);
        // Merge defaults for missing
        for (const dp of DEFAULT_PROMPTS) {
          if (!this.prompts.find((p) => p.id === dp.id)) {
            this.prompts.push({ ...dp });
          }
        }
      } else {
        this.prompts = [...DEFAULT_PROMPTS];
        this.savePrompts();
      }
    } catch (e) {
      this.prompts = [...DEFAULT_PROMPTS];
      this.savePrompts();
    }
    return [...this.prompts];
  }

  /**
   * Save prompts to preferences.
   */
  savePrompts(): void {
    Zotero.Prefs.set(PROMPT_PREF_KEY, JSON.stringify(this.prompts));
  }

  /**
   * Get all prompts.
   */
  getAll(): PromptDefinition[] {
    return [...this.prompts];
  }

  /**
   * Get prompts by type.
   */
  getByType(type: PromptType): PromptDefinition[] {
    return this.prompts.filter((p) => p.type === type && p.enabled);
  }

  /**
   * Get a prompt by id.
   */
  getById(id: string): PromptDefinition | undefined {
    return this.prompts.find((p) => p.id === id);
  }

  /**
   * Add a new prompt.
   */
  add(prompt: Omit<PromptDefinition, "id" | "createdAt" | "updatedAt">): PromptDefinition {
    const now = new Date().toISOString();
    const def: PromptDefinition = {
      ...prompt,
      id: `custom-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    this.prompts.push(def);
    this.savePrompts();
    return def;
  }

  /**
   * Update an existing prompt.
   */
  update(id: string, updates: Partial<Omit<PromptDefinition, "id" | "createdAt">>): PromptDefinition | null {
    const idx = this.prompts.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.prompts[idx] = {
      ...this.prompts[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.savePrompts();
    return this.prompts[idx];
  }

  /**
   * Delete a prompt.
   */
  delete(id: string): boolean {
    const idx = this.prompts.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    // Don't allow deleting defaults
    if (DEFAULT_PROMPTS.find((dp) => dp.id === id)) {
      this.prompts[idx].enabled = false;
      this.savePrompts();
      return true;
    }
    this.prompts.splice(idx, 1);
    this.savePrompts();
    return true;
  }

  /**
   * Get input content based on prompt type.
   */
  async getInputContent(type: PromptType, extra?: { pages?: number[]; query?: string }): Promise<string> {
    if (!isPro()) throw new Error("Pro license required");

    switch (type) {
      case "selectedText":
        return Meet.Zotero.getPDFSelection() || "";

      case "pageText":
        return await this.getCurrentPageText();

      case "pagesText":
        return await this.getPagesText(extra?.pages || []);

      case "fulltext":
        return await this.getFullPDFText();

      case "clipboard":
        return Meet.Zotero.getClipboardText() || "";

      case "noteText":
        return await this.getSelectedNoteText();

      case "abstractPagesText":
        return await this.getPagesText([0, 1]);

      default:
        throw new Error(`Unknown prompt type: ${type}`);
    }
  }

  /**
   * Build the final prompt by substituting placeholders.
   */
  buildPrompt(def: PromptDefinition, inputContent: string, query?: string): string {
    let prompt = def.prompt;
    prompt = prompt.replace(/\{\{input\}\}/g, inputContent);
    prompt = prompt.replace(/\{\{query\}\}/g, query || "");
    return prompt;
  }

  /**
   * Execute a prompt and get GPT response.
   */
  async execute(def: PromptDefinition, query?: string): Promise<PromptRunResult> {
    try {
      if (!isPro()) {
        return { success: false, error: "Pro license required for custom prompts." };
      }

      const inputContent = await this.getInputContent(def.type, { query });
      if (!inputContent && def.type !== "clipboard") {
        return { success: false, error: `No content available for type: ${def.type}` };
      }

      const finalPrompt = this.buildPrompt(def, inputContent, query);

      const response = await Meet.OpenAI.getGPTResponse(finalPrompt);
      return {
        success: true,
        text: response,
        inputContent,
      };
    } catch (e: any) {
      return { success: false, error: e.message || "Unknown error" };
    }
  }

  /**
   * Get current PDF page text.
   */
  private async getCurrentPageText(): Promise<string> {
    try {
      const reader = await (ztoolkit as any).Reader.getReader();
      const pageNumber = (reader!._iframeWindow as any).wrappedJSObject
        .PDFViewerApplication.page;
      const pagesText = await this.getPagesText([pageNumber - 1]);
      return pagesText;
    } catch {
      return "";
    }
  }

  /**
   * Get text from specific PDF pages.
   */
  private async getPagesText(pageIndices: number[]): Promise<string> {
    try {
      const reader = await (ztoolkit as any).Reader.getReader();
      const win = (reader!._iframeWindow as any).wrappedJSObject;

      const allTexts: string[] = [];
      const loadPage = (i: number) => {
        return new Promise<string>((resolve) => {
          win.PDFViewerApplication.pdfViewer.pdfDocument.getPage(i + 1).then(
            (page: any) => {
              page.getTextContent().then((textContent: any) => {
                const text = textContent.items
                  .map((item: any) => item.str)
                  .join(" ");
                resolve(text);
              });
            },
            () => resolve("")
          );
        });
      };

      for (const idx of pageIndices) {
        const text = await loadPage(idx);
        allTexts.push(`[Page ${idx + 1}]\n${text}`);
      }

      return allTexts.join("\n\n");
    } catch {
      return "";
    }
  }

  /**
   * Get full PDF text.
   */
  private async getFullPDFText(): Promise<string> {
    try {
      const reader = await (ztoolkit as any).Reader.getReader();
      const win = (reader!._iframeWindow as any).wrappedJSObject;
      const numPages = win.PDFViewerApplication.pagesCount;
      const indices = Array.from({ length: numPages }, (_, i) => i);
      return await this.getPagesText(indices);
    } catch {
      return "";
    }
  }

  /**
   * Get selected note text.
   */
  private async getSelectedNoteText(): Promise<string> {
    try {
      const BNEditorApi = (Zotero as any).BetterNotes?.api?.editor;
      if (!BNEditorApi) return "";
      const editor = BNEditorApi.getEditorInstance(
        (Zotero as any).BetterNotes?.data?.workspace?.mainId
      );
      if (!editor) return "";
      const range = BNEditorApi.getRangeAtCursor(editor);
      return BNEditorApi.getTextBetween(editor, range.from, range.to) || "";
    } catch {
      return "";
    }
  }
}

export default PromptsManager;
