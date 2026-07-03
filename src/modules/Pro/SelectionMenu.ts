/**
 * Selection Quick Commands Popup
 * 
 * When user selects text in PDF, automatically shows a floating
 * quick-action button panel with Translate, Explain, Summarize.
 */
import { isPro } from "../../validation/core";
import { PromptsManager, PromptDefinition } from "./Prompts";
import Meet from "../Meet/api";

export class SelectionMenuManager {
  private buttonContainer: HTMLDivElement | null = null;
  private promptsManager: PromptsManager | null = null;
  private popupVisible = false;
  private observer: MutationObserver | null = null;

  init(): void {
    this.setupSelectionListener();
  }

  setPromptsManager(pm: PromptsManager): void {
    this.promptsManager = pm;
  }

  /**
   * Listen for PDF text selection events and show popup.
   */
  private setupSelectionListener(): void {
    document.addEventListener("mouseup", this.onMouseUp.bind(this));
    // Also listen for specific keys to hide
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.hidePopup();
      }
    });
  }

  private async onMouseUp(e: MouseEvent): Promise<void> {
    if (!isPro()) return;

    // Small delay to let selection register
    window.setTimeout(async () => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed) {
        this.hidePopup();
        return;
      }

      const selectedText = selection.toString().trim();
      if (selectedText.length < 3) {
        this.hidePopup();
        return;
      }

      // Check if we're in a PDF reader
      const reader = await ztoolkit.Reader.getReader();
      if (!reader) {
        this.hidePopup();
        return;
      }

      const iframeSel = reader._iframeWindow?.getSelection();
      if (!iframeSel || iframeSel.isCollapsed) return;

      // Show popup near selection
      const rect = iframeSel.getRangeAt(0).getBoundingClientRect();
      if (!rect || rect.width === 0) return;

      this.showPopup(rect.right + 8, rect.top);
    }, 100);
  }

  /**
   * Show quick command popup.
   */
  private showPopup(x: number, y: number): void {
    if (this.popupVisible) {
      this.updatePopupPosition(x, y);
      return;
    }

    this.buttonContainer = document.createElement("div");
    this.buttonContainer.id = "gpt-pro-selection-menu";
    this.buttonContainer.style.cssText = `
      position: fixed;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 4px;
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      box-shadow: 0px 2px 8px rgba(0,0,0,0.15);
      z-index: 999999;
      user-select: none;
    `;

    // Get selection-specific prompts
    const prompts: { name: string; prompt: string; type: string }[] =
      this.promptsManager?.getByType("selectedText") || [];
    const actions = prompts.length > 0
      ? prompts.slice(0, 5).map(p => ({ name: p.name, prompt: p.prompt, type: p.type }))
      : this.getDefaultActions();

    for (const action of actions) {
      const btn = this.createActionButton(action);
      this.buttonContainer.appendChild(btn);
    }

    document.body.appendChild(this.buttonContainer);
    this.updatePopupPosition(x, y);
    this.popupVisible = true;
  }

  /**
   * Update popup position.
   */
  private updatePopupPosition(x: number, y: number): void {
    if (!this.buttonContainer) return;

    const rect = this.buttonContainer.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let left = x;
    let top = y;

    if (left + rect.width > winW) left = winW - rect.width - 10;
    if (top + rect.height > winH) top = winH - rect.height - 10;
    if (left < 0) left = 10;
    if (top < 0) top = 10;

    this.buttonContainer.style.left = `${left}px`;
    this.buttonContainer.style.top = `${top}px`;
  }

  /**
   * Create a single action button.
   */
  private createActionButton(
    action: PromptDefinition | { name: string; prompt: string; type: string }
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: #333;
      font-size: 13px;
      font-family: system-ui, sans-serif;
      cursor: pointer;
      white-space: nowrap;
      transition: background-color 0.15s;
      width: 100%;
      text-align: left;
    `;

    const iconMap: Record<string, string> = {
      "翻译": "🌐", "解释": "💡", "概括": "📝", "分析": "🔍",
      "translate": "🌐", "explain": "💡", "summarize": "📝", "analyze": "🔍",
    };

    const icon = iconMap[action.name.toLowerCase()] || "📌";
    btn.innerHTML = `${icon} ${action.name}`;

    btn.addEventListener("mouseenter", () => {
      btn.style.backgroundColor = "rgba(89, 192, 188, 0.15)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.backgroundColor = "transparent";
    });

    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      this.hidePopup();

      try {
        const selectedText = Meet.Zotero.getPDFSelection();
        if (!selectedText) return;

        if ("id" in action && this.promptsManager) {
          const result = await this.promptsManager.execute(action as PromptDefinition);
          // Result is shown in the main chat output
        } else {
          // Legacy direct execution
          const prompt = (action as any).prompt.replace("{{input}}", selectedText);
          await Meet.OpenAI.getGPTResponse(prompt);
        }
      } catch (err: any) {
        Zotero.log(`[SelectionMenu] Error: ${err.message}`);
      }
    });

    return btn;
  }

  /**
   * Hide popup.
   */
  public hidePopup(): void {
    if (this.buttonContainer) {
      this.buttonContainer.remove();
      this.buttonContainer = null;
    }
    this.popupVisible = false;
  }

  /**
   * Get default actions when no custom prompts exist.
   */
  private getDefaultActions() {
    return [
      { name: "翻译", prompt: "Translate to 简体中文:\n{{input}}", type: "selectedText" },
      { name: "解释", prompt: "Explain in simple terms in 简体中文:\n{{input}}", type: "selectedText" },
      { name: "概括", prompt: "Summarize in 2-3 sentences in 简体中文:\n{{input}}", type: "selectedText" },
    ];
  }
}
