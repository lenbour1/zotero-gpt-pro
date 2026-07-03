/**
 * Reference Manager
 * 
 * Manages conversation reference modes for the AI sidebar:
 * 1. No reference - generic Q&A
 * 2. PDF related paragraphs (vector search based AskPDF mode)
 * 3. PDF specific page range
 * 4. PDF -> Markdown (full text conversion)
 * 
 * Also supports:
 * - Multiple PDF/note reference sources
 * - History search in conversations
 * - Current page text/screenshot reference
 */

import { config } from "../../../package.json";
import { isPro, requirePro } from "../../validation/core";
import Meet from "../Meet/api";

export type ReferenceMode =
  | "none"
  | "relatedParagraphs"
  | "pageRange"
  | "fullText";

export interface ReferenceSource {
  id: string;
  type: "pdf" | "note";
  title: string;
  key: string;
  pages?: number[];
}

export interface MessageRecord {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  referenceMode: ReferenceMode;
  sources: ReferenceSource[];
}

export class ReferenceManager {
  private currentMode: ReferenceMode = "none";
  private currentSources: ReferenceSource[] = [];
  private currentPageRange: { start: number; end: number } = { start: 1, end: 3 };
  private messageHistory: MessageRecord[] = [];
  private searchIndex: Map<string, MessageRecord[]> = new Map();

  /**
   * Set the current reference mode.
   */
  setMode(mode: ReferenceMode): void {
    requirePro("referenceModes");
    this.currentMode = mode;
  }

  /**
   * Get the current reference mode.
   */
  getMode(): ReferenceMode {
    return this.currentMode;
  }

  /**
   * Add a reference source (PDF or note).
   */
  addSource(source: ReferenceSource): void {
    requirePro("multiSource");
    // Prevent duplicates
    if (!this.currentSources.find((s) => s.id === source.id)) {
      this.currentSources.push(source);
    }
  }

  /**
   * Remove a reference source.
   */
  removeSource(id: string): void {
    this.currentSources = this.currentSources.filter((s) => s.id !== id);
  }

  /**
   * Clear all reference sources.
   */
  clearSources(): void {
    this.currentSources = [];
    this.currentMode = "none";
  }

  /**
   * Get all current reference sources.
   */
  getSources(): ReferenceSource[] {
    return [...this.currentSources];
  }

  /**
   * Set page range for pageRange mode.
   */
  setPageRange(start: number, end: number): void {
    this.currentPageRange = { start, end };
  }

  /**
   * Get page range.
   */
  getPageRange(): { start: number; end: number } {
    return { ...this.currentPageRange };
  }

  /**
   * Build reference context based on current mode.
   */
  async buildReferenceContext(query: string): Promise<string> {
    switch (this.currentMode) {
      case "none":
        return "";

      case "relatedParagraphs":
        return await this.buildRelatedContext(query);

      case "pageRange":
        return await this.buildPageRangeContext();

      case "fullText":
        return await this.buildFullTextContext();

      default:
        return "";
    }
  }

  /**
   * Build context using vector similarity search.
   */
  private async buildRelatedContext(query: string): Promise<string> {
    try {
      const result = await Meet.Zotero.getRelatedText(query);
      return result;
    } catch {
      return "";
    }
  }

  /**
   * Build context from specified page range.
   */
  private async buildPageRangeContext(): Promise<string> {
    try {
      const pages: number[] = [];
      for (let i = this.currentPageRange.start - 1; i < this.currentPageRange.end; i++) {
        if (i >= 0) pages.push(i);
      }

      const reader = await ztoolkit.Reader.getReader();
      if (!reader) return "";

      const texts: string[] = [];
      for (const pageIdx of pages) {
        try {
          const text = await (reader._iframeWindow as any).wrappedJSObject.eval(`
            (async () => {
              const page = await PDFViewerApplication.pdfViewer.pdfDocument.getPage(${pageIdx + 1});
              const textContent = await page.getTextContent();
              return textContent.items.map(i => i.str).join(" ");
            })();
          `);
          if (text) {
            texts.push(`[Page ${pageIdx + 1}]\n${text}`);
          }
        } catch {
          // skip
        }
      }

      return texts.join("\n\n");
    } catch {
      return "";
    }
  }

  /**
   * Build context from full PDF text.
   */
  private async buildFullTextContext(): Promise<string> {
    try {
      const reader = await ztoolkit.Reader.getReader();
      if (!reader) return "";

      const pageCount: number = await (reader._iframeWindow as any).wrappedJSObject.eval(
        `PDFViewerApplication.pdfViewer.pagesCount`
      );

      const texts: string[] = [];
      for (let i = 0; i < Math.min(pageCount, 10); i++) {
        try {
          const text = await (reader._iframeWindow as any).wrappedJSObject.eval(`
            (async () => {
              const page = await PDFViewerApplication.pdfViewer.pdfDocument.getPage(${i + 1});
              const textContent = await page.getTextContent();
              return textContent.items.map(item => item.str).join(" ");
            })();
          `);
          if (text) texts.push(text);
        } catch {
          // skip
        }
      }

      return texts.join("\n\n");
    } catch {
      return "";
    }
  }

  /**
   * Record a message in history for search.
   */
  recordMessage(role: "user" | "assistant", content: string): void {
    const record: MessageRecord = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role,
      content,
      timestamp: Date.now(),
      referenceMode: this.currentMode,
      sources: [...this.currentSources],
    };
    this.messageHistory.push(record);
    this.saveHistory();
  }

  /**
   * Search message history by keyword.
   */
  searchHistory(keyword: string): MessageRecord[] {
    requirePro("historySearch");

    const lower = keyword.toLowerCase();
    return this.messageHistory.filter(
      (m) =>
        m.content.toLowerCase().includes(lower)
    );
  }

  /**
   * Get conversation context from history.
   */
  getConversationContext(maxMessages: number = 10): MessageRecord[] {
    return this.messageHistory.slice(-maxMessages);
  }

  /**
   * Clear message history.
   */
  clearHistory(): void {
    this.messageHistory = [];
    this.saveHistory();
  }

  /**
   * Save message history to preferences.
   */
  private saveHistory(): void {
    try {
      // Keep only last 500 messages
      if (this.messageHistory.length > 500) {
        this.messageHistory = this.messageHistory.slice(-500);
      }
      Zotero.Prefs.set(
        `${config.addonRef}.proMessageHistory`,
        JSON.stringify(this.messageHistory.slice(-100))
      );
    } catch {
      // Silent fail
    }
  }

  /**
   * Load message history from preferences.
   */
  loadHistory(): void {
    try {
      const raw = Zotero.Prefs.get(`${config.addonRef}.proMessageHistory`) as string;
      if (raw) {
        this.messageHistory = JSON.parse(raw);
      }
    } catch {
      this.messageHistory = [];
    }
  }

  /**
   * Get current PDF item as a reference source.
   */
  getCurrentPDFSource(): ReferenceSource | null {
    try {
      if (Zotero_Tabs.selectedIndex <= 0) return null;
      const item = Zotero.Items.get(
        Zotero.Reader.getByTabID(Zotero_Tabs.selectedID)!.itemID as number
      );
      if (!item) return null;
      return {
        id: `pdf-${item.key}`,
        type: "pdf",
        title: item.getField("title") as string || "Untitled PDF",
        key: item.key,
      };
    } catch {
      return null;
    }
  }
}
