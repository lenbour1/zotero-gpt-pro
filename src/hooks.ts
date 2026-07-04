import { config } from "../package.json";
import { getString, initLocale } from "./modules/locale";
import Views from "./modules/views";
import Utils from "./modules/utils";
import { initValidation } from "./validation/core";
import { initProFeatures } from "./modules/Pro";

async function onStartup() {
  initValidation(config.addonRef);
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);
  initLocale();

  ztoolkit.ProgressWindow.setIconURI(
    "default",
    `chrome://${config.addonRef}/content/icons/gpt.png`
  );

  Zotero[config.addonInstance].views = new Views();
  Zotero[config.addonInstance].utils = new Utils();

  try {
    Zotero[config.addonInstance].pro = initProFeatures();
  } catch (e) {
    Zotero.log(`[GPT Pro] init skipped: ${e}`);
  }
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  addon.data.alive = false;
  delete Zotero[config.addonInstance];
}

export default { onStartup, onShutdown };
