import { config } from "../package.json";
import { getString, initLocale } from "./modules/locale";
import Views from "./modules/views";
import Utils from "./modules/utils";
import { initValidation } from "./validation/core";
import { initProFeatures } from "./modules/Pro";
import { ToolbarManager } from "./modules/Pro/Toolbar";
import { ConfigPanel } from "./modules/Pro/ConfigPanel";
import Meet from "./modules/Meet/api";

async function onStartup() {
  initValidation(config.addonRef);
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);
  initLocale();

  // Set progress window icon
  ztoolkit.ProgressWindow.setIconURI(
    "default",
    `chrome://${config.addonRef}/content/icons/favicon.png`
  );

  // Core modules
  Zotero[config.addonInstance].views = new Views();
  Zotero[config.addonInstance].utils = new Utils();

  // Initialize Pro features
  try {
    Zotero[config.addonInstance].pro = initProFeatures();
  } catch (e) {
    Zotero.log(`[Zotero GPT Pro] Pro initialization skipped: ${e}`);
  }

  // Register toolbar button and right-click menus
  try {
    const toolbar = new ToolbarManager();
    toolbar.init();
    Zotero[config.addonInstance].toolbar = toolbar;
  } catch (e) {
    Zotero.log(`[Zotero GPT Pro] Toolbar init error: ${e}`);
  }

  // Register AI config panel
  try {
    const configPanel = new ConfigPanel();
    Zotero[config.addonInstance].configPanel = configPanel;
    
    // Add config button to the GPT panel
    window.setTimeout(() => {
      configPanel.addConfigButtonToPanel();
    }, 2000);
  } catch (e) {
    Zotero.log(`[Zotero GPT Pro] Config panel init error: ${e}`);
  }
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  addon.data.alive = false;
  delete Zotero[config.addonInstance];
}

export default {
  onStartup,
  onShutdown,
};
