/**
 * Zotero GPT Pro - Feature Aggregator
 * 
 * This module serves as the entry point for all Pro features.
 * It handles Pro license gating and exposes the API surface.
 */

import { isPro, requirePro, getLicenseInfo, LicenseInfo } from "../../validation/core";
import { config } from "../../../package.json";
import { AnnotationsManager } from "./Annotations";
import { OutlineManager } from "./Outline";
import { PromptsManager, PromptDefinition, PromptType } from "./Prompts";
import { SelectionMenuManager } from "./SelectionMenu";
import { ReferenceManager } from "./Reference";
import { NotesFillManager } from "./NotesFill";
import { ProSettings } from "./Settings";

export interface ProFeatureManagers {
  annotations: AnnotationsManager;
  outline: OutlineManager;
  prompts: PromptsManager;
  selectionMenu: SelectionMenuManager;
  reference: ReferenceManager;
  notesFill: NotesFillManager;
  settings: ProSettings;
}

let _managers: ProFeatureManagers | null = null;

/**
 * Initialize all Pro features.
 * Called after license validation during startup.
 */
export function initProFeatures(): ProFeatureManagers {
  if (_managers) return _managers;

  _managers = {
    annotations: new AnnotationsManager(),
    outline: new OutlineManager(),
    prompts: new PromptsManager(),
    selectionMenu: new SelectionMenuManager(),
    reference: new ReferenceManager(),
    notesFill: new NotesFillManager(),
    settings: new ProSettings(),
  };

  // Initialize managers that need startup setup
  _managers.prompts.init();
  _managers.selectionMenu.init();
  _managers.settings.init();

  Zotero.log(`[Zotero GPT Pro] Pro features initialized, license: ${getLicenseInfo().status}`);
  return _managers;
}

/**
 * Get Pro managers instance, or null if not initialized.
 */
export function getProManagers(): ProFeatureManagers | null {
  return _managers;
}

/**
 * Check if Pro is active and throw if not.
 */
export function guardPro(feature?: string): void {
  requirePro(feature);
  if (!_managers) {
    throw new Error("Pro features are not initialized. Please restart Zotero.");
  }
}

export {
  AnnotationsManager,
  OutlineManager,
  PromptsManager,
  PromptDefinition,
  PromptType,
  SelectionMenuManager,
  ReferenceManager,
  NotesFillManager,
  ProSettings,
  LicenseInfo,
  isPro,
  getLicenseInfo,
};
