"use strict";
const mqtt = require("mqtt");
const WebSocket = require("ws");
const HttpsProxyAgent = require("https-proxy-agent");
const EventEmitter = require("events");
const logger = require("../../../func/logger");
const { parseAndCheckLogin } = require("../../utils/client");
const { buildProxy, buildStream } = require("./detail/buildStream");
const { topics } = require("./detail/constants");
const createParseDelta = require("./core/parseDelta");
const createListenMqtt = require("./core/connectMqtt");
const createGetSeqID = require("./core/getSeqID");
const markDelivery = require("./core/markDelivery");
const getTaskResponseData = require("./core/getTaskResponseData");
const parseDelta = createParseDelta({ markDelivery, parseAndCheckLogin });
const listenMqtt = createListenMqtt({ WebSocket, mqtt, HttpsProxyAgent, buildStream, buildProxy, topics, parseDelta, getTaskResponseData, logger });
const getSeqIDFactory = createGetSeqID({ parseAndCheckLogin, listenMqtt, logger });
module.exports = function (defaultFuncs, api, ctx) {
  const identity = function () { };
  let globalCallback = identity;
  function getSeqIDWrapper() {
    const form = {
      av: ctx.userID,
      queries: JSON.stringify({
        o0: { doc_id: "3336396659757871", query_params: { limit: 1, before: null, tags: ["INBOX"], includeDeliveryReceipts: false, includeSeqID: true } }
      })
    };
    logger("MQTT getSeqID call", "info");
    return getSeqIDFactory(defaultFuncs, api, ctx, globalCallback, form).then(() => {
      logger("MQTT getSeqID done", "info");
    }).catch(e => {
      logger(`MQTT getSeqID error: ${e && e.message ? e.message : e}`, "error");
    });
  }
  function isConnected() {
    return !!(ctx.mqttClient && ctx.mqttClient.connected);
  }
  function unsubAll(cb) {
    if (!isConnected()) return cb && cb();
    let pending = topics.length;
    if (!pending) return cb && cb();
    let done = false;
    topics.forEach(t => {
      ctx.mqttClient.unsubscribe(t, err => {
        const msg = String(err && err.message ? err.message : err || "");
        if (msg && /No subscription existed/i.test(msg)) err = null;
        if (--pending === 0 && !done) {
          done = true;
          cb && cb();
        }
      });
    });
  }
  function endQuietly(next) {
    const finish = () => {
      ctx.mqttClient = undefined;
      ctx.lastSeqId = null;
      ctx.syncToken = undefined;
      ctx.t_mqttCalled = false;
      ctx._ending = false;
      next && next();
    };
    try {
      if (ctx.mqttClient) {
        if (isConnected()) {
          try { ctx.mqttClient.publish("/browser_close", "{}"); } catch (_) { }
        }
        ctx.mqttClient.end(true, finish);
      } else finish();
    } catch (_) {
      finish();
    }
  }
  function delayedReconnect() {
    logger("MQTT reconnect in 2000ms", "info");
    setTimeout(() => getSeqIDWrapper(), 2000);
  }
  function forceCycle() {
    ctx._ending = true;
    logger("MQTT force cycle begin", "warn");
    unsubAll(() => {
      endQuietly(() => {
        delayedReconnect();
      });
    });
  }
  return function (callback) {
    class MessageEmitter extends EventEmitter {
      stopListening(callback2) {
        const cb = callback2 || function () { };
        logger("MQTT stop requested", "info");
        globalCallback = identity;
        if (ctx._autoCycleTimer) {
          clearInterval(ctx._autoCycleTimer);
          ctx._autoCycleTimer = null;
          logger("MQTT auto-cycle cleared", "info");
        }
        ctx._ending = true;
        unsubAll(() => {
          endQuietly(() => {
            logger("MQTT stopped", "info");
            cb();
            delayedReconnect();
          });
        });
      }
      async stopListeningAsync() {
        return new Promise(resolve => { this.stopListening(resolve); });
      }
    }
    const msgEmitter = new MessageEmitter();
    globalCallback = callback || function (error, message) {
      if (error) { logger("MQTT emit error", "error"); return msgEmitter.emit("error", error); }
      msgEmitter.emit("message", message);
    };
    if (!ctx.firstListen) ctx.lastSeqId = null;
    ctx.syncToken = undefined;
    ctx.t_mqttCalled = false;
    if (ctx._autoCycleTimer) {
      clearInterval(ctx._autoCycleTimer);
      ctx._autoCycleTimer = null;
    }
    ctx._autoCycleTimer = setInterval(forceCycle, 60 * 60 * 1000);
    logger("MQTT auto-cycle enabled 3600000ms", "info");
    if (!ctx.firstListen || !ctx.lastSeqId) getSeqIDWrapper();
    else {
      logger("MQTT starting listenMqtt", "info");
      listenMqtt(defaultFuncs, api, ctx, globalCallback);
    }
    api.stopListening = msgEmitter.stopListening;
    api.stopListeningAsync = msgEmitter.stopListeningAsync;
    return msgEmitter;
  };
};
