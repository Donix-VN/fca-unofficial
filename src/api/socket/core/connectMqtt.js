"use strict";
const { formatID } = require("../../../utils/format");
module.exports = function createListenMqtt(deps) {
  const { WebSocket, mqtt, HttpsProxyAgent, buildStream, buildProxy, topics, parseDelta, getTaskResponseData, logger } = deps;
  return function listenMqtt(defaultFuncs, api, ctx, globalCallback) {
    const chatOn = ctx.globalOptions.online;
    const foreground = false;
    const sessionID = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1;
    const username = {
      u: ctx.userID,
      s: sessionID,
      chat_on: chatOn,
      fg: foreground,
      d: ctx.clientId,
      ct: "websocket",
      aid: 219994525426954,
      aids: null,
      mqtt_sid: "",
      cp: 3,
      ecp: 10,
      st: [],
      pm: [],
      dc: "",
      no_auto_fg: true,
      gas: null,
      pack: [],
      p: null,
      php_override: ""
    };
    const cookies = api.getCookies();
    let host;
    if (ctx.mqttEndpoint) {
      host = `${ctx.mqttEndpoint}&sid=${sessionID}&cid=${ctx.clientId}`;
    } else if (ctx.region) {
      host = `wss://edge-chat.facebook.com/chat?region=${ctx.region.toLowerCase()}&sid=${sessionID}&cid=${ctx.clientId}`;
    } else {
      host = `wss://edge-chat.facebook.com/chat?sid=${sessionID}&cid=${ctx.clientId}`;
    }
    const options = {
      clientId: "mqttwsclient",
      protocolId: "MQIsdp",
      protocolVersion: 3,
      username: JSON.stringify(username),
      clean: true,
      wsOptions: {
        headers: {
          Cookie: cookies,
          Origin: "https://www.facebook.com",
          "User-Agent": ctx.globalOptions.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
          Referer: "https://www.facebook.com/",
          Host: "edge-chat.facebook.com",
          Connection: "Upgrade",
          Pragma: "no-cache",
          "Cache-Control": "no-cache",
          Upgrade: "websocket",
          "Sec-WebSocket-Version": "13",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "vi,en;q=0.9",
          "Sec-WebSocket-Extensions": "permessage-deflate; client_max_window_bits"
        },
        origin: "https://www.facebook.com",
        protocolVersion: 13,
        binaryType: "arraybuffer"
      },
      keepalive: 30,
      reschedulePings: true,
      reconnectPeriod: 1000,
      connectTimeout: 5000
    };
    if (ctx.globalOptions.proxy !== undefined) {
      const agent = new HttpsProxyAgent(ctx.globalOptions.proxy);
      options.wsOptions.agent = agent;
    }
    ctx.mqttClient = new mqtt.Client(() => buildStream(options, new WebSocket(host, options.wsOptions), buildProxy()), options);
    const mqttClient = ctx.mqttClient;
    global.mqttClient = mqttClient;
    mqttClient.on("error", function (err) {
      const msg = String(err && err.message ? err.message : err || "");
      if (ctx._ending && /No subscription existed/i.test(msg)) {
        logger("MQTT ignore unsubscribe error during shutdown", "warn");
        return;
      }
      logger(`MQTT error: ${msg}`, "error");
      mqttClient.end();
      logger("MQTT autoReconnect listenMqtt() in 2000ms", "warn");
      setTimeout(() => listenMqtt(defaultFuncs, api, ctx, globalCallback), 2000);
    });
    mqttClient.on("connect", function () {
      if (process.env.OnStatus === undefined) {
        logger("fca-unoffcial premium", "info");
        process.env.OnStatus = true;
      }
      topics.forEach(topicsub => mqttClient.subscribe(topicsub));
      let topic;
      const queue = { sync_api_version: 11, max_deltas_able_to_process: 100, delta_batch_size: 500, encoding: "JSON", entity_fbid: ctx.userID, initial_titan_sequence_id: ctx.lastSeqId, device_params: null };
      if (ctx.syncToken) {
        topic = "/messenger_sync_get_diffs";
        queue.last_seq_id = ctx.lastSeqId;
        queue.sync_token = ctx.syncToken;
      } else {
        topic = "/messenger_sync_create_queue";
        queue.initial_titan_sequence_id = ctx.lastSeqId;
        queue.device_params = null;
      }
      mqttClient.publish(topic, JSON.stringify(queue), { qos: 1, retain: false });
      mqttClient.publish("/foreground_state", JSON.stringify({ foreground: chatOn }), { qos: 1 });
      mqttClient.publish("/set_client_settings", JSON.stringify({ make_user_available_when_in_foreground: true }), { qos: 1 });
      const rTimeout = setTimeout(function () {
        mqttClient.end();
        listenMqtt(defaultFuncs, api, ctx, globalCallback);
      }, 5000);
      ctx.tmsWait = function () {
        clearTimeout(rTimeout);
        ctx.globalOptions.emitReady ? globalCallback({ type: "ready", error: null }) : "";
        delete ctx.tmsWait;
      };
    });
    mqttClient.on("message", function (topic, message, _packet) {
      try {
        let jsonMessage = Buffer.isBuffer(message) ? Buffer.from(message).toString() : message;
        try {
          jsonMessage = JSON.parse(jsonMessage);
        } catch (e) {
          jsonMessage = {};
        }
        if (jsonMessage.type === "jewel_requests_add") {
          globalCallback(null, { type: "friend_request_received", actorFbId: jsonMessage.from.toString(), timestamp: Date.now().toString() });
        } else if (jsonMessage.type === "jewel_requests_remove_old") {
          globalCallback(null, { type: "friend_request_cancel", actorFbId: jsonMessage.from.toString(), timestamp: Date.now().toString() });
        } else if (topic === "/t_ms") {
          if (ctx.tmsWait && typeof ctx.tmsWait == "function") {
            ctx.tmsWait();
          }
          if (jsonMessage.firstDeltaSeqId && jsonMessage.syncToken) {
            ctx.lastSeqId = jsonMessage.firstDeltaSeqId;
            ctx.syncToken = jsonMessage.syncToken;
          }
          if (jsonMessage.lastIssuedSeqId) {
            ctx.lastSeqId = parseInt(jsonMessage.lastIssuedSeqId);
          }
          for (const i in jsonMessage.deltas) {
            const delta = jsonMessage.deltas[i];
            parseDelta(defaultFuncs, api, ctx, globalCallback, { delta });
          }
        } else if (topic === "/thread_typing" || topic === "/orca_typing_notifications") {
          const typ = { type: "typ", isTyping: !!jsonMessage.state, from: jsonMessage.sender_fbid.toString(), threadID: formatID((jsonMessage.thread || jsonMessage.sender_fbid).toString()) };
          globalCallback(null, typ);
        } else if (topic === "/orca_presence") {
          if (!ctx.globalOptions.updatePresence) {
            for (const i in jsonMessage.list) {
              const data = jsonMessage.list[i];
              const userID = data["u"];
              const presence = { type: "presence", userID: userID.toString(), timestamp: data["l"] * 1000, statuses: data["p"] };
              globalCallback(null, presence);
            }
          }
        } else if (topic == "/ls_resp") {
          const parsedPayload = JSON.parse(jsonMessage.payload);
          const reqID = jsonMessage.request_id;
          if (ctx["tasks"].has(reqID)) {
            const taskData = ctx["tasks"].get(reqID);
            const { type: taskType, callback: taskCallback } = taskData;
            const taskRespData = getTaskResponseData(taskType, parsedPayload);
            if (taskRespData == null) {
              taskCallback("error", null);
            } else {
              taskCallback(null, Object.assign({ type: taskType, reqID: reqID }, taskRespData));
            }
          }
        }
      } catch (ex) {
        return;
      }
    });
    mqttClient.on("close", function () { });
    mqttClient.on("disconnect", () => { });
  };
};
