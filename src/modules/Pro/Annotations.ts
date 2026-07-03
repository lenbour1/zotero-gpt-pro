/**
 * AI Annotations Manager
 * 
 * Generate colored PDF annotations using GPT.
 * Supports custom color-coded categories and model selection.
 */

import { config } from "../../../package.json";
import { requirePro } from "../../validation/core";

interface AnnotationCategory {
  name: string;
  color: string;
  description: string;
}

interface AnnotationResult {
  pageIndex: number;
  text: string;
  category: string;
  color: string;
}

const DEFAULT_CATEGORIES: AnnotationCategory[] = [
  { name: "研究现状", color: "#FFD700", description: "Research background and current state" },
  { name: "研究方法", color: "#87CEEB", description: "Research methods and methodology" },
  { name: "核心发现", color: "#FF6B6B", description: "Key findings and results" },
  { name: "研究结论", color: "#98FB98", description: "Conclusions and implications" },
  { name: "研究不足", color: "#DDA0DD", description: "Limitations and future work" },
];

export class AnnotationsManager {
  private categories: AnnotationCategory[];

  constructor() {
    this.categories = this.loadCategories();
  }

  private loadCategories(): AnnotationCategory[] {
    try {
      const stored = Zotero.Prefs.get(`${config.addonRef}.proAnnotationCategories`) as string;
      if (stored && stored.length > 2) return JSON.parse(stored);
    } catch (e) {
      Zotero.log(`[Pro] Failed to load annotation categories: ${e}`);
    }
    return DEFAULT_CATEGORIES;
  }

  private saveCategories(): void {
    Zotero.Prefs.set(`${config.addonRef}.proAnnotationCategories`, JSON.stringify(this.categories));
  }

  getCategories(): AnnotationCategory[] {
    return [...this.categories];
  }

  setCategories(categories: AnnotationCategory[]): void {
    this.categories = categories;
    this.saveCategories();
  }

  async generateAnnotations(
    model?: string,
    categories?: AnnotationCategory[]
  ): Promise<AnnotationResult[]> {
    requirePro("aiAnnotations");

    const cats = categories || this.categories;
    const api = Zotero.Prefs.get(`${config.addonRef}.api`) as string;
    const secretKey = Zotero.Prefs.get(`${config.addonRef}.secretKey`) as string;
    const useModel = model || Zotero.Prefs.get(`${config.addonRef}.model`) as string || "gpt-3.5-turbo";

    if (!secretKey) {
      throw new Error("Please configure your API key before generating AI annotations.");
    }

    const pdfItemID = this.getCurrentPDFItemID();
    if (!pdfItemID) {
      throw new Error("Please open a PDF to generate annotations.");
    }

    const pageTexts = await this.extractPDFPageTexts();
    if (pageTexts.length === 0) {
      throw new Error("Could not extract text from PDF.");
    }

    const categoryDescriptions = cats
      .map((c, i) => `${i + 1}. ${c.name} (${c.description})`)
      .join("\n");

    const results: AnnotationResult[] = [];
    const batchSize = 3;
    for (let i = 0; i < pageTexts.length; i += batchSize) {
      const batch = pageTexts.slice(i, i + batchSize);
      const batchResults = await this.processPageBatch(
        batch, categoryDescriptions, cats, api, secretKey, useModel
      );
      results.push(...batchResults);
    }

    await this.writeAnnotationsToPDF(pdfItemID, results);
    return results;
  }

  private async processPageBatch(
    pages: { pageIndex: number; text: string }[],
    categoryDescriptions: string,
    categories: AnnotationCategory[],
    api: string,
    secretKey: string,
    model: string
  ): Promise<AnnotationResult[]> {
    const pagesText = pages
      .map((p) => `[Page ${p.pageIndex + 1}]\n${p.text.slice(0, 3000)}`)
      .join("\n\n");

    const prompt = `You are annotating an academic paper. For each page, identify sentences that match these categories:\n\n${categoryDescriptions}\n\nFor each sentence found, output a JSON array of objects with:\n- "page": the page number (as given in [Page N])\n- "text": the exact sentence text (keep it concise, up to 200 chars)\n- "category": the category name\n\nReturn ONLY the JSON array, no explanation.\n\nPages:\n${pagesText}`;

    const response = await this.callGPT(api, secretKey, model, prompt);
    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];
      const parsed: AnnotationResult[] = JSON.parse(jsonMatch[0]);
      return parsed.map((r) => ({
        ...r,
        color: categories.find((c) => c.name === r.category)?.color || "#FFFF00",
      }));
    } catch (e) {
      Zotero.log(`[Pro] Failed to parse annotation results: ${e}`);
      return [];
    }
  }

  private async callGPT(api: string, secretKey: string, model: string, prompt: string): Promise<string> {
    api = api.replace(/\/(?:v1)?\/?$/, "");
    const url = `${api}/v1/chat/completions`;
    const response = await Zotero.HTTP.request("POST", url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a precise academic annotation assistant. Respond only with valid JSON arrays." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
      responseType: "json",
    });
    return response?.response?.choices?.[0]?.message?.content || "";
  }

  private async extractPDFPageTexts(): Promise<{ pageIndex: number; text: string }[]> {
    // @ts-ignore
    const reader = await ztoolkit.Reader.getReader();
    if (!reader?._iframeWindow) return [];

    const result: { pageIndex: number; text: string }[] = [];
    try {
      const pageCount = await (reader._iframeWindow as any).wrappedJSObject.eval(
        `PDFViewerApplication.pdfViewer.pagesCount`
      );
      for (let i = 0; i < pageCount; i++) {
        const pageText = await (reader._iframeWindow as any).wrappedJSObject.eval(`
          (async () => {
            const page = await PDFViewerApplication.pdfViewer.pdfDocument.getPage(${i + 1});
            const textContent = await page.getTextContent();
            return textContent.items.map(item => item.str).join(' ');
          })()
        `);
        if (pageText?.trim()) result.push({ pageIndex: i, text: pageText });
      }
    } catch (e) {
      Zotero.log(`[Pro] Error extracting PDF page texts: ${e}`);
    }
    return result;
  }

  private getCurrentPDFItemID(): number | null {
    try {
      if (Zotero_Tabs.selectedIndex <= 0) return null;
      return Zotero.Reader.getByTabID(Zotero_Tabs.selectedID)!.itemID as number;
    } catch {
      return null;
    }
  }

  private async writeAnnotationsToPDF(itemID: number, results: AnnotationResult[]): Promise<void> {
    const pdfItem = Zotero.Items.get(itemID) as Zotero.Item;
    if (!pdfItem) return;

    for (const result of results) {
      try {
        const annotation = new Zotero.Item("annotation") as any;
        annotation.setField("annotationType", "highlight");
        annotation.setField("annotationText", result.text);
        annotation.setField("annotationComment", `[AI] ${result.category}`);
        annotation.setField("annotationColor", result.color);
        annotation.setField(
          "annotationPosition",
          JSON.stringify({ pageIndex: result.pageIndex, rects: [[0, 0, 100, 20]] })
        );
        annotation.setField("parentItem", pdfItem.id);
        await annotation.saveTx();
      } catch (e) {
        Zotero.log(`[Pro] Failed to add annotation: ${e}`);
      }
    }
  }

  async clearAIAnnotations(): Promise<number> {
    requirePro("aiAnnotations");

    const pdfItemID = this.getCurrentPDFItemID();
    if (!pdfItemID) {
      throw new Error("Please open a PDF to clear annotations.");
    }

    const pdfItem = Zotero.Items.get(pdfItemID) as Zotero.Item;
    if (!pdfItem) return 0;

    const annotations = pdfItem.getAnnotations();
    let cleared = 0;

    for (const anno of annotations) {
      const comment = (anno as any).annotationComment || "";
      if (comment.startsWith("[AI]")) {
        try {
          await Zotero.Items.erase((anno as any).id);
          cleared++;
        } catch (e) {
          Zotero.log(`[Pro] Failed to remove annotation: ${e}`);
        }
      }
    }
    return cleared;
  }
}
