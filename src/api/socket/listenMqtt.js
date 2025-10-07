"use strict";
const mqtt = require("mqtt");
const WebSocket = require("ws");
const HttpsProxyAgent = require("https-proxy-agent");
const EventEmitter = require("events");
const logger = require("../../../func/logger.js");
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
const getSeqIDFactory = createGetSeqID({ listenMqtt });
module.exports = function (defaultFuncs, api, ctx) {
  const identity = function () {};
  let globalCallback = identity;
  function getSeqIDWrapper() {
    const form = {
      av: ctx.globalOptions.pageID,
      queries: JSON.stringify({
        o0: {
          doc_id: "3336396659757871",
          query_params: {
            limit: 1,
            before: null,
            tags: ["INBOX"],
            includeDeliveryReceipts: false,
            includeSeqID: true
          }
        }
      })
    };
    return getSeqIDFactory(defaultFuncs, api, ctx, globalCallback, form);
  }
  return function (callback) {
    class MessageEmitter extends EventEmitter {
      stopListening(callback2) {
        const cb = callback2 || function () {};
        globalCallback = identity;
        if (ctx.mqttClient) {
          ctx.mqttClient.unsubscribe("/webrtc");
          ctx.mqttClient.unsubscribe("/rtc_multi");
          ctx.mqttClient.unsubscribe("/onevc");
          ctx.mqttClient.publish("/browser_close", "{}");
          ctx.mqttClient.end(false, function (...data) {
            cb(data);
            ctx.mqttClient = undefined;
          });
        }
      }
      async stopListeningAsync() {
        return new Promise(resolve => {
          this.stopListening(resolve);
        });
      }
    }
    const msgEmitter = new MessageEmitter();
    globalCallback = callback || function (error, message) {
      if (error) {
        return msgEmitter.emit("error", error);
      }
      msgEmitter.emit("message", message);
    };
    if (!ctx.firstListen) ctx.lastSeqId = null;
    ctx.syncToken = undefined;
    ctx.t_mqttCalled = false;
    if (!ctx.firstListen || !ctx.lastSeqId) {
      getSeqIDWrapper();
    } else {
      listenMqtt(defaultFuncs, api, ctx, globalCallback);
    }
    api.stopListening = msgEmitter.stopListening;
    api.stopListeningAsync = msgEmitter.stopListeningAsync;
    return msgEmitter;
  };
};
