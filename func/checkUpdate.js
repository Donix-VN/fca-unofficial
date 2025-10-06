const axios = require('axios');
const logger = require("./logger");
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const localPkgPath = path.join(__dirname, "../package.json");
const npmPkgUrl = 'https://registry.npmjs.org/@dongdev/fca-unofficial';

async function checkAndUpdateVersion(callback) {
    const execPromise = (cmd) => new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if (error) return reject({ error, stderr });
            resolve({ stdout, stderr });
        });
    });

    if (!fs.existsSync(localPkgPath)) {
        logger('Không tìm thấy package.json local.', "error");
        return callback(new Error('Không tìm thấy package.json local.'));
    }
    const localPkg = JSON.parse(fs.readFileSync(localPkgPath, 'utf8'));
    logger(`Đang kiểm tra phiên bản...`, "info");
    try {
        const response = await axios.get(npmPkgUrl);
        const remotePkg = response.data;
        if (localPkg.version !== remotePkg['dist-tags'].latest) {
            logger(`Đã có bản mới (${remotePkg['dist-tags'].latest}) Phiên bản đang dùng (${localPkg.version}). Đang cập nhật...`, "info");
            try {
                const { stderr } = await execPromise('npm i @dongdev/fca-unofficial@latest');
                logger(`Đã cập nhật fca lên phiên bản mới nhất: ${remotePkg['dist-tags'].latest}, khởi động lại để áp dụng.`, "info");
                if (stderr) logger(stderr, "error");
                callback(null);
            } catch (e) {
                logger(`Lỗi khi chạy npm install: ${e.error}. Đang thử tải về từ Github...`, "error");
                try {
                    const { stderr } = await execPromise('npm i https://github.com/DongDev-VN/fca-unofficial');
                    logger(`Đã tải về từ Github thành công!`, "info");
                    if (stderr) logger(stderr, "error");
                    callback(null);
                } catch (gitErr) {
                    logger(`Lỗi khi tải về từ Github: ${gitErr.error}`, "error");
                    callback(gitErr.error);
                }
            }
        } else {
            logger('Phiên bản đang dùng đã là mới nhất.', "info");
            callback(null);
        }
    } catch (error) {
        logger(`Lỗi khi kiểm tra và cập nhật phiên bản: ${error}`, "error");
        callback(error);
    }
}

module.exports.checkAndUpdateVersion = checkAndUpdateVersion;