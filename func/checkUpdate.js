const https = require('https');
const logger = require("./logger");
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const localPkgPath = path.join(__dirname, "../package.json");
const githubPkgUrl = 'https://raw.githubusercontent.com/Donix-VN/fca-unofficial/main/package.json';

function getRemotePackageJson(url, callback) {
    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const pkg = JSON.parse(data);
                callback(null, pkg);
            } catch (err) {
                callback(err);
            }
        });
    }).on('error', err => callback(err));
}
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
    getRemotePackageJson(githubPkgUrl, async (err, remotePkg) => {
        if (err) {
            logger(`Lỗi khi lấy package.json từ Github: ${err}`, "error");
            return callback(err);
        }
        if (localPkg.version !== remotePkg.version) {
            logger(`Đã có bản mới (${remotePkg.version}) Phiên bản đang dùng (${localPkg.version}). Đang cập nhật...`, "info");
            fs.writeFileSync(localPkgPath, JSON.stringify(remotePkg, null, 2));
            logger(`Đã cập nhật package.json lên phiên bản mới: ${remotePkg.version}`, "info");
            try {
                const { stderr } = await execPromise('npm i @dongdev/fca-unofficial@latest');
                logger(`Đã cập nhật fca lên phiên bản mới nhất: ${remotePkg.version}, khởi động lại để áp dụng.`, "info");
                if (stderr) logger(stderr, "error");
                callback(null);
            } catch (e) {
                logger(`Lỗi khi chạy npm install: ${e.error}. Đang thử tải về từ Github...`, "error");
                try {
                    const { stderr } = await execPromise('npm i https://github.com/DongDev-VN/fca-unofficial');
                    logger(`Đã tải về từ Github thành công: ${remotePkg.version}`, "info");
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
    });
}

module.exports.checkAndUpdateVersion = checkAndUpdateVersion;
