import { config } from "../package.json";
import { getString, initLocale } from "./modules/locale";
import Views from "./modules/views";
import Utils from "./modules/utils";
import { initValidation } from "./validation/core";
import { initProFeatures } from "./modules/Pro";
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
    `chrome://${config.addonRef}/content/icons/gpt.png`
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

  // Initialize sidebar after UI is ready
  window.setTimeout(async () => {
    try {
      const { SidebarManager } = await import("./modules/Pro/Sidebar");
      const sidebar = new SidebarManager();
      sidebar.init();
      Zotero[config.addonInstance].sidebar = sidebar;
    } catch (e) {
      Zotero.log(`[Zotero GPT Pro] Sidebar init error: ${e}`);
    }
  }, 1000);
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
