#!/usr/bin/env node
/* make-og.mjs - renders tools/og/card.html to og.png (1200x630) for link previews.
 * Uses a locally installed Chromium browser in headless mode, so there is no
 * dependency to install. Set CHROME to the browser path if it is not found.
 *   node tools/make-og.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CARD = join(ROOT, "tools", "og", "card.html");
const OUT = join(ROOT, "og.png");

const candidates = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);
const chrome = candidates.find((path) => existsSync(path));
if (!chrome) throw new Error("No Chromium browser found. Set CHROME to its path.");

execFileSync(chrome, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
  "--window-size=1200,630", `--screenshot=${OUT}`, pathToFileURL(CARD).href,
], { stdio: "inherit" });

// Confirm the PNG really is 1200x630 (width and height sit at bytes 16-23).
const png = readFileSync(OUT);
const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
if (width !== 1200 || height !== 630) throw new Error(`og.png is ${width}x${height}, expected 1200x630`);
console.log(`og.png ${width}x${height}, ${Math.round(png.length / 1024)} KB`);
