"use strict";

const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const FormData = require("form-data");
const { HttpsProxyAgent } = require("https-proxy-agent");

const headersMod = require("./headers");
const getHeaders = headersMod.getHeaders || headersMod;
const formatMod = require("./format");
const getType = formatMod.getType || formatMod;
const constMod = require("./constants");
const getFrom = constMod.getFrom || constMod;

const jar = new CookieJar();
const client = wrapper(axios.create({
  jar,
  withCredentials: true,
  timeout: 60000,
  validateStatus: s => s >= 200 && s < 600
}));

const delay = ms => new Promise(r => setTimeout(r, ms));

async function requestWithRetry(fn, retries = 3) {
  let err;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); } catch (e) {
      err = e;
      if (i === retries - 1) return e.response ? e.response : Promise.reject(e);
      await delay((1 << i) * 1000 + Math.floor(Math.random() * 200));
    }
  }
  throw err;
}

function cfg(base = {}) {
  const { reqJar, headers, params, agent, timeout } = base;
  return {
    headers,
    params,
    jar: reqJar || jar,
    withCredentials: true,
    timeout: timeout || 60000,
    httpAgent: agent || client.defaults.httpAgent,
    httpsAgent: agent || client.defaults.httpsAgent,
    proxy: false,
    validateStatus: s => s >= 200 && s < 600
  };
}

function cleanGet(url) {
  return requestWithRetry(() => client.get(url, cfg()));
}

function get(url, reqJar, qs, options, ctx, customHeader) {
  const headers = getHeaders(url, options, ctx, customHeader);
  return requestWithRetry(() => client.get(url, cfg({ reqJar, headers, params: qs })));
}

function post(url, reqJar, form, options, ctx, customHeader) {
  const headers = getHeaders(url, options, ctx, customHeader);
  const ct = String(headers["Content-Type"] || headers["content-type"] || "application/x-www-form-urlencoded").toLowerCase();
  let data;
  if (ct.includes("json")) {
    data = JSON.stringify(form || {});
    headers["Content-Type"] = "application/json";
  } else {
    const p = new URLSearchParams();
    if (form && typeof form === "object") {
      for (const k of Object.keys(form)) {
        let v = form[k];
        if (getType(v) === "Object") v = JSON.stringify(v);
        if (Array.isArray(v)) v.forEach(x => p.append(k, x));
        else p.append(k, v);
      }
    }
    data = p.toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }
  return requestWithRetry(() => client.post(url, data, cfg({ reqJar, headers })));
}

function postFormData(url, reqJar, form, qs, options, ctx) {
  const fd = new FormData();
  if (form && typeof form === "object") {
    for (const k of Object.keys(form)) {
      const v = form[k];
      if (Array.isArray(v)) v.forEach(x => fd.append(k, x));
      else fd.append(k, v);
    }
  }
  const headers = { ...getHeaders(url, options, ctx), ...fd.getHeaders() };
  return requestWithRetry(() => client.post(url, fd, cfg({ reqJar, headers, params: qs })));
}

function makeDefaults(html, userID, ctx) {
  let reqCounter = 1;
  const revision = getFrom(html || "", 'revision":', ",") || getFrom(html || "", '"client_revision":', ",") || "";
  function mergeWithDefaults(obj) {
    const base = {
      av: userID,
      __user: userID,
      __req: (reqCounter++).toString(36),
      __rev: revision,
      __a: 1
    };
    if (ctx?.fb_dtsg) base.fb_dtsg = ctx.fb_dtsg;
    if (ctx?.jazoest) base.jazoest = ctx.jazoest;
    if (!obj) return base;
    for (const k of Object.keys(obj)) if (!(k in base)) base[k] = obj[k];
    return base;
  }
  return {
    get: (url, j, qs, ctxx, customHeader = {}) =>
      get(url, j, mergeWithDefaults(qs), ctx?.globalOptions, ctxx || ctx, customHeader),
    post: (url, j, form, ctxx, customHeader = {}) =>
      post(url, j, mergeWithDefaults(form), ctx?.globalOptions, ctxx || ctx, customHeader),
    postFormData: (url, j, form, qs, ctxx) =>
      postFormData(url, j, mergeWithDefaults(form), mergeWithDefaults(qs), ctx?.globalOptions, ctxx || ctx)
  };
}

function setProxy(proxyUrl) {
  if (!proxyUrl) {
    client.defaults.httpAgent = undefined;
    client.defaults.httpsAgent = undefined;
    client.defaults.proxy = false;
    return;
  }
  const agent = new HttpsProxyAgent(proxyUrl);
  client.defaults.httpAgent = agent;
  client.defaults.httpsAgent = agent;
  client.defaults.proxy = false;
}

module.exports = {
  cleanGet,
  get,
  post,
  postFormData,
  jar,
  setProxy,
  makeDefaults,
  client
};
