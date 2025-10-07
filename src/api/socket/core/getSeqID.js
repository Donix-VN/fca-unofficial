"use strict";
const { getType } = require("../../../utils/format");
const { parseAndCheckLogin } = require("../../../utils/client");
module.exports = function createGetSeqID(deps) {
  const { listenMqtt } = deps;
  return function getSeqID(defaultFuncs, api, ctx, globalCallback, form) {
    ctx.t_mqttCalled = false;
    return defaultFuncs.post("https://www.facebook.com/api/graphqlbatch/", ctx.jar, form).then(parseAndCheckLogin(ctx, defaultFuncs)).then(resData => {
      if (getType(resData) !== "Array") throw { error: "Not logged in", res: resData };
      if (!Array.isArray(resData) || !resData.length) return;
      const lastRes = resData[resData.length - 1];
      if (lastRes && lastRes.successful_results === 0) return;
      const syncSeqId = resData[0] && resData[0].o0 && resData[0].o0.data && resData[0].o0.data.viewer && resData[0].o0.data.viewer.message_threads && resData[0].o0.data.viewer.message_threads.sync_sequence_id;
      if (syncSeqId) {
        ctx.lastSeqId = syncSeqId;
        listenMqtt(defaultFuncs, api, ctx, globalCallback);
      } else {
        throw { error: "getSeqId: no sync_sequence_id found.", res: resData };
      }
    }).catch(err => {
      if (getType(err) === "Object" && err.error === "Not logged in") ctx.loggedIn = false;
      return globalCallback(err);
    });
  };
};
