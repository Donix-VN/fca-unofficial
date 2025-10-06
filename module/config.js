const fs = require("fs");
const path = require("path");
const logger = require("../func/logger");
const defaultConfig = {
  autoUpdate: true,
  mqtt: { enabled: true, reconnectInterval: 3600 },
  email: "",
  password: "",
  twofactor: "",
};
function loadConfig() {
  const configPath = path.join(process.cwd(), "fca-config.json");
  let config;
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    config = defaultConfig;
  } else {
    try {
      const fileContent = fs.readFileSync(configPath, "utf8");
      config = JSON.parse(fileContent);
      config = Object.assign({}, defaultConfig, config);
    } catch (err) {
      logger("Error reading config file, using defaults", "error");
      config = defaultConfig;
    }
  }
  return { config, configPath };
}
module.exports = { loadConfig, defaultConfig };
