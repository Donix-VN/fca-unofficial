"use strict";
module.exports = function createEmitAuth({ logger }) {
  return function emitAuth(ctx, api, globalCallback, reason, detail) {
    try { if (ctx._autoCycleTimer) clearInterval(ctx._autoCycleTimer); } catch (_) { }
    try { ctx._ending = true; } catch (_) { }
    try { if (ctx.mqttClient) ctx.mqttClient.end(true); } catch (_) { }
    ctx.mqttClient = undefined;
    ctx.loggedIn = false;

    const msg = detail || reason;
    logger(`auth change -> ${reason}: ${msg}`, "error");

    if (typeof globalCallback === "function") {
      globalCallback({
        type: "account_inactive",
        reason,
        error: msg,
        timestamp: Date.now()
      }, null);
    }
  };
};
