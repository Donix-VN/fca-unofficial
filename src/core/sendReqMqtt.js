"use strict";

function lsRequest(ctx, payload, options, callback) {
  return new Promise((resolve, reject) => {
    const cb = typeof options === "function" ? options : callback;
    const opts = typeof options === "object" && options ? options : {};
    if (!ctx || !ctx.mqttClient) {
      const err = new Error("Not connected to MQTT");
      if (cb) cb(err);
      return reject(err);
    }
    if (typeof ctx.wsReqNumber !== "number") ctx.wsReqNumber = 0;
    const reqID = typeof opts.request_id === "number" ? opts.request_id : ++ctx.wsReqNumber;
    const timeoutMs = typeof opts.timeout === "number" ? opts.timeout : 20000;
    const qos = typeof opts.qos === "number" ? opts.qos : 1;
    const retain = !!opts.retain;
    const reqTopic = "/ls_req";
    const respTopic = opts.respTopic || "/ls_resp";
    const form = JSON.stringify({
      app_id: opts.app_id || "",
      payload: typeof payload === "string" ? payload : JSON.stringify(payload),
      request_id: reqID,
      type: opts.type == null ? 3 : opts.type
    });
    let timer = null;
    const handleRes = (topic, message) => {
      if (topic !== respTopic) return;
      let msg;
      try {
        msg = JSON.parse(message.toString());
      } catch {
        return;
      }
      if (msg.request_id !== reqID) return;
      if (typeof opts.filter === "function" && !opts.filter(msg)) return;
      ctx.mqttClient.removeListener("message", handleRes);
      if (timer) clearTimeout(timer);
      try {
        msg.payload = typeof msg.payload === "string" ? JSON.parse(msg.payload) : msg.payload;
      } catch { }
      const out = { success: true, response: msg.payload, raw: msg };
      if (cb) cb(null, out);
      resolve(out);
    };
    ctx.mqttClient.on("message", handleRes);
    timer = setTimeout(() => {
      ctx.mqttClient.removeListener("message", handleRes);
      const err = new Error("MQTT response timeout");
      if (cb) cb(err);
      reject(err);
    }, timeoutMs);
    ctx.mqttClient.publish(reqTopic, form, { qos, retain }, (err) => {
      if (err) {
        if (timer) clearTimeout(timer);
        ctx.mqttClient.removeListener("message", handleRes);
        if (cb) cb(err);
        reject(err);
      }
    });
  });
};

module.exports = sendReqMqtt;
