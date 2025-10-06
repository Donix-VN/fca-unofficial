"use strict";

const { Transform } = require("stream");
const Duplexify = require("duplexify");

let WebSocket_Global;
function buildProxy() {
  const Proxy = new Transform({
    objectMode: false,
    transform(chunk, enc, next) {
      if (WebSocket_Global.readyState !== WebSocket.OPEN) {
        return next();
      }
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
      try {
        WebSocket_Global.send(data);
        next();
      } catch (err) {
        console.error("WebSocket send error:", err);
        next(err);
      }
    },
    flush(done) {
      if (WebSocket_Global.readyState === WebSocket.OPEN) {
        WebSocket_Global.close();
      }
      done();
    },
    writev(chunks, cb) {
      try {
        for (const { chunk } of chunks) {
          this.push(
            Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8")
          );
        }
        cb();
      } catch (err) {
        console.error("Writev error:", err);
        cb(err);
      }
    }
  });

  return Proxy;
}
function buildStream(options, WebSocket, Proxy) {
  const Stream = Duplexify(undefined, undefined, options);
  Stream.socket = WebSocket;
  let pingInterval;
  let reconnectTimeout;
  const clearTimers = () => {
    clearInterval(pingInterval);
    clearTimeout(reconnectTimeout);
  };
  WebSocket.onclose = () => {
    clearTimers();
    Stream.end();
    Stream.destroy();
  };
  WebSocket.onerror = err => {
    clearTimers();
    Stream.destroy(err);
  };
  WebSocket.onmessage = event => {
    clearTimeout(reconnectTimeout);
    const data =
      event.data instanceof ArrayBuffer
        ? Buffer.from(event.data)
        : Buffer.from(event.data, "utf8");
    Stream.push(data);
  };
  WebSocket.onopen = () => {
    Stream.setReadable(Proxy);
    Stream.setWritable(Proxy);
    Stream.emit("connect");
    pingInterval = setInterval(() => {
      if (WebSocket.readyState === WebSocket.OPEN) {
        WebSocket.ping();
      }
    }, 30000);
    reconnectTimeout = setTimeout(() => {
      if (WebSocket.readyState === WebSocket.OPEN) {
        WebSocket.close();
        Stream.end();
        Stream.destroy();
      }
    }, 60000);
  };
  WebSocket_Global = WebSocket;
  Proxy.on("close", () => {
    clearTimers();
    WebSocket.close();
  });
  return Stream;
}

module.exports = {
  buildProxy,
  buildStream
};
