/**
 * Zotero GPT Pro Bootstrap
 * Compatible with Zotero 7 (Firefox 102) and Zotero 9 (Firefox 128+).
 */

if (typeof Zotero == "undefined") {
  var Zotero;
}

var chromeHandle;

async function waitForZotero() {
  if (typeof Zotero != "undefined") {
    await Zotero.initializationPromise;
    return;
  }
  // Zotero 6 legacy path
  try {
    var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
  } catch (e) {
    var { Services } = ChromeUtils.importESModule("resource://gre/modules/Services.sys.mjs");
  }
  var windows = Services.wm.getEnumerator("navigator:browser");
  var found = false;
  while (windows.hasMoreElements()) {
    let win = windows.getNext();
    if (win.Zotero) { Zotero = win.Zotero; found = true; break; }
  }
  if (!found) {
    await new Promise((resolve) => {
      var listener = {
        onOpenWindow: function (aWindow) {
          let domWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
          domWindow.addEventListener("load", function () {
            domWindow.removeEventListener("load", arguments.callee, false);
            if (domWindow.Zotero) { Services.wm.removeListener(listener); Zotero = domWindow.Zotero; resolve(); }
          }, false);
        },
      };
      Services.wm.addListener(listener);
    });
  }
  await Zotero.initializationPromise;
}

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  await waitForZotero();
  if (!rootURI) rootURI = resourceURI.spec;

  if (Zotero.platformMajorVersion >= 102) {
    var aomStartup = Components.classes["@mozilla.org/addons/addon-manager-startup;1"].getService(Components.interfaces.amIAddonManagerStartup);
    var manifestURI = Services.io.newURI(rootURI + "manifest.json");
    chromeHandle = aomStartup.registerChrome(manifestURI, [
      ["content", "__addonRef__", rootURI + "chrome/content/"],
      ["locale", "__addonRef__", "en-US", rootURI + "chrome/locale/en-US/"],
      ["locale", "__addonRef__", "zh-CN", rootURI + "chrome/locale/zh-CN/"],
    ]);
  } else {
    setDefaultPrefs(rootURI);
  }

  const ctx = { rootURI };
  ctx._globalThis = ctx;

  // Zotero sandbox compatibility shims
  ctx.require = function(name) {
    // Provide fallback for CommonJS requires in bundled code
    if (name === "zotero/itemTree") return Zotero.ItemTree;
    if (typeof window !== "undefined" && window[name]) return window[name];
    Zotero.log(`[GPT Pro] require("${name}") not available in sandbox`);
    return {};
  };
  ctx.window = ctx;
  ctx.global = ctx;

  Services.scriptloader.loadSubScript(`${rootURI}/chrome/content/scripts/index.js`, ctx);
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) return;
  if (typeof Zotero === "undefined") {
    Zotero = Components.classes["@zotero.org/Zotero;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;
  }
  try {
    Zotero.__addonInstance__.hooks.onShutdown();
  } catch (e) {}
  try {
    Cc["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService).flushBundles();
  } catch (e) {}
  try { Cu.unload(`${rootURI}/chrome/content/scripts/index.js`); } catch (e) {}
  if (chromeHandle) { chromeHandle.destruct(); chromeHandle = null; }
}

function uninstall(data, reason) {}

function setDefaultPrefs(rootURI) {
  var branch = Services.prefs.getDefaultBranch("");
  var obj = {
    pref(pref, value) {
      switch (typeof value) {
        case "boolean": branch.setBoolPref(pref, value); break;
        case "string": branch.setStringPref(pref, value); break;
        case "number": branch.setIntPref(pref, value); break;
      }
    },
  };
  Services.scriptloader.loadSubScript(rootURI + "prefs.js", obj);
}
