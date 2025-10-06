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

async function checkAndUpdateVersion(callback) {
  try {
    logger("Đang kiểm tra phiên bản...", "info");
    const latest = (await execPromise(`npm view ${pkgName} version`)).stdout.trim();
    const installed = getInstalledVersion();
    if (!installed || installed !== latest) {
      logger(`Đã có bản mới (${latest}) Phiên bản đang dùng (${installed || "chưa cài"}). Đang cập nhật...`, "info");
      try {
        const { stderr } = await execPromise(`npm i ${pkgName}@latest`);
        if (stderr) logger(stderr, "error");
        logger(`Đã cập nhật fca lên phiên bản mới nhất: ${latest}, khởi động lại để áp dụng.`, "info");
        callback(null);
      } catch (e) {
        logger(`Lỗi khi chạy npm install: ${e.error || e}. Đang thử tải về từ Github...`, "error");
        try {
          const { stderr } = await execPromise("npm i https://github.com/DongDev-VN/fca-unofficial");
          if (stderr) logger(stderr, "error");
          logger(`Đã tải về từ Github thành công: ${latest}`, "info");
          callback(null);
        } catch (gitErr) {
          logger(`Lỗi khi tải về từ Github: ${gitErr.error || gitErr}`, "error");
          callback(gitErr.error || gitErr);
        }
      }
    } else {
      logger("Phiên bản đang dùng đã là mới nhất.", "info");
      callback(null);
    }
  } catch (err) {
    logger(`Lỗi khi kiểm tra phiên bản: ${err}`, "error");
    callback(err);
  }
}

module.exports.checkAndUpdateVersion = checkAndUpdateVersion;
