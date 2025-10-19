// func/checkUpdate.js
const logger = require("./logger");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const pkgName = "@dongdev/fca-unofficial";

const TEMP_DIR = path.join(process.cwd(), "temp");
const LOCK_FILE = path.join(TEMP_DIR, ".fca-update-lock.json");
const RESTART_COOLDOWN_MS = 10 * 60 * 1000;

function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: process.cwd() }, (error, stdout, stderr) => {
      if (error) return reject({ error, stderr });
      resolve({ stdout, stderr });
    });
  });
}

function ensureTemp() {
  try { fs.mkdirSync(TEMP_DIR, { recursive: true }); } catch { }
}

function readLock() {
  try { return JSON.parse(fs.readFileSync(LOCK_FILE, "utf8")); } catch { return null; }
}

function writeLock(data) {
  ensureTemp();
  try { fs.writeFileSync(LOCK_FILE, JSON.stringify(data)); } catch { }
}

function clearLock() {
  try { fs.unlinkSync(LOCK_FILE); } catch { }
}

function getInstalledVersion() {
  try {
    const p = require.resolve(`${pkgName}/package.json`, { paths: [process.cwd(), __dirname] });
    return JSON.parse(fs.readFileSync(p, "utf8")).version;
  } catch {
    return null;
  }
}

async function getInstalledVersionByNpm() {
  try {
    const { stdout } = await execPromise(`npm ls ${pkgName} --json --depth=0`);
    const json = JSON.parse(stdout || "{}");
    const v = json?.dependencies?.[pkgName]?.version;
    return v || null;
  } catch {
    return null;
  }
}

async function _checkAndUpdateVersionImpl() {
  const lock = readLock();
  if (lock && Date.now() - (lock.ts || 0) < RESTART_COOLDOWN_MS) {
    logger("Skip auto-update due to recent attempt", "info");
    return;
  }

  logger("Checking version...", "info");
  const latest = (await execPromise(`npm view ${pkgName} version`)).stdout.trim();

  let installed = getInstalledVersion();
  if (!installed) installed = await getInstalledVersionByNpm();

  if (installed && installed === latest) {
    clearLock();
    logger(`You're already on the latest version - ${latest}`, "info");
    return;
  }

  if (lock && lock.latest === latest && Date.now() - (lock.ts || 0) < RESTART_COOLDOWN_MS) {
    logger("Update already attempted recently, skipping restart loop", "info");
    return;
  }

  logger(`New version available (${latest}). Current version (${installed || "not installed"}). Updating...`, "info");

  try {
    const { stderr } = await execPromise(`npm i ${pkgName}@latest`);
    if (stderr) logger(stderr, "error");
  } catch (e) {
    logger(`Error running npm install: ${e.error || e}. Trying to install from GitHub...`, "error");
    try {
      const { stderr } = await execPromise("npm i https://github.com/Donix-VN/fca-unofficial");
      if (stderr) logger(stderr, "error");
    } catch (gitErr) {
      writeLock({ ts: Date.now(), latest, status: "failed" });
      logger(`Error installing from GitHub: ${gitErr.error || gitErr}`, "error");
      throw (gitErr.error || gitErr);
    }
  }

  let after = getInstalledVersion();
  if (!after) after = await getInstalledVersionByNpm();

  if (after && after === latest) {
    writeLock({ ts: Date.now(), latest, status: "updated" });
    logger(`Updated fca to the latest version: ${latest}, Restart to apply`, "info");
    process.exit(1);
  } else {
    writeLock({ ts: Date.now(), latest, status: "mismatch" });
    logger(`Installed but version mismatch (have: ${after || "unknown"}, want: ${latest}). Skip restart to avoid loop`, "error");
  }
}

function checkAndUpdateVersion(callback) {
  if (typeof callback === "function") {
    _checkAndUpdateVersionImpl().then(() => callback(null)).catch(err => callback(err));
    return;
  }
  return _checkAndUpdateVersionImpl();
}

module.exports = { checkAndUpdateVersion };
