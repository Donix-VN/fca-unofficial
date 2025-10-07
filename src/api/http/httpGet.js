"use strict";

const log = require("npmlog");
const { get } = require("../../utils/request");
const { getType } = require("../../utils/format");
module.exports = function(defaultFuncs, api, ctx) {
  return function httpGet(url, form, customHeader, callback, notAPI) {
    let resolveFunc = function() {};
    let rejectFunc = function() {};

    const returnPromise = new Promise(function(resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });

    if (
      getType(form) == "Function" ||
      getType(form) == "AsyncFunction"
    ) {
      callback = form;
      form = {};
    }

    if (
      getType(customHeader) == "Function" ||
      getType(customHeader) == "AsyncFunction"
    ) {
      callback = customHeader;
      customHeader = {};
    }

    customHeader = customHeader || {};

    callback =
      callback ||
      function(err, data) {
        if (err) return rejectFunc(err);
        resolveFunc(data);
      };

    if (notAPI) {
      get(url, ctx.jar, form, ctx.globalOptions, ctx, customHeader)
        .then(function(resData) {
          callback(null, resData.data.toString());
        })
        .catch(function(err) {
          log.error("httpGet", err);
          return callback(err);
        });
    } else {
      defaultFuncs
        .get(url, ctx.jar, form, null, customHeader)
        .then(function(resData) {
          callback(null, resData.data.toString());
        })
        .catch(function(err) {
          log.error("httpGet", err);
          return callback(err);
        });
    }

    return returnPromise;
  };
};
