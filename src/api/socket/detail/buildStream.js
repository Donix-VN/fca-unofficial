"use strict";

const { Transform } = require("stream");
const Duplexify = require("duplexify");

// Instead of using a global WebSocket variable, pass it directly.
function buildProxy(wsInstance) {
  const Proxy = new Transform({
    objectMode: false,

    transform(chunk, enc, next) {
      if (!wsInstance || wsInstance.readyState !== 1) { // 1 === WebSocket.OPEN
        return next();
      }
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8");
      try {
        wsInstance.send(data);
        next();
      } catch (err) {
        console.error("WebSocket send error:", err);
        next(err);
      }
    },

    flush(done) {
      if (wsInstance && wsInstance.readyState === 1) {
        wsInstance.close();
      }
      done();
    },

    writev(chunks, cb) {
      try {
        for (const { chunk } of chunks) {
          this.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8"));
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

function buildStream(options, wsInstance) {
  const Proxy = buildProxy(wsInstance);
  const Stream = Duplexify(undefined, undefined, options);
  Stream.socket = wsInstance;

  let pingInterval;
  let reconnectTimeout;

  const clearTimers = () => {
    clearInterval(pingInterval);
    clearTimeout(reconnectTimeout);
  };

  wsInstance.onclose = () => {
    clearTimers();
    Stream.end();
    Stream.destroy();
  };

  wsInstance.onerror = err => {
    clearTimers();
    Stream.destroy(err);
  };

  wsInstance.onmessage = event => {
    clearTimeout(reconnectTimeout);
    const data =
      event.data instanceof ArrayBuffer
        ? Buffer.from(event.data)
        : Buffer.from(event.data, "utf8");
    Stream.push(data);
  };

  wsInstance.onopen = () => {
    Stream.setReadable(Proxy);
    Stream.setWritable(Proxy);
    Stream.emit("connect");
    pingInterval = setInterval(() => {
      if (wsInstance.readyState === 1 && typeof wsInstance.ping === "function") {
        wsInstance.ping();
      }
    }, 30000);

    reconnectTimeout = setTimeout(() => {
      if (wsInstance.readyState === 1) {
        wsInstance.close();
        Stream.end();
        Stream.destroy();
      }
    }, 60000);
  };

  Proxy.on("close", () => {
    clearTimers();
    wsInstance.close();
  });

  return Stream;
}

module.exports = { buildProxy, buildStream };
