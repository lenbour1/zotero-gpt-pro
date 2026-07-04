/**
 * AI Configuration Panel
 * 
 * Renders a settings/preferences panel for GPT configuration.
 * Accessible via toolbar icon or right-click menu.
 */

import { config } from "../../../package.json";
import { isPro, getLicenseInfo, setLicenseKey, clearLicense } from "../../validation/core";

export class ConfigPanel {
  private panelDiv: HTMLDivElement | null = null;
  private visible = false;

  /**
   * Show the AI configuration panel.
   */
  show(): void {
    if (this.visible) {
      this.hide();
      return;
    }

    this.panelDiv = this.buildPanel();
    document.body.appendChild(this.panelDiv);
    this.visible = true;
    this.loadSettings();
  }

  hide(): void {
    if (this.panelDiv) {
      this.panelDiv.remove();
      this.panelDiv = null;
    }
    this.visible = false;
  }

  private buildPanel(): HTMLDivElement {
    const div = document.createElement("div");
    div.id = "gpt-pro-config-panel";
    div.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 520px;
      max-height: 80vh;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      z-index: 999999;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      overflow-y: auto;
      padding: 0;
    `;

    div.innerHTML = `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:#fff; padding:20px 24px; border-radius:12px 12px 0 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h2 style="margin:0;font-size:18px;">🤖 Zotero GPT Pro Configuration</h2>
          <button id="gpt-config-close" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">&times;</button>
        </div>
      </div>
      <div style="padding:24px;">
        <!-- API Settings -->
        <fieldset style="border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin-bottom:16px;">
          <legend style="font-weight:bold;color:#333;padding:0 8px;">🔑 API Settings</legend>
          <div style="margin-bottom:12px;">
            <label style="color:#666;font-size:12px;">API URL</label>
            <input id="cfg-api" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;" value="${Zotero.Prefs.get(`${config.addonRef}.api`)}">
          </div>
          <div style="margin-bottom:12px;">
            <label style="color:#666;font-size:12px;">API Key</label>
            <input id="cfg-key" type="password" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;" value="${Zotero.Prefs.get(`${config.addonRef}.secretKey`)}">
          </div>
          <div style="display:flex;gap:12px;">
            <div style="flex:1;">
              <label style="color:#666;font-size:12px;">Model</label>
              <select id="cfg-model" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;">
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                <option value="gpt-4">GPT-4</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="kimi-k2.5">kimi-k2.5</option>
              </select>
            </div>
            <div style="flex:1;">
              <label style="color:#666;font-size:12px;">Temperature</label>
              <input id="cfg-temp" type="range" min="0" max="2" step="0.1" style="width:100%;">
              <span id="cfg-temp-val" style="color:#666;font-size:12px;">1.0</span>
            </div>
          </div>
          <div style="display:flex;gap:12px;margin-top:12px;">
            <div style="flex:1;">
              <label style="color:#666;font-size:12px;">Chat History</label>
              <input id="cfg-chat" type="number" min="1" max="50" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;" value="${Zotero.Prefs.get(`${config.addonRef}.chatNumber`)}">
            </div>
            <div style="flex:1;">
              <label style="color:#666;font-size:12px;">Related Items</label>
              <input id="cfg-related" type="number" min="1" max="20" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;" value="${Zotero.Prefs.get(`${config.addonRef}.relatedNumber`)}">
            </div>
          </div>
        </fieldset>

        <!-- License -->
        <fieldset style="border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin-bottom:16px;">
          <legend style="font-weight:bold;color:#333;padding:0 8px;">🔐 Pro License</legend>
          <div id="cfg-license-status" style="margin-bottom:12px;padding:8px;border-radius:6px;font-size:13px;"></div>
          <div style="margin-bottom:12px;">
            <label style="color:#666;font-size:12px;">License Key</label>
            <input id="cfg-license-key" type="text" placeholder="ZGPT-XXXX-XXXX-XXXX" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;">
          </div>
          <div style="display:flex;gap:8px;">
            <button id="cfg-license-activate" style="flex:1;padding:8px;background:#667eea;color:#fff;border:none;border-radius:6px;cursor:pointer;">Activate</button>
            <button id="cfg-license-clear" style="padding:8px 16px;background:#f5f5f5;color:#666;border:1px solid #ddd;border-radius:6px;cursor:pointer;">Clear</button>
          </div>
        </fieldset>

        <!-- UI Settings -->
        <fieldset style="border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin-bottom:16px;">
          <legend style="font-weight:bold;color:#333;padding:0 8px;">🎨 UI Settings</legend>
          <div style="margin-bottom:12px;">
            <label style="color:#666;font-size:12px;">Panel Width</label>
            <input id="cfg-width" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;" value="${Zotero.Prefs.get(`${config.addonRef}.width`)}">
          </div>
          <div style="margin-bottom:12px;">
            <label style="color:#666;font-size:12px;">Stream Smoothness (ms)</label>
            <input id="cfg-delta" type="number" min="10" max="500" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;" value="${Zotero.Prefs.get(`${config.addonRef}.deltaTime`)}">
          </div>
          <div style="margin-bottom:12px;">
            <label style="color:#666;font-size:12px;">Tags Display</label>
            <select id="cfg-tagsmore" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;">
              <option value="expand">Expand</option>
              <option value="scroll">Scroll</option>
            </select>
          </div>
        </fieldset>

        <!-- Save -->
        <button id="cfg-save" style="width:100%;padding:12px;background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;font-weight:bold;">💾 Save Settings</button>
        <div style="margin-top:12px;text-align:right;">
          <a href="#" id="cfg-manage-prompts" style="color:#667eea;font-size:13px;text-decoration:none;">Manage Custom Prompts →</a>
        </div>
      </div>
    `;

    this.bindEvents(div);
    return div;
  }

  private bindEvents(div: HTMLDivElement): void {
    // Close
    div.querySelector("#gpt-config-close")?.addEventListener("click", () => this.hide());

    // Temperature slider
    const tempSlider = div.querySelector("#cfg-temp") as HTMLInputElement;
    const tempVal = div.querySelector("#cfg-temp-val") as HTMLSpanElement;
    tempSlider?.addEventListener("input", () => {
      tempVal.textContent = tempSlider.value;
    });

    // License activate
    div.querySelector("#cfg-license-activate")?.addEventListener("click", () => {
      const keyInput = div.querySelector("#cfg-license-key") as HTMLInputElement;
      if (keyInput.value.trim()) {
        setLicenseKey(keyInput.value.trim());
        this.updateLicenseStatus(div);
      }
    });

    // License clear
    div.querySelector("#cfg-license-clear")?.addEventListener("click", () => {
      clearLicense();
      (div.querySelector("#cfg-license-key") as HTMLInputElement).value = "";
      this.updateLicenseStatus(div);
    });

    // Save
    div.querySelector("#cfg-save")?.addEventListener("click", () => {
      this.saveSettings(div);
    });

    // Manage prompts
    div.querySelector("#cfg-manage-prompts")?.addEventListener("click", (e) => {
      e.preventDefault();
      const pro = Zotero[config.addonInstance]?.pro;
      if (pro?.prompts) {
        const prompts = pro.prompts.getAll();
        const promptList = prompts.map(p => `• ${p.name} [${p.type}]`).join("\n");
        const popup = new ztoolkit.ProgressWindow("Custom Prompts", { closeTime: -1 });
        popup.createLine({ text: `Total: ${prompts.length} prompts`, type: "default" });
        promptList.split("\n").forEach(line => {
          popup.createLine({ text: line, type: "default" });
        });
        popup.show();
        popup.startCloseTimer(10000);
      }
    });

    // Close on backdrop
    div.addEventListener("click", (e) => {
      if (e.target === div) this.hide();
    });
  }

  private loadSettings(): void {
    if (!this.panelDiv) return;

    const model = Zotero.Prefs.get(`${config.addonRef}.model`) as string;
    const temp = Zotero.Prefs.get(`${config.addonRef}.temperature`) as string;
    const tags = Zotero.Prefs.get(`${config.addonRef}.tagsMore`) as string;

    (this.panelDiv.querySelector("#cfg-model") as HTMLSelectElement).value = model || "gpt-3.5-turbo";
    (this.panelDiv.querySelector("#cfg-temp") as HTMLInputElement).value = temp || "1.0";
    (this.panelDiv.querySelector("#cfg-temp-val") as HTMLSpanElement).textContent = temp || "1.0";
    (this.panelDiv.querySelector("#cfg-tagsmore") as HTMLSelectElement).value = tags || "expand";
    this.updateLicenseStatus(this.panelDiv);
  }

  private updateLicenseStatus(div: HTMLDivElement): void {
    const info = getLicenseInfo();
    const statusDiv = div.querySelector("#cfg-license-status") as HTMLDivElement;
    
    if (info.status === "pro") {
      statusDiv.style.background = "#e8f5e9";
      statusDiv.style.color = "#2e7d32";
      statusDiv.textContent = `✅ Pro Active | ${info.features.length} features | ${info.licensee || "Licensed"}`;
      if (info.expireDate) {
        statusDiv.textContent += ` | Expires: ${info.expireDate}`;
      }
    } else if (info.status === "expired") {
      statusDiv.style.background = "#fff3e0";
      statusDiv.style.color = "#e65100";
      statusDiv.textContent = `⚠️ License Expired (${info.expireDate || "Unknown"})`;
    } else {
      statusDiv.style.background = "#f5f5f5";
      statusDiv.style.color = "#666";
      statusDiv.textContent = "🔓 Free Mode | Upgrade to Pro for AI Annotations, Outline, Prompts...";
    }
  }

  private saveSettings(div: HTMLDivElement): void {
    const api = (div.querySelector("#cfg-api") as HTMLInputElement).value;
    const key = (div.querySelector("#cfg-key") as HTMLInputElement).value;
    const model = (div.querySelector("#cfg-model") as HTMLSelectElement).value;
    const temp = (div.querySelector("#cfg-temp") as HTMLInputElement).value;
    const chat = (div.querySelector("#cfg-chat") as HTMLInputElement).value;
    const related = (div.querySelector("#cfg-related") as HTMLInputElement).value;
    const width = (div.querySelector("#cfg-width") as HTMLInputElement).value;
    const delta = (div.querySelector("#cfg-delta") as HTMLInputElement).value;
    const tagsmore = (div.querySelector("#cfg-tagsmore") as HTMLSelectElement).value;

    const prefs: Record<string, any> = {
      api, model, temperature: temp,
      chatNumber: Number(chat), relatedNumber: Number(related),
      width, deltaTime: Number(delta), tagsMore: tagsmore,
    };

    if (key) {
      prefs.secretKey = key;
    }

    for (const [k, v] of Object.entries(prefs)) {
      Zotero.Prefs.set(`${config.addonRef}.${k}`, v);
    }

    // Show success
    const popup = new ztoolkit.ProgressWindow("Settings");
    popup.createLine({ text: "✅ Settings saved successfully!", type: "success" });
    popup.show();
    popup.startCloseTimer(2000);

    // Rebuild the view if open
    const views = Zotero[config.addonInstance]?.views;
    if (views?.container?.style?.display !== "none") {
      views.show(-1, -1, true);
    }
  }
}
