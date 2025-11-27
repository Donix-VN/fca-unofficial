"use strict";
module.exports = function createEmitAuth({ logger }) {
  return function emitAuth(ctx, api, globalCallback, reason, detail) {
    // Clean up all timers
    try {
      if (ctx._autoCycleTimer) {
        clearInterval(ctx._autoCycleTimer);
        ctx._autoCycleTimer = null;
      }
    } catch (_) { }
    try {
      if (ctx._reconnectTimer) {
        clearTimeout(ctx._reconnectTimer);
        ctx._reconnectTimer = null;
      }
    } catch (_) { }

    try {
      ctx._ending = true;
      ctx._cycling = false;
    } catch (_) { }

    // Clean up MQTT client
    try {
      if (ctx.mqttClient) {
        ctx.mqttClient.removeAllListeners();
        if (ctx.mqttClient.connected) {
          ctx.mqttClient.end(true);
        }
      }
    } catch (_) { }

    ctx.mqttClient = undefined;
    ctx.loggedIn = false;

    const msg = detail || reason;
    logger(`auth change -> ${reason}: ${msg}`, "error");

    if (typeof globalCallback === "function") {
      try {
        globalCallback({
          type: "account_inactive",
          reason,
          error: msg,
          timestamp: Date.now()
        }, null);
      } catch (cbErr) {
        logger(`emitAuth callback error: ${cbErr && cbErr.message ? cbErr.message : String(cbErr)}`, "error");
      }
    }
  };
};
