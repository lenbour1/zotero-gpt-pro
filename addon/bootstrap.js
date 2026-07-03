/**
 * Zotero GPT Pro Bootstrap
 * Updated for Zotero 9 (Firefox 128+) compatibility.
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
  var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
  var windows = Services.wm.getEnumerator("navigator:browser");
  var found = false;
  while (windows.hasMoreElements()) {
    let win = windows.getNext();
    if (win.Zotero) {
      Zotero = win.Zotero;
      found = true;
      break;
    }
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
  Services.scriptloader.loadSubScript(`${rootURI}/chrome/content/scripts/index.js`, ctx);
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) return;
  if (typeof Zotero === "undefined") {
    Zotero = Components.classes["@zotero.org/Zotero;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;
  }
  Zotero.__addonInstance__.hooks.onShutdown();
  Cc["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService).flushBundles();
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
        default: Zotero.logError(`Invalid type for pref '${pref}'`);
      }
    },
  };
  Services.scriptloader.loadSubScript(rootURI + "prefs.js", obj);
}
