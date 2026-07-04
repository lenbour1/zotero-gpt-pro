/**
 * Sidebar & Toolbar Manager
 * 
 * Docks the GPT chat panel as a sidebar on the right side of Zotero.
 * Integrates with the existing floating Views panel.
 */

import { config } from "../../../package.json";
import Meet from "../Meet/api";

export class SidebarManager {
  private sidebarDiv: HTMLDivElement | null = null;
  private toggleBtn: HTMLElement | null = null;
  private visible = false;
  private initialized = false;
  private width = "380px";

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    
    this.width = (Zotero.Prefs.get(`${config.addonRef}.width`) as string) || "380px";
    this.injectToggleButton();

    // Register shortcut
    ztoolkit.Shortcut.register("event", {
      id: `${config.addonRef}-toggle`,
      modifiers: "control",
      key: "/",
      callback: () => this.toggle(),
    });

    // Register right-click menus
    this.registerMenus();
  }

  /**
   * Toggle sidebar visibility.
   */
  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    if (this.sidebarDiv) {
      this.sidebarDiv.style.display = "";
      this.visible = true;
      this.updateToggleState();
      return;
    }

    this.sidebarDiv = this.buildSidebar();
    document.body.appendChild(this.sidebarDiv);
    this.visible = true;
    this.updateToggleState();

    // Show the GPT panel inside sidebar
    const views = Zotero[config.addonInstance].views;
    if (views) {
      views.show(0, 0, true);
      // Move views container into sidebar
      const container = views.container;
      if (container) {
        const content = this.sidebarDiv.querySelector("#gpt-sidebar-content");
        if (content) {
          container.style.position = "relative";
          container.style.left = "0";
          container.style.top = "0";
          container.style.width = "100%";
          container.style.boxShadow = "none";
          container.style.borderRadius = "0";
          container.style.display = "flex";
          content.appendChild(container);
        }
      }
    }
  }

  hide(): void {
    if (this.sidebarDiv) {
      this.sidebarDiv.style.display = "none";
    }
    this.visible = false;
    this.updateToggleState();
  }

  private buildSidebar(): HTMLDivElement {
    const div = document.createElement("div");
    div.id = "gpt-pro-sidebar";
    div.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: ${this.width};
      height: 100vh;
      background: #fff;
      border-left: 1px solid #e0e0e0;
      box-shadow: -2px 0 12px rgba(0,0,0,0.08);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    // Header
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      user-select: none;
      flex-shrink: 0;
    `;
    header.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <img src="chrome://${config.addonRef}/content/icons/gpt.png" style="width:20px;height:20px;border-radius:4px;">
        <span>Zotero GPT Pro</span>
      </div>
      <div style="display:flex;gap:4px;">
        <button id="gpt-sidebar-config" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:12px;" title="AI Configuration">⚙️</button>
        <button id="gpt-sidebar-close" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:0 4px;">&times;</button>
      </div>
    `;

    // Content area
    const content = document.createElement("div");
    content.id = "gpt-sidebar-content";
    content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    `;

    div.appendChild(header);
    div.appendChild(content);

    // Events
    header.querySelector("#gpt-sidebar-close")?.addEventListener("click", () => this.hide());
    header.querySelector("#gpt-sidebar-config")?.addEventListener("click", () => {
      const configPanel = Zotero[config.addonInstance]?.configPanel;
      if (configPanel) configPanel.show();
    });

    // Resize handle
    const resizeHandle = document.createElement("div");
    resizeHandle.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 4px;
      height: 100%;
      cursor: col-resize;
      z-index: 10;
    `;
    resizeHandle.addEventListener("mousedown", (e) => this.startResize(e));
    div.appendChild(resizeHandle);

    return div;
  }

  private startResize(e: MouseEvent): void {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = this.sidebarDiv?.offsetWidth || 380;

    const onMove = (ev: MouseEvent) => {
      const newWidth = startWidth + (startX - ev.clientX);
      if (this.sidebarDiv && newWidth >= 300 && newWidth <= 800) {
        this.sidebarDiv.style.width = `${newWidth}px`;
      }
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  /**
   * Inject a toggle button into Zotero's toolbar.
   */
  private injectToggleButton(): void {
    const tryInject = () => {
      const toolbar = document.querySelector("#zotero-toolbar");
      if (!toolbar) {
        window.setTimeout(tryInject, 500);
        return;
      }

      const btn = document.createElement("toolbarbutton");
      btn.id = `${config.addonRef}-sidebar-toggle`;
      btn.setAttribute("tooltiptext", "Zotero GPT Pro (Ctrl+/)");
      btn.style.cssText = `
        list-style-image: url(chrome://${config.addonRef}/content/icons/gpt.png);
        width: 28px;
        height: 28px;
        margin: 0 4px;
        cursor: pointer;
        background-size: contain;
      `;
      btn.addEventListener("click", () => this.toggle());

      toolbar.appendChild(btn);
      this.toggleBtn = btn;
    };

    window.setTimeout(tryInject, 1500);
  }

  private updateToggleState(): void {
    if (this.toggleBtn) {
      this.toggleBtn.style.opacity = this.visible ? "1" : "0.6";
      this.toggleBtn.style.borderBottom = this.visible ? "2px solid #667eea" : "none";
    }
  }

  /**
   * Register right-click context menus.
   */
  private registerMenus(): void {
    // Item menu - Ask GPT
    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: `${config.addonRef}-item-ask`,
      label: "Ask GPT about this item",
      icon: `chrome://${config.addonRef}/content/icons/gpt.png`,
      commandListener: async () => {
        const items = ZoteroPane.getSelectedItems();
        if (items.length === 0) return;
        
        this.show();
        const item = items[0];
        const info = [
          `Title: ${item.getField("title")}`,
          `Author: ${item.getField("creator")}`,
          `Abstract: ${item.getField("abstractNote") || "N/A"}`,
        ].join("\n");
        
        Meet.OpenAI.getGPTResponse(`Please analyze this paper:\n\n${info}`);
      },
    });

    // Reader menu
    ztoolkit.Menu.register("reader", {
      tag: "menuitem",
      id: `${config.addonRef}-reader-ask`,
      label: "Ask GPT (with selection)",
      icon: `chrome://${config.addonRef}/content/icons/gpt.png`,
      commandListener: async () => {
        const selection = Meet.Zotero.getPDFSelection();
        if (selection) {
          this.show();
          Meet.OpenAI.getGPTResponse(`Explain this in 简体中文:\n\n${selection}`);
        }
      },
    });
  }
}
