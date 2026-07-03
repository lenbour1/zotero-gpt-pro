/**
 * Pro Settings Manager
 * 
 * Manages Pro-specific configuration:
 * - License key management
 * - AI Annotation categories
 * - AI Outline configuration
 * - Custom prompt management UI helpers
 */

import { config } from "../../../package.json";
import {
  setLicenseKey,
  clearLicense,
  getLicenseInfo,
  isPro,
  getProFeatures,
  LicenseInfo,
} from "../../validation/core";

export interface ProSettingsData {
  license: {
    key: string;
    status: string;
    features: string[];
    expireDate?: string;
    licensee?: string;
  };
  annotations: {
    categories: Array<{ name: string; color: string; description: string }>;
  };
  outline: {
    enabled: boolean;
    maxDepth: number;
    includeSummaries: boolean;
    model?: string;
  };
  prompts: {
    count: number;
    customCount: number;
  };
  shortcuts: {
    showSidebar: string;
    togglePopup: string;
  };
}

export class ProSettings {
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    this.ensureDefaultPrefs();
    this.initialized = true;
  }

  /**
   * Ensure all Pro preference keys have defaults.
   */
  private ensureDefaultPrefs(): void {
    const defaults: Record<string, any> = {
      proLicenseKey: "",
      proAnnotationCategories: JSON.stringify([
        { name: "研究现状", color: "#FFD700", description: "Research background" },
        { name: "研究方法", color: "#87CEEB", description: "Methods" },
        { name: "核心发现", color: "#FF6B6B", description: "Key findings" },
        { name: "研究结论", color: "#98FB98", description: "Conclusions" },
        { name: "研究不足", color: "#DDA0DD", description: "Limitations" },
      ]),
      outlineConfig: JSON.stringify({
        enabled: true,
        maxDepth: 3,
        includeSummaries: true,
      }),
      proPrompts: "",
      proMessageHistory: "[]",
      proNoteTemplates: "",
      proShortcutShowSidebar: "control+/",
      proShortcutTogglePopup: "control+shift+p",
    };

    for (const [key, value] of Object.entries(defaults)) {
      try {
        const existing = Zotero.Prefs.get(`${config.addonRef}.${key}`);
        if (existing === undefined || existing === null) {
          Zotero.Prefs.set(`${config.addonRef}.${key}`, value);
        }
      } catch {
        Zotero.Prefs.set(`${config.addonRef}.${key}`, value);
      }
    }
  }

  /**
   * Get all Pro settings as a structured object.
   */
  getAllSettings(): ProSettingsData {
    const licenseInfo = getLicenseInfo();
    const categories = this.getAnnotationCategories();
    const outlineConfig = this.getOutlineConfig();
    const promptsStr = Zotero.Prefs.get(`${config.addonRef}.proPrompts`) as string;
    let promptCount = 0;
    try {
      promptCount = promptsStr ? JSON.parse(promptsStr).length : 0;
    } catch {}

    return {
      license: {
        key: licenseInfo.key ? "****" + licenseInfo.key.slice(-4) : "",
        status: licenseInfo.status,
        features: licenseInfo.features,
        expireDate: licenseInfo.expireDate,
        licensee: licenseInfo.licensee,
      },
      annotations: {
        categories,
      },
      outline: outlineConfig,
      prompts: {
        count: promptCount,
        customCount: promptCount - 9, // minus defaults
      },
      shortcuts: {
        showSidebar: Zotero.Prefs.get(`${config.addonRef}.proShortcutShowSidebar`) as string,
        togglePopup: Zotero.Prefs.get(`${config.addonRef}.proShortcutTogglePopup`) as string,
      },
    };
  }

  /**
   * Activate a license key.
   */
  activateLicense(key: string): LicenseInfo {
    return setLicenseKey(key);
  }

  /**
   * Deactivate license.
   */
  deactivateLicense(): void {
    clearLicense();
  }

  /**
   * Check and report license status.
   */
  checkLicense(): {
    isPro: boolean;
    status: string;
    message: string;
  } {
    const info = getLicenseInfo();
    return {
      isPro: info.status === "pro",
      status: info.status,
      message: info.status === "pro"
        ? `Pro license active. ${info.features.length} features available.`
        : info.status === "expired"
        ? "License has expired. Please renew."
        : "No Pro license. Upgrade to unlock all features.",
    };
  }

  /**
   * Get Pro feature list with descriptions.
   */
  getFeatureDescriptions(): Array<{ id: string; name: string; description: string }> {
    return [
      { id: "aiAnnotations", name: "AI 标注", description: "自动生成PDF彩色高亮标注" },
      { id: "aiOutline", name: "AI 大纲", description: "自动解析PDF生成章节大纲" },
      { id: "customPrompts", name: "自定义Prompt", description: "多类型的自定义AI命令" },
      { id: "selectionMenu", name: "选中快捷命令", description: "选中文字弹出翻译/解释/概括" },
      { id: "referenceModes", name: "多参考模式", description: "无参考/段落/页范围/全文四种对话模式" },
      { id: "notesFill", name: "AI 填充笔记", description: "BetterNotes模板联动AI填充" },
      { id: "historySearch", name: "历史搜索", description: "搜索对话历史记录" },
      { id: "multiSource", name: "多参考源", description: "同时选择多个PDF/笔记作为参考" },
    ];
  }

  /**
   * Get annotation categories.
   */
  getAnnotationCategories(): Array<{ name: string; color: string; description: string }> {
    try {
      const raw = Zotero.Prefs.get(`${config.addonRef}.proAnnotationCategories`) as string;
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }

  /**
   * Set annotation categories.
   */
  setAnnotationCategories(cats: Array<{ name: string; color: string; description: string }>): void {
    Zotero.Prefs.set(`${config.addonRef}.proAnnotationCategories`, JSON.stringify(cats));
  }

  /**
   * Get outline configuration.
   */
  getOutlineConfig(): { enabled: boolean; maxDepth: number; includeSummaries: boolean; model?: string } {
    try {
      const raw = Zotero.Prefs.get(`${config.addonRef}.outlineConfig`) as string;
      if (raw) return JSON.parse(raw);
    } catch {}
    return { enabled: true, maxDepth: 3, includeSummaries: true };
  }

  /**
   * Set outline configuration.
   */
  setOutlineConfig(outlineCfg: { enabled: boolean; maxDepth: number; includeSummaries: boolean; model?: string }): void {
    Zotero.Prefs.set(`${config.addonRef}.outlineConfig`, JSON.stringify(outlineCfg));
  }
}
