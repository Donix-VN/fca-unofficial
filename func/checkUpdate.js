const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

const PACKAGE_NAME = 'fca-unofficial';
// Không thử cài đặt lại trong vòng 10 phút sau lần update gần nhất
const LOCK_TTL_MS = 10 * 60 * 1000;
// Không check quá 1 lần mỗi 12 giờ
const CHECK_TTL_MS = 12 * 60 * 60 * 1000;

const lockPath = path.join(os.tmpdir(), 'fca-unofficial-update.lock');
const statePath = path.join(os.tmpdir(), 'fca-unofficial-update-state.json');

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}
function writeJSON(p, obj) {
  try { fs.writeFileSync(p, JSON.stringify(obj)); } catch { }
}

function isLockFresh() {
  try {
    const st = fs.statSync(lockPath);
    return (Date.now() - st.mtimeMs) < LOCK_TTL_MS;
  } catch { return false; }
}
function acquireLock() {
  if (isLockFresh()) return false;
  try { fs.writeFileSync(lockPath, String(Date.now())); return true; } catch { return false; }
}
function releaseLock() {
  try { fs.unlinkSync(lockPath); } catch { }
}

function semverCompare(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(n => parseInt(n || 0, 10));
  const pb = String(b).replace(/^v/, '').split('.').map(n => parseInt(n || 0, 10));
  for (let i = 0; i < 3; i++) {
    const da = pa[i] || 0, db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

function getLatestVersion(pkgName) {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`;
    https.get(url, res => {
      let d = '';
      res.setEncoding('utf8');
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          resolve(j.version || null);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function runNpmInstallLatest(pkgName, cwd) {
  return new Promise((resolve, reject) => {
    const bin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const child = spawn(bin, ['i', `${pkgName}@latest`], {
      cwd,
      stdio: 'inherit',
      env: process.env
    });
    child.on('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`npm install exited with ${code}`));
    });
    child.on('error', reject);
  });
}

// options: { cwd, pkg, restart }
async function checkUpdate(options = {}) {
  if (global.__FCA_UPDATE_CHECKED__) return;
  global.__FCA_UPDATE_CHECKED__ = true;

  const pkg = options.pkg || PACKAGE_NAME;
  const cwd = options.cwd || process.cwd();
  const shouldRestart = options.restart !== false;

  // Giới hạn tần suất check
  const state = readJSON(statePath) || {};
  const now = Date.now();
  if (state.lastCheck && now - state.lastCheck < CHECK_TTL_MS) return;
  state.lastCheck = now;
  writeJSON(statePath, state);

  // Đọc version hiện tại
  let currentVersion = null;
  const installedPkgJson = path.join(cwd, 'node_modules', pkg, 'package.json');
  const rootPkgJson = path.join(cwd, 'package.json');

  const installed = readJSON(installedPkgJson);
  if (installed && installed.version) {
    currentVersion = installed.version;
  } else {
    // fallback: nếu lib đang là chính dự án
    const root = readJSON(rootPkgJson);
    if (root && root.name === pkg && root.version) {
      currentVersion = root.version;
    }
  }
  if (!currentVersion) return; // Không xác định được version hiện tại => bỏ

  let latestVersion = null;
  try {
    latestVersion = await getLatestVersion(pkg);
  } catch {
    return; // network lỗi => bỏ qua, tránh spam
  }
  if (!latestVersion) return;

  // Nếu đã mới nhất => thôi
  if (semverCompare(currentVersion, latestVersion) >= 0) return;

  // Đã có lock mới => bỏ để tránh loop
  if (!acquireLock()) return;

  try {
    await runNpmInstallLatest(pkg, cwd);

    // Sau khi cài xong, chỉ restart đúng 1 lần
    if (shouldRestart) {
      if (global.__FCA_RESTARTING__) return;
      global.__FCA_RESTARTING__ = true;
      // Dùng exit code riêng để process manager có thể phân biệt
      setTimeout(() => process.exit(222), 300);
    }
  } catch (e) {
    // Không restart khi cài thất bại để tránh loop
  } finally {
    // Không xóa lock ngay để tránh ngay-lập-tức retry sau restart
    // Lock TTL sẽ tự hết hạn
    // releaseLock(); // cố tình KHÔNG gọi
  }
}

module.exports = checkUpdate;
