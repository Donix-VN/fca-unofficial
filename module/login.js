"use strict";
const utils = require("../src/utils");
const { setOptions } = require("./options");
const { loadConfig } = require("./config");
const loginHelper = require("./loginHelper");
const { config } = loadConfig();
global.fca = { config };
function login(loginData, options, callback) {
  if (utils.getType(options) === "Function" || utils.getType(options) === "AsyncFunction") {
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
  if (utils.getType(callback) !== "Function" && utils.getType(callback) !== "AsyncFunction") {
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
