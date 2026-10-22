// App configuration
import "server-only";
import fs from "node:fs";
import { MAM_TOKEN_FILE, SETTINGS_FILE } from "./constants.js";

/**
 * Reads a setting from the settings file, falling back to env var.
 */
function fromSettings(path, envName, fallback) {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
      const value = path.split(".").reduce((obj, key) => obj?.[key], settings);
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
  } catch {
    // Fall through to env var
  }
  return process.env[envName] || fallback;
}

function boolSetting(path, envName, fallback = false) {
  const value = fromSettings(path, envName, fallback);
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function searchCategorySetting() {
  const value = fromSettings("search.defaultCategory", "APP_DEFAULT_SEARCH_CATEGORY", "books");
  return ["books", "audiobooks", "both"].includes(value) ? value : "books";
}

const cfg = {
  appPassword: process.env.APP_PASSWORD || "cheese",
  get qbUrl() { return fromSettings("qbittorrent.url", "APP_QB_URL", "http://qbittorrent:8080"); },
  qbCategory: process.env.APP_QB_CATEGORY || "books",
  get qbBookCategory() { return fromSettings("categories.defaults.books", "APP_QB_BOOK_CATEGORY", process.env.APP_QB_CATEGORY || "books"); },
  get qbAudiobookCategory() { return fromSettings("categories.defaults.audiobooks", "APP_QB_AUDIOBOOK_CATEGORY", "audiobooks"); },
  get qbUser() { return fromSettings("qbittorrent.username", "APP_QB_USERNAME", "admin"); },
  get qbPass() { return fromSettings("qbittorrent.password", "APP_QB_PASSWORD", "adminadmin"); },
  mamUA: process.env.APP_MAM_USER_AGENT || "Scurry/1.0 (+contact)",
  mouseholeEnabled: process.env.MOUSEHOLE_ENABLED === "true",
  mouseholeStateFile: process.env.MOUSEHOLE_STATE_FILE || "secrets/state.json",
  get defaultSearchCategory() { return searchCategorySetting(); },
  get preferEpubOnly() { return boolSetting("search.preferEpubOnly", "APP_PREFER_EPUB_ONLY"); },
  get preferM4b() { return boolSetting("search.preferM4b", "APP_PREFER_M4B"); },
};

export function readMamToken() {
  if (cfg.mouseholeEnabled) {
    try {
      const stateFile = cfg.mouseholeStateFile;
      if (!fs.existsSync(stateFile)) {
        console.warn(`Mousehole state file not found at ${stateFile}, falling back to static token`);
      } else {
        const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
        // URL-decode the token from mousehole's format
        return decodeURIComponent(state.cookie ?? state.currentCookie);
      }
    } catch (err) {
      console.warn("Failed to read from mousehole, falling back to static token:", err.message);
    }
  }
  return fs.readFileSync(MAM_TOKEN_FILE, "utf8").trim();
}

export function isMouseholeMode() {
  return cfg.mouseholeEnabled;
}

export const config = cfg;
