const axios = require("axios");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const FormData = require("form-data");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { Readable } = require("stream");

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

function toStringVal(v) {
  if (v === undefined || v === null) return "";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

function isStream(v) {
  return v && typeof v === "object" && typeof v.pipe === "function" && typeof v.on === "function";
}

function isBlobLike(v) {
  return v && typeof v.arrayBuffer === "function" && (typeof v.type === "string" || typeof v.name === "string");
}

function isPairArrayList(arr) {
  return Array.isArray(arr) && arr.length > 0 && arr.every(x => Array.isArray(x) && x.length === 2 && typeof x[0] === "string");
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
        if (isPairArrayList(v)) {
          for (const [kk, vv] of v) p.append(`${k}[${kk}]`, toStringVal(vv));
          continue;
        }
        if (Array.isArray(v)) {
          for (const x of v) {
            if (Array.isArray(x) && x.length === 2 && typeof x[1] !== "object") p.append(k, toStringVal(x[1]));
            else p.append(k, toStringVal(x));
          }
          continue;
        }
        if (getType(v) === "Object") v = JSON.stringify(v);
        p.append(k, toStringVal(v));
      }
    }
    data = p.toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }
  return requestWithRetry(() => client.post(url, data, cfg({ reqJar, headers })));
}

async function postFormData(url, reqJar, form, qs, options, ctx) {
  const fd = new FormData();
  if (form && typeof form === "object") {
    for (const k of Object.keys(form)) {
      const v = form[k];
      if (v === undefined || v === null) continue;
      if (isPairArrayList(v)) {
        for (const [kk, vv] of v) fd.append(`${k}[${kk}]`, typeof vv === "object" && !Buffer.isBuffer(vv) && !isStream(vv) ? JSON.stringify(vv) : vv);
        continue;
      }
      if (Array.isArray(v)) {
        for (const x of v) {
          if (Array.isArray(x) && x.length === 2 && x[1] && typeof x[1] === "object" && !Buffer.isBuffer(x[1]) && !isStream(x[1])) {
            fd.append(k, x[0], x[1]);
          } else if (Array.isArray(x) && x.length === 2 && typeof x[1] !== "object") {
            fd.append(k, toStringVal(x[1]));
          } else if (x && typeof x === "object" && "value" in x && "options" in x) {
            fd.append(k, x.value, x.options || {});
          } else if (isStream(x) || Buffer.isBuffer(x) || typeof x === "string") {
            fd.append(k, x);
          } else if (isBlobLike(x)) {
            const buf = Buffer.from(await x.arrayBuffer());
            fd.append(k, buf, { filename: x.name || k, contentType: x.type || undefined });
          } else {
            fd.append(k, JSON.stringify(x));
          }
        }
        continue;
      }
      if (v && typeof v === "object" && "value" in v && "options" in v) {
        fd.append(k, v.value, v.options || {});
        continue;
      }
      if (isStream(v) || Buffer.isBuffer(v) || typeof v === "string") {
        fd.append(k, v);
        continue;
      }
      if (isBlobLike(v)) {
        const buf = Buffer.from(await v.arrayBuffer());
        fd.append(k, buf, { filename: v.name || k, contentType: v.type || undefined });
        continue;
      }
      if (typeof v === "number" || typeof v === "boolean") {
        fd.append(k, toStringVal(v));
        continue;
      }
      fd.append(k, JSON.stringify(v));
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
