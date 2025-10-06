"use strict";

function getHeaders(url, options, ctx, customHeader) {
  const u = new URL(url);
  const ua = options?.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";
  const referer = options?.referer || "https://www.facebook.com/";
  const origin = referer.replace(/\/+$/, "");
  const contentType = options?.contentType || "application/x-www-form-urlencoded";
  const acceptLang = options?.acceptLanguage || "en-US,en;q=0.9,vi;q=0.8";
  const headers = {
    Host: u.host,
    Origin: origin,
    Referer: referer,
    "User-Agent": ua,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
    "Accept-Language": acceptLang,
    "Accept-Encoding": "gzip, deflate, br",
    "Content-Type": contentType,
    Connection: "keep-alive",
    DNT: "1",
    "Upgrade-Insecure-Requests": "1",
    "sec-ch-ua": "\"Chromium\";v=\"139\", \"Not;A=Brand\";v=\"24\", \"Google Chrome\";v=\"139\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-ch-ua-arch": "\"x86\"",
    "sec-ch-ua-bitness": "\"64\"",
    "sec-ch-ua-full-version-list": "\"Chromium\";v=\"139.0.0.0\", \"Not;A=Brand\";v=\"24.0.0.0\", \"Google Chrome\";v=\"139.0.0.0\"",
    "sec-ch-ua-platform-version": "\"15.0.0\"",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
    "X-Requested-With": "XMLHttpRequest",
    Pragma: "no-cache",
    "Cache-Control": "no-cache"
  };
  if (ctx?.region) headers["X-MSGR-Region"] = ctx.region;
  if (customHeader && typeof customHeader === "object") Object.assign(headers, customHeader);
  return headers;
}

module.exports = { getHeaders };
