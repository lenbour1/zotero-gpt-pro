/**
 * Toolbar & Menu Manager
 * 
 * Adds:
 * 1. Toolbar button to open Zotero GPT Pro
 * 2. Right-click context menus on items and PDF
 * 3. Menu items integration
 */

import { config } from "../../../package.json";
import Meet from "../Meet/api";

export class ToolbarManager {
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.registerToolbarButton();
    this.registerItemMenus();
    this.registerReaderMenus();
  }

  /**
   * Register a toolbar button in Zotero's main toolbar.
   */
  private registerToolbarButton(): void {
    // Register toolbar button using ztoolkit
    ztoolkit.Shortcut.register("event", {
      id: `${config.addonRef}-toolbar`,
      modifiers: "control",
      key: "/",
      callback: () => {
        const views = Zotero[config.addonInstance].views;
        if (views) {
          views.show();
        }
      },
    });

    // Add button to Zotero toolbar
    this.addToolbarButtonToDOM();
  }

  /**
   * Add an actual visible button to Zotero's toolbar.
   */
  private addToolbarButtonToDOM(): void {
    try {
      // Try to add to Zotero 7 main toolbar
      const toolbar = document.querySelector("#zotero-toolbar");
      if (toolbar) {
        const btn = ztoolkit.UI.createElement(document, "toolbarbutton", {
          id: `${config.addonRef}-toolbar-btn`,
          classList: ["zotero-tb-button"],
          styles: {
            listStyleImage: `url(chrome://${config.addonRef}/content/icons/gpt.png)`,
            width: "24px",
            height: "24px",
            margin: "0 2px",
            cursor: "pointer",
          },
          attributes: {
            tooltiptext: "Zotero GPT Pro",
          },
        });
        btn.addEventListener("click", () => {
          const views = Zotero[config.addonInstance].views;
          if (views) views.show();
        });
        toolbar.appendChild(btn);
      }
    } catch (e) {
      Zotero.log(`[GPT Pro] Toolbar button error: ${e}`);
    }
  }

  /**
   * Register right-click menus on library items.
   */
  private registerItemMenus(): void {
    // Register item context menu
    ztoolkit.Menu.register("item", {
      tag: "menuseparator",
      id: `${config.addonRef}-item-sep`,
    });

    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: `${config.addonRef}-item-ask`,
      label: "Ask GPT about this item",
      icon: `chrome://${config.addonRef}/content/icons/gpt.png`,
      commandListener: async () => {
        const items = ZoteroPane.getSelectedItems();
        if (items.length === 0) return;
        
        const item = items[0];
        const info = [
          `Title: ${item.getField("title")}`,
          `Author: ${item.getField("creator")}`,
          `Abstract: ${item.getField("abstractNote") || "N/A"}`,
        ].join("\n");

        const views = Zotero[config.addonInstance].views;
        if (views) {
          views.messages = [{
            role: "user",
            content: `Here is a Zotero item:\n${info}`,
          }];
          views.show();
          Meet.OpenAI.getGPTResponse(`Here is a paper I'm looking at. Please help me understand it:\n\n${info}`);
        }
      },
    });

    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: `${config.addonRef}-item-summarize`,
      label: "Summarize this item",
      icon: `chrome://${config.addonRef}/content/icons/gpt.png`,
      commandListener: async () => {
        const items = ZoteroPane.getSelectedItems();
        if (items.length === 0) return;
        
        const item = items[0];
        const abstract = item.getField("abstractNote") as string;
        
        const views = Zotero[config.addonInstance].views;
        if (views) {
          views.show();
          Meet.OpenAI.getGPTResponse(
            `Summarize the following paper abstract in 简体中文:\n\nTitle: ${item.getField("title")}\n\n${abstract || "No abstract available."}`
          );
        }
      },
    });
  }

  /**
   * Register menus in the PDF reader.
   */
  private registerReaderMenus(): void {
    // PDF reader context menu
    ztoolkit.Menu.register("reader", {
      tag: "menuseparator",
      id: `${config.addonRef}-reader-sep`,
    });

    ztoolkit.Menu.register("reader", {
      tag: "menuitem",
      id: `${config.addonRef}-reader-ask`,
      label: "Ask GPT (with selection)",
      icon: `chrome://${config.addonRef}/content/icons/gpt.png`,
      commandListener: async () => {
        const selection = Meet.Zotero.getPDFSelection();
        const views = Zotero[config.addonInstance].views;
        if (views && selection) {
          views.messages = [{
            role: "user",
            content: `Reading PDF text:\n${selection}`,
          }];
          views.show();
          Meet.OpenAI.getGPTResponse(`Explain this in 简体中文:\n\n${selection}`);
        }
      },
    });

    ztoolkit.Menu.register("reader", {
      tag: "menuitem",
      id: `${config.addonRef}-reader-outline`,
      label: "Generate AI Outline",
      icon: `chrome://${config.addonRef}/content/icons/gpt.png`,
      commandListener: async () => {
        const pro = Zotero[config.addonInstance].pro;
        if (pro) {
          const views = Zotero[config.addonInstance].views;
          if (views) views.show();
          try {
            await pro.outline.generateOutline();
          } catch (e: any) {
            Zotero.log(`[GPT Pro] Outline error: ${e}`);
          }
        }
      },
    });
  }
}
