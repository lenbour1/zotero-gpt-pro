/**
 * Pro License Validation Module
 * 
 * This module handles Pro license validation and feature gating.
 * The validate function is called during startup and before each Pro feature usage.
 * 
 * License states:
 * - "free"     : Basic GPT features only
 * - "pro"      : All Pro features enabled
 * - "expired"  : Pro features locked, basic features remain
 */

import { config } from "../../../package.json";

export interface LicenseInfo {
  status: "free" | "pro" | "expired";
  features: string[];
  expireDate?: string;
  licensee?: string;
  key?: string;
}

let _licenseInfo: LicenseInfo = {
  status: "free",
  features: [],
};

/**
 * Initialize validation on plugin startup.
 * Called from hooks.ts onStartup.
 */
export function initValidation(addonRef: string): void {
  const storedKey = Zotero.Prefs.get(`${addonRef}.proLicenseKey`) as string;
  if (storedKey && storedKey.length > 0) {
    try {
      _licenseInfo = validateLicenseKey(storedKey);
      _licenseInfo.key = storedKey;
      Zotero.log(`[Zotero GPT Pro] License validated: ${_licenseInfo.status}`);
    } catch (e) {
      Zotero.log(`[Zotero GPT Pro] License validation failed: ${e}`);
      _licenseInfo = { status: "free", features: [] };
    }
  }
}

/**
 * Validate a license key and return license info.
 * In production, this would verify against a remote server.
 */
export function validateLicenseKey(key: string): LicenseInfo {
  // Local basic validation - checks format and embedded metadata
  // Key format: ZGPT-XXXX-XXXX-XXXX with Base64-encoded payload
  try {
    const parts = key.split("-");
    if (parts.length === 4 && parts[0] === "ZGPT") {
      // Decode payload from last segment
      const payload = atob(parts[3]);
      const data = JSON.parse(payload);
      
      const expireDate = data.exp || "2099-12-31";
      const now = new Date();
      const expDate = new Date(expireDate);
      
      if (expDate < now) {
        return {
          status: "expired",
          features: [],
          expireDate,
          licensee: data.name,
        };
      }
      
      return {
        status: "pro",
        features: getProFeatures(),
        expireDate,
        licensee: data.name,
      };
    }
  } catch (e) {
    // Invalid format or expired
    Zotero.log(`[Zotero GPT Pro] Key parse error: ${e}`);
  }
  
  return { status: "free", features: [] };
}

/**
 * Get list of Pro feature identifiers.
 */
export function getProFeatures(): string[] {
  return [
    "aiAnnotations",
    "aiOutline",
    "customPrompts",
    "selectionMenu",
    "referenceModes",
    "notesFill",
    "historySearch",
    "multiSource",
    "pageScreenshot",
    "obsidianIntegration",
  ];
}

/**
 * Check if a specific Pro feature is enabled.
 */
export function isProFeatureEnabled(feature: string): boolean {
  if (_licenseInfo.status !== "pro") return false;
  return _licenseInfo.features.includes(feature);
}

/**
 * Check if Pro is active (any Pro features available).
 */
export function isPro(): boolean {
  return _licenseInfo.status === "pro";
}

/**
 * Get current license info.
 */
export function getLicenseInfo(): LicenseInfo {
  return { ..._licenseInfo };
}

/**
 * Set/update license key.
 */
export function setLicenseKey(key: string): LicenseInfo {
  _licenseInfo = validateLicenseKey(key);
  Zotero.Prefs.set(`${config.addonRef}.proLicenseKey`, key);
  return _licenseInfo;
}

/**
 * Remove license key (revert to free).
 */
export function clearLicense(): void {
  _licenseInfo = { status: "free", features: [] };
  Zotero.Prefs.clear(`${config.addonRef}.proLicenseKey`);
}

/**
 * Validate Pro access before executing a feature.
 * Throws an error if Pro is not active.
 */
export function requirePro(feature?: string): void {
  if (_licenseInfo.status !== "pro") {
    throw new Error(
      "This feature requires Zotero GPT Pro. Please activate your license."
    );
  }
  if (feature && !_licenseInfo.features.includes(feature)) {
    throw new Error(
      `Pro feature "${feature}" is not available with your license.`
    );
  }
}

export default {
  initValidation,
  validateLicenseKey,
  isPro,
  isProFeatureEnabled,
  getLicenseInfo,
  getProFeatures,
  setLicenseKey,
  clearLicense,
  requirePro,
};
