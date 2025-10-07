// func/checkUpdate.js
const logger = require("./logger");
const fs = require("fs");
const { exec } = require("child_process");
const pkgName = "@dongdev/fca-unofficial";

function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) return reject({ error, stderr });
      resolve({ stdout, stderr });
    });
  });
}

function getInstalledVersion() {
  try {
    const p = require.resolve(`${pkgName}/package.json`, { paths: [process.cwd(), __dirname] });
    return JSON.parse(fs.readFileSync(p, "utf8")).version;
  } catch {
    return null;
  }
}

async function _checkAndUpdateVersionImpl() {
  logger("Checking version...", "info");
  const latest = (await execPromise(`npm view ${pkgName} version`)).stdout.trim();
  const installed = getInstalledVersion();
  if (!installed || installed !== latest) {
    logger(`New version available (${latest}). Current version (${installed || "not installed"}). Updating...`, "info");
    try {
      const { stderr } = await execPromise(`npm i ${pkgName}@latest`);
      if (stderr) logger(stderr, "error");
      logger(`Updated fca to the latest version: ${latest}, Restart to apply`, "info");
      process.exit(1);
    } catch (e) {
      logger(`Error running npm install: ${e.error || e}. Trying to install from GitHub...`, "error");
      try {
        const { stderr } = await execPromise("npm i https://github.com/Donix-VN/fca-unofficial");
        if (stderr) logger(stderr, "error");
        logger(`Installed from GitHub successfully: ${latest}`, "info");
        return;
      } catch (gitErr) {
        logger(`Error installing from GitHub: ${gitErr.error || gitErr}`, "error");
        throw (gitErr.error || gitErr);
      }
    }
  } else {
    logger(`You're already on the latest version - ${latest}`, "info");
    return;
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
