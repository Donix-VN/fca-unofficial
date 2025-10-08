"use strict";
const logger = require('../../func/logger');

function saveCookies(jar) {
  return res => {
    try {
      const setCookie = res?.headers?.["set-cookie"];
      if (Array.isArray(setCookie) && setCookie.length) {
        const url = res?.request?.res?.responseUrl || (res?.config?.baseURL ? new URL(res.config.url || "/", res.config.baseURL).toString() : res?.config?.url || "https://www.facebook.com");
        for (const c of setCookie) {
          try {
            jar.setCookieSync(c, url);
          } catch { }
        }
      }
    } catch { }
    return res;
  };
}

function getAppState(jar) {
  if (!jar || typeof jar.getCookiesSync !== "function") return [];
  const urls = ["https://www.facebook.com", "https://www.messenger.com"];
  const all = urls.flatMap(u => {
    try { return jar.getCookiesSync(u) || []; } catch { return []; }
  });
  const seen = new Set();
  const out = [];
  for (const c of all) {
    const key = c.key || c.name;
    if (!key) continue;
    const id = key + "|" + (c.domain || "") + "|" + (c.path || "/");
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      key,
      value: c.value,
      domain: c.domain || ".facebook.com",
      path: c.path || "/",
      hostOnly: !!c.hostOnly,
      creation: c.creation || new Date(),
      lastAccessed: c.lastAccessed || new Date(),
      secure: !!c.secure,
      httpOnly: !!c.httpOnly,
      expires: c.expires && c.expires !== "Infinity" ? c.expires : "Infinity"
    });
  }
  return out;
}

function makeParsable(html) {
  const raw = cleanXssi(String(html || ""));
  const split = raw.split(/\}\r?\n\s*\{/);
  if (split.length === 1) return raw;
  return "[" + split.join("},{") + "]";
}

function cleanXssi(t) {
  if (t == null) return "";
  let s = String(t);
  s = s.replace(/^[\uFEFF\xEF\xBB\xBF]+/, "");
  s = s.replace(/^\)\]\}',?\s*/, "");
  s = s.replace(/^\s*for\s*\(;;\);\s*/i, "");
  return s;
}

function parseAndCheckLogin(ctx, http, retryCount = 0) {
  const delay = ms => new Promise(r => setTimeout(r, ms));
  const headerOf = (headers, name) => {
    if (!headers) return;
    const k = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
    return k ? headers[k] : undefined;
  };
  const buildUrl = cfg => {
    try {
      return cfg?.baseURL ? new URL(cfg.url || "/", cfg.baseURL).toString() : cfg?.url || "";
    } catch {
      return cfg?.url || "";
    }
  };

  const formatCookie = (arr, service) => {
    const n = String(arr?.[0] || "");
    const v = String(arr?.[1] || "");
    return `${n}=${v}; Domain=.${service}.com; Path=/; Secure`;
  };

  const maybeAutoLogin = async (resData) => {
    if (ctx.auto_login) {
      const e = new Error("Not logged in.");
      e.error = "Not logged in.";
      e.res = resData;
      throw e;
    }
    if (typeof ctx.performAutoLogin !== "function") {
      const e = new Error("Not logged in.");
      e.error = "Not logged in.";
      e.res = resData;
      throw e;
    }
    ctx.auto_login = true;
    logger("Login session expired", "warn");
    const ok = await ctx.performAutoLogin();
    if (ok) {
      logger("Auto login successful! Restarting...");
      ctx.auto_login = false;
      process.exit(1);
    } else {
      ctx.auto_login = false;
      const e = new Error("Not logged in.");
      e.error = "Not logged in.";
      e.res = resData;
      throw e;
    }
  };
  return async (res) => {
    const status = res?.status ?? 0;
    if (status >= 500 && status < 600) {
      if (retryCount >= 5) {
        const err = new Error("Request retry failed. Check the `res` and `statusCode` property on this error.");
        err.statusCode = status;
        err.res = res?.data;
        err.error = "Request retry failed. Check the `res` and `statusCode` property on this error.";
        throw err;
      }
      const retryTime = Math.floor(Math.random() * 5000);
      await delay(retryTime);
      const url = buildUrl(res?.config);
      const method = String(res?.config?.method || "GET").toUpperCase();
      const ctype = String(headerOf(res?.config?.headers, "content-type") || "").toLowerCase();
      const isMultipart = ctype.includes("multipart/form-data");
      const payload = res?.config?.data;
      const params = res?.config?.params;
      retryCount += 1;
      if (method === "GET") {
        const newData = await http.get(url, ctx.jar, params || null, ctx.globalOptions, ctx);
        return await parseAndCheckLogin(ctx, http, retryCount)(newData);
      }
      if (isMultipart) {
        const newData = await http.postFormData(url, ctx.jar, payload, params, ctx.globalOptions, ctx);
        return await parseAndCheckLogin(ctx, http, retryCount)(newData);
      } else {
        const newData = await http.post(url, ctx.jar, payload, ctx.globalOptions, ctx);
        return await parseAndCheckLogin(ctx, http, retryCount)(newData);
      }
    }
    if (status === 404) return;
    if (status !== 200) {
      const err = new Error("parseAndCheckLogin got status code: " + status + ". Bailing out of trying to parse response.");
      err.statusCode = status;
      err.res = res?.data;
      throw err;
    }
    const resBodyRaw = res?.data;
    const body = typeof resBodyRaw === "string" ? makeParsable(resBodyRaw) : resBodyRaw;
    let parsed;
    try {
      parsed = typeof body === "object" && body !== null ? body : JSON.parse(body);
    } catch (e) {
      const err = new Error("JSON.parse error. Check the `detail` property on this error.");
      err.error = "JSON.parse error. Check the `detail` property on this error.";
      err.detail = e;
      err.res = resBodyRaw;
      throw err;
    }
    const method = String(res?.config?.method || "GET").toUpperCase();
    if (parsed?.redirect && method === "GET") {
      const redirectRes = await http.get(parsed.redirect, ctx.jar, null, ctx.globalOptions, ctx);
      return await parseAndCheckLogin(ctx, http)(redirectRes);
    }
    if (parsed?.jsmods && parsed.jsmods.require && Array.isArray(parsed.jsmods.require[0]) && parsed.jsmods.require[0][0] === "Cookie") {
      parsed.jsmods.require[0][3][0] = String(parsed.jsmods.require[0][3][0] || "").replace("_js_", "");
      const requireCookie = parsed.jsmods.require[0][3];
      await ctx.jar.setCookie(formatCookie(requireCookie, "facebook"), "https://www.facebook.com");
      await ctx.jar.setCookie(formatCookie(requireCookie, "messenger"), "https://www.messenger.com");
    }
    if (parsed?.jsmods && Array.isArray(parsed.jsmods.require)) {
      for (const item of parsed.jsmods.require) {
        if (item[0] === "DTSG" && item[1] === "setToken") {
          ctx.fb_dtsg = item[3][0];
          ctx.ttstamp = "2";
          for (let j = 0; j < ctx.fb_dtsg.length; j++) ctx.ttstamp += ctx.fb_dtsg.charCodeAt(j);
          break;
        }
      }
    }
    if (parsed?.error === 1357001) {
      const err = new Error("Facebook blocked the login");
      err.error = "Not logged in.";
      throw err;
    }
    const resData = parsed;
    const resStr = JSON.stringify(resData);
    if (resStr.includes("XCheckpointFBScrapingWarningController") || resStr.includes("601051028565049")) {
      await maybeAutoLogin(resData);
    }
    if (resStr.includes("https://www.facebook.com/login.php?") || String(parsed?.redirect || "").includes("login.php?")) {
      await maybeAutoLogin(resData);
    }
    if (resStr.includes("1501092823525282")) {
      logger("Bot checkpoint 282 detected, please check the account!", "error");
      process.exit(0);
    }
    if (resStr.includes("828281030927956")) {
      logger("Bot checkpoint 956 detected, please check the account!", "error");
    }
    return parsed;
  };
}

module.exports = {
  saveCookies,
  getAppState,
  parseAndCheckLogin
};
