/**
 * AI Outline Manager
 * 
 * Automatically parse PDF structure and generate chapter/topic outline.
 * Requires standalone API configuration (not through linked webpage mode).
 * 
 * Process:
 * 1. Extract page-by-page text from PDF
 * 2. Send to GPT to identify structural elements
 * 3. Display hierarchical outline in sidebar
 * 4. Support click-to-navigate functionality
 */

import { config } from "../../../package.json";
import { requirePro } from "../../validation/core";

export interface OutlineItem {
  level: number;        // 1 = main chapter, 2 = section, 3 = subsection
  title: string;
  page: number;
  pageLabel?: string;
  children?: OutlineItem[];
  summary?: string;     // Brief summary of this section
}

export interface OutlineConfig {
  enabled: boolean;
  maxDepth: number;
  includeSummaries: boolean;
  model?: string;
}

export class OutlineManager {
  private outline: OutlineItem[] | null = null;
  private currentPDFKey: string = "";
  private generating: boolean = false;
  private outlineContainer: HTMLDivElement | null = null;

  /**
   * Generate an outline for the current PDF.
   */
  public async generateOutline(): Promise<OutlineItem[]> {
    requirePro("aiOutline");

    if (this.generating) {
      throw new Error("Outline generation is already in progress.");
    }

    this.generating = true;
    const popupWin = this.showProgress("AI Outline", "Extracting PDF text...");

    try {
      // Get current PDF
      const pdfItem = Zotero.Items.get(
        Zotero.Reader.getByTabID(Zotero_Tabs.selectedID)!.itemID as number
      );

      if (!pdfItem || !pdfItem.isFileAttachment()) {
        throw new Error("Please open a PDF file first.");
      }

      // Check cache
      const cacheKey = pdfItem.key;
      if (this.currentPDFKey === cacheKey && this.outline) {
        this.generating = false;
        popupWin.startCloseTimer(1000);
        return this.outline;
      }

      // Extract text pages
      const reader = await ztoolkit.Reader.getReader();
      if (!reader) throw new Error("Cannot access PDF reader.");

      popupWin.createLine({ text: "Reading PDF pages...", type: "default" });

      const pageTexts: string[] = [];
      const pageCount = await this.getPageCount(reader);

      // Read first N chars from each page (to keep prompt manageable)
      for (let i = 0; i < pageCount; i++) {
        try {
          const text = await this.getPageText(reader, i);
          if (text && text.trim().length > 0) {
            pageTexts.push(`[Page ${i + 1}] ${text.substring(0, 800)}`);
          }
        } catch {
          // Skip pages that can't be read
        }
      }

      popupWin.createLine({ text: `Read ${pageTexts.length} pages. Generating outline...`, type: "default" });

      // Build prompt
      const config = this.getConfig();
      const prompt = this.buildOutlinePrompt(pageTexts, config.maxDepth, config.includeSummaries);
      const model = config.model || Zotero.Prefs.get(`${this.getAddonRef()}.model`) as string;
      const api = Zotero.Prefs.get(`${this.getAddonRef()}.api`) as string;
      const secretKey = Zotero.Prefs.get(`${this.getAddonRef()}.secretKey`) as string;

      if (!secretKey) {
        throw new Error("Please configure your API key in settings first.");
      }

      // Call GPT
      const response = await this.callGPT(prompt, model, api, secretKey);
      
      // Parse response into outline
      this.outline = this.parseOutline(response);
      this.currentPDFKey = cacheKey;

      popupWin.createLine({ text: `Outline generated: ${this.countItems(this.outline)} sections`, type: "success" });
      popupWin.startCloseTimer(3000);

      return this.outline;

    } catch (e: any) {
      popupWin.createLine({ text: `Error: ${e.message || e}`, type: "fail" });
      popupWin.startCloseTimer(5000);
      throw e;
    } finally {
      this.generating = false;
    }
  }

  /**
   * Clear cached outline.
   */
  public clearOutline(): void {
    this.outline = null;
    this.currentPDFKey = "";
  }

  /**
   * Get current outline (from cache).
   */
  public getOutline(): OutlineItem[] | null {
    return this.outline;
  }

  /**
   * Render outline in a container element.
   */
  public renderOutline(container: HTMLDivElement): void {
    if (!this.outline) return;

    this.outlineContainer = container;
    container.innerHTML = "";
    container.style.cssText = `
      max-height: 400px;
      overflow-y: auto;
      font-size: 13px;
      font-family: system-ui, sans-serif;
    `;

    this.renderItems(this.outline, container, 0);
  }

  /**
   * Get outline as plain text (for use as context in other queries).
   */
  public getOutlineText(): string {
    if (!this.outline) return "";
    return this.flattenItems(this.outline);
  }

  /**
   * Export outline as JSON.
   */
  public exportOutlineJSON(): string {
    return JSON.stringify(this.outline, null, 2);
  }

  // === Private helpers ===

  private getAddonRef(): string {
    return config.addonRef;
  }

  private getConfig(): OutlineConfig {
    try {
      const raw = Zotero.Prefs.get(`${this.getAddonRef()}.outlineConfig`) as string;
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      enabled: true,
      maxDepth: 3,
      includeSummaries: true,
    };
  }

  private buildOutlinePrompt(pageTexts: string[], maxDepth: number, includeSummaries: boolean): string {
    const depthDesc = maxDepth === 1 ? "only main chapters (level 1)" :
      maxDepth === 2 ? "chapters and sections (up to level 2)" :
      "chapters, sections, and subsections (up to level 3)";

    return `You are analyzing an academic paper. Based on the page-by-page text below, generate a structured outline.

Requirements:
- Extract ${depthDesc}
- For each item, provide: level (1-${maxDepth}), title, and page number
- ${includeSummaries ? 'Include a very brief summary (one sentence) for each level-1 section' : 'Do NOT include summaries'}

Format your response as a valid JSON array:
[
  {
    "level": 1,
    "title": "Introduction",
    "page": 1,
    "summary": "Introduces the research problem and motivation"
  },
  ...
]

Page texts:
${pageTexts.join("\n\n")}

Respond ONLY with the JSON array, no other text.`;
  }

  private async callGPT(prompt: string, model: string, api: string, secretKey: string): Promise<string> {
    const cleanApi = api.replace(/\/(?:v1)?\/?$/, "");
    const url = `${cleanApi}/v1/chat/completions`;

    const body = JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: "You are a helpful assistant that outputs valid JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const result = await Zotero.HTTP.request("POST", url, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secretKey}`,
      },
      body,
      responseType: "json",
    });

    if (result?.response?.choices?.[0]?.message?.content) {
      return result.response.choices[0].message.content;
    }

    throw new Error("No response from AI model.");
  }

  private parseOutline(rawResponse: string): OutlineItem[] {
    // Try to extract JSON from response
    let jsonStr = rawResponse.trim();
    
    // Handle markdown code blocks
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Handle leading/trailing non-JSON text
    const bracketStart = jsonStr.indexOf("[");
    const bracketEnd = jsonStr.lastIndexOf("]");
    if (bracketStart >= 0 && bracketEnd > bracketStart) {
      jsonStr = jsonStr.substring(bracketStart, bracketEnd + 1);
    }

    try {
      const items: OutlineItem[] = JSON.parse(jsonStr);
      // Build hierarchy
      return this.buildHierarchy(items);
    } catch (e) {
      Zotero.log(`[AI Outline] JSON parse error: ${e}`);
      // Fallback: return flat list
      return [{
        level: 1,
        title: "Outline Generation Failed",
        page: 1,
        summary: "Could not parse the AI response. Please try again.",
      }];
    }
  }

  private buildHierarchy(flatItems: OutlineItem[]): OutlineItem[] {
    const root: OutlineItem[] = [];
    const stack: OutlineItem[] = [];

    for (const item of flatItems) {
      item.children = item.children || [];
      
      while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        root.push(item);
      } else {
        const parent = stack[stack.length - 1];
        parent.children = parent.children || [];
        parent.children.push(item);
      }
      stack.push(item);
    }

    return root;
  }

  private renderItems(items: OutlineItem[], container: HTMLDivElement, depth: number): void {
    for (const item of items) {
      const itemDiv = document.createElement("div");
      itemDiv.style.cssText = `
        padding: ${2 + depth * 8}px 8px 2px ${12 + depth * 16}px;
        cursor: pointer;
        border-radius: 4px;
        font-size: ${14 - depth}px;
        color: #374151;
        transition: background-color 0.15s;
      `;
      
      itemDiv.innerHTML = `
        <span style="font-weight: ${depth === 0 ? 'bold' : 'normal'}; 
                     color: ${depth === 0 ? '#1a1a1a' : depth === 1 ? '#4a4a4a' : '#6a6a6a'}">
          ${"  ".repeat(depth)}${item.title}
        </span>
        <span style="color: #999; font-size: 11px; margin-left: 6px;">p.${item.page}</span>
        ${item.summary ? `<div style="color: #888; font-size: 11px; margin-top: 2px; font-style: italic;">${item.summary}</div>` : ""}
      `;

      itemDiv.addEventListener("mouseenter", () => {
        itemDiv.style.backgroundColor = "rgba(89, 192, 188, 0.1)";
      });
      itemDiv.addEventListener("mouseleave", () => {
        itemDiv.style.backgroundColor = "";
      });
      itemDiv.addEventListener("click", async () => {
        try {
          const reader = await ztoolkit.Reader.getReader();
          (reader!._iframeWindow as any).wrappedJSObject.eval(`
            PDFViewerApplication.pdfViewer.currentPageNumber = ${item.page};
          `);
        } catch (e) {
          Zotero.log(`[AI Outline] Navigation error: ${e}`);
        }
      });

      container.appendChild(itemDiv);

      if (item.children && item.children.length > 0) {
        this.renderItems(item.children, container, depth + 1);
      }
    }
  }

  private flattenItems(items: OutlineItem[], depth: number = 0): string {
    let result = "";
    const indent = "  ".repeat(depth);
    for (const item of items) {
      result += `${indent}${"#".repeat(item.level)} ${item.title} (Page ${item.page})\n`;
      if (item.summary) {
        result += `${indent}  ${item.summary}\n`;
      }
      if (item.children && item.children.length > 0) {
        result += this.flattenItems(item.children, depth + 1);
      }
    }
    return result;
  }

  private countItems(items: OutlineItem[]): number {
    let count = items.length;
    for (const item of items) {
      if (item.children) {
        count += this.countItems(item.children);
      }
    }
    return count;
  }

  private async getPageCount(reader: any): Promise<number> {
    try {
      return await (reader._iframeWindow as any).wrappedJSObject.eval(
        "PDFViewerApplication.pdfViewer.pagesCount"
      );
    } catch {
      return 0;
    }
  }

  private async getPageText(reader: any, pageIndex: number): Promise<string> {
    try {
      return await (reader._iframeWindow as any).wrappedJSObject.eval(`
        (async () => {
          const page = await PDFViewerApplication.pdfViewer.pdfDocument.getPage(${pageIndex + 1});
          const textContent = await page.getTextContent();
          return textContent.items.map(i => i.str).join(" ");
        })();
      `);
    } catch {
      return "";
    }
  }

  private showProgress(title: string, initialText: string) {
    return new ztoolkit.ProgressWindow(title, {
      closeTime: -1,
      closeOtherProgressWindows: true,
    })
      .createLine({ text: initialText, type: "default" })
      .show();
  }
}
