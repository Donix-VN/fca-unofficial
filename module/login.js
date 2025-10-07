"use strict";
const { getType } = require("../src/utils/format");
const { setOptions } = require("./options");
const { loadConfig } = require("./config");
const { config } = loadConfig();
if (config.autoUpdate) require("../func/checkUpdate").checkAndUpdateVersion(() => {});
global.fca = { config };
const loginHelper = require("./loginHelper");

function login(loginData, options, callback) {
  if (getType(options) === "Function" || getType(options) === "AsyncFunction") {
    callback = options;
    options = {};
  }
  const globalOptions = {
    selfListen: false,
    selfListenEvent: false,
    listenEvents: false,
    listenTyping: false,
    updatePresence: false,
    forceLogin: false,
    autoMarkDelivery: true,
    autoMarkRead: false,
    autoReconnect: true,
    online: true,
    emitReady: false,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
  };
  setOptions(globalOptions, options);
  let prCallback = null;
  if (getType(callback) !== "Function" && getType(callback) !== "AsyncFunction") {
    let rejectFunc = null;
    let resolveFunc = null;
    var returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });
    prCallback = function (error, api) {
      if (error) return rejectFunc(error);
      return resolveFunc(api);
    };
    callback = prCallback;
  }
  loginHelper(loginData.appState, loginData.Cookie,loginData.email, loginData.password, globalOptions, callback, prCallback);
  return returnPromise;
}
module.exports = login;
