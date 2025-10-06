"use strict";

function getFrom(html, a, b) {
  const i = html.indexOf(a);
  if (i < 0) return;
  const start = i + a.length;
  const j = html.indexOf(b, start);
  return j < 0 ? undefined : html.slice(start, j);
}

module.exports = {
  getFrom
};
