"use strict";

const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const utils = require("../../utils");
const log = require("npmlog");
const allowedProperties = {
  attachment: true,
  url: true,
  sticker: true,
  emoji: true,
  emojiSize: true,
  body: true,
  mentions: true,
  location: true,
  asPage: true
};
module.exports = function (defaultFuncs, api, ctx) {
  function toReadable(input) {
    if (utils.isReadableStream(input)) return input;
    if (Buffer.isBuffer(input)) return Readable.from(input);
    if (typeof input === "string" && fs.existsSync(input) && fs.statSync(input).isFile()) return fs.createReadStream(path.resolve(input));
    throw { error: "Unsupported attachment input. Use stream/buffer/filepath." };
  }
  function normalizeAttachments(list) {
    if (!Array.isArray(list)) list = [list];
    return list.map(a => {
      if (Array.isArray(a) && /_id$/.test(a[0])) return a;
      if (a && typeof a === "object") {
        if (a.id && a.type && /_id$/.test(a.type)) return [a.type, a.id];
        if (a.image_id || a.file_id || a.video_id || a.audio_id || a.gif_id) {
          const k = Object.keys(a).find(x => /_id$/.test(x));
          return [k, a[k]];
        }
      }
      return toReadable(a);
    });
  }
  function uploadAttachment(attachments, callback) {
    const uploads = [];
    for (let i = 0; i < attachments.length; i++) {
      if (!utils.isReadableStream(attachments[i])) {
        throw { error: "Attachment should be a readable stream and not " + utils.getType(attachments[i]) + "." };
      }
      const form = { upload_1024: attachments[i], voice_clip: "true" };
      uploads.push(
        defaultFuncs
          .postFormData("https://upload.facebook.com/ajax/mercury/upload.php", ctx.jar, form, {}, {})
          .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
          .then(resData => {
            if (resData.error) throw resData;
            return resData.payload.metadata[0];
          })
      );
    }
    Promise.all(uploads)
      .then(resData => callback(null, resData))
      .catch(err => {
        log.error("uploadAttachment", err);
        callback(err);
      });
  }
  function getUrl(url, callback) {
    const form = { image_height: 960, image_width: 960, uri: url };
    defaultFuncs
      .post("https://www.facebook.com/message_share_attachment/fromURI/", ctx.jar, form)
      .then(utils.parseAndCheckLogin(ctx, defaultFuncs))
      .then(resData => {
        if (resData.error) return callback(resData);
        if (!resData.payload) return callback({ error: "Invalid url" });
        callback(null, resData.payload.share_data.share_params);
      })
      .catch(err => {
        log.error("getUrl", err);
        callback(err);
      });
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  async function postWithRetry(url, jar, form, tries = 3) {
    let lastErr;
    for (let i = 0; i < tries; i++) {
      try {
        const res = await defaultFuncs.post(url, jar, form).then(utils.parseAndCheckLogin(ctx, defaultFuncs));
        if (res && !res.error) return res;
        lastErr = res;
        if (res && (res.error === 1545003 || res.error === 368)) await sleep(500 * (i + 1));
        else break;
      } catch (e) {
        lastErr = e;
        await sleep(500 * (i + 1));
      }
    }
    throw lastErr || { error: "Send failed" };
  }
  function applyPageAuthor(form, msg) {
    const pageID = msg && msg.asPage ? msg.asPage : ctx.globalOptions.pageID;
    if (!pageID) return;
    form["author"] = "fbid:" + pageID;
    form["specific_to_list[1]"] = "fbid:" + pageID;
    form["creator_info[creatorID]"] = ctx.userID;
    form["creator_info[creatorType]"] = "direct_admin";
    form["creator_info[labelType]"] = "sent_message";
    form["creator_info[pageID]"] = pageID;
    form["request_user_id"] = pageID;
    form["creator_info[profileURI]"] = "https://www.facebook.com/profile.php?id=" + ctx.userID;
  }
  function applyMentions(msg, form) {
    if (!msg.mentions || !msg.mentions.length) return;
    const body = typeof msg.body === "string" ? msg.body : "";
    const emptyChar = "\u200E";
    form["body"] = emptyChar + body;
    let searchFrom = 0;
    msg.mentions.forEach((m, i) => {
      const tag = String(m.tag || "");
      const from = typeof m.fromIndex === "number" ? m.fromIndex : searchFrom;
      const off = Math.max(0, body.indexOf(tag, from));
      form[`profile_xmd[${i}][offset]`] = off + 1;
      form[`profile_xmd[${i}][length]`] = tag.length;
      form[`profile_xmd[${i}][id]`] = m.id || 0;
      form[`profile_xmd[${i}][type]`] = "p";
      searchFrom = off + tag.length;
    });
  }
  function finalizeHasAttachment(form) {
    const keys = ["image_ids", "gif_ids", "file_ids", "video_ids", "audio_ids", "sticker_id", "shareable_attachment[share_params]"];
    form.has_attachment = keys.some(k => k in form && (Array.isArray(form[k]) ? form[k].length > 0 : !!form[k]));
  }
  function sendContent(form, threadID, isSingleUser, messageAndOTID, callback) {
    if (utils.getType(threadID) === "Array") {
      for (let i = 0; i < threadID.length; i++) form["specific_to_list[" + i + "]"] = "fbid:" + threadID[i];
      form["specific_to_list[" + threadID.length + "]"] = "fbid:" + ctx.userID;
      form["client_thread_id"] = "root:" + messageAndOTID;
      log.verbose("sendMessage", "Sending message to multiple users: " + threadID);
    } else {
      if (isSingleUser) {
        form["specific_to_list[0]"] = "fbid:" + threadID;
        form["specific_to_list[1]"] = "fbid:" + ctx.userID;
        form["other_user_fbid"] = threadID;
      } else {
        form["thread_fbid"] = threadID;
      }
    }
    postWithRetry("https://www.facebook.com/messaging/send/", ctx.jar, form)
      .then(resData => {
        if (!resData) return callback({ error: "Send message failed." });
        if (resData.error) {
          if (resData.error === 1545012) log.warn("sendMessage", "Got error 1545012. This might mean that you're not part of the conversation " + threadID);
          else log.error("sendMessage", resData);
          return callback(resData);
        }
        let messageInfo = null;
        if (resData.payload && Array.isArray(resData.payload.actions)) {
          for (const v of resData.payload.actions) {
            if (v && v.message_id) messageInfo = { threadID: v.thread_fbid, messageID: v.message_id, timestamp: v.timestamp };
          }
        }
        callback(null, messageInfo);
      })
      .catch(err => {
        log.error("sendMessage", err);
        if (utils.getType(err) === "Object" && err.error === "Not logged in.") ctx.loggedIn = false;
        callback(err);
      });
  }
  function send(form, threadID, messageAndOTID, callback, isGroup) {
    if (utils.getType(threadID) === "Array") return sendContent(form, threadID, false, messageAndOTID, callback);
    if (utils.getType(isGroup) !== "Boolean") return sendContent(form, threadID, String(threadID).length === 15, messageAndOTID, callback);
    return sendContent(form, threadID, !isGroup, messageAndOTID, callback);
  }
  function handleUrl(msg, form, callback, cb) {
    if (msg.url) {
      form["shareable_attachment[share_type]"] = "100";
      getUrl(msg.url, function (err, params) {
        if (err) return callback(err);
        form["shareable_attachment[share_params]"] = params;
        cb();
      });
    } else cb();
  }
  function handleLocation(msg, form, callback, cb) {
    if (msg.location) {
      if (msg.location.latitude == null || msg.location.longitude == null) return callback({ error: "location property needs both latitude and longitude" });
      form["location_attachment[coordinates][latitude]"] = msg.location.latitude;
      form["location_attachment[coordinates][longitude]"] = msg.location.longitude;
      form["location_attachment[is_current_location]"] = !!msg.location.current;
    }
    cb();
  }
  function handleSticker(msg, form, callback, cb) {
    if (msg.sticker) form["sticker_id"] = msg.sticker;
    cb();
  }
  function handleEmoji(msg, form, callback, cb) {
    if (msg.emojiSize != null && msg.emoji == null) return callback({ error: "emoji property is empty" });
    if (msg.emoji) {
      if (msg.emojiSize == null) msg.emojiSize = "medium";
      if (msg.emojiSize !== "small" && msg.emojiSize !== "medium" && msg.emojiSize !== "large") return callback({ error: "emojiSize property is invalid" });
      if (form["body"] != null && form["body"] !== "") return callback({ error: "body is not empty" });
      form["body"] = msg.emoji;
      form["tags[0]"] = "hot_emoji_size:" + msg.emojiSize;
    }
    cb();
  }
  function handleAttachment(msg, form, callback, cb) {
    if (!msg.attachment) return cb();
    form["image_ids"] = [];
    form["gif_ids"] = [];
    form["file_ids"] = [];
    form["video_ids"] = [];
    form["audio_ids"] = [];
    const items = normalizeAttachments(msg.attachment);
    if (items.every(e => Array.isArray(e) && /_id$/.test(e[0]))) {
      items.forEach(e => form[`${e[0]}s`].push(e[1]));
      return cb();
    }
    uploadAttachment(items, function (err, files) {
      if (err) return callback(err);
      files.forEach(function (file) {
        const type = Object.keys(file)[0];
        form[type + "s"].push(file[type]);
      });
      cb();
    });
  }
  function handleMention(msg, form, callback, cb) {
    try { applyMentions(msg, form); cb(); } catch (e) { callback(e); }
  }
  return function sendMessage(msg, threadID, callback, replyToMessage, isGroup) {
    if (typeof isGroup === "undefined") isGroup = null;
    if (!callback && (utils.getType(threadID) === "Function" || utils.getType(threadID) === "AsyncFunction")) return threadID({ error: "Pass a threadID as a second argument." });
    if (!replyToMessage && utils.getType(callback) === "String") {
      replyToMessage = callback;
      callback = function () { };
    }
    let resolveFunc = function () { };
    let rejectFunc = function () { };
    const returnPromise = new Promise(function (resolve, reject) {
      resolveFunc = resolve;
      rejectFunc = reject;
    });
    if (!callback) {
      callback = function (err, data) {
        if (err) return rejectFunc(err);
        resolveFunc(data);
      };
    }
    const msgType = utils.getType(msg);
    const threadIDType = utils.getType(threadID);
    const messageIDType = utils.getType(replyToMessage);
    if (msgType !== "String" && msgType !== "Object") return callback({ error: "Message should be of type string or object and not " + msgType + "." });
    if (threadIDType !== "Array" && threadIDType !== "Number" && threadIDType !== "String") return callback({ error: "ThreadID should be of type number, string, or array and not " + threadIDType + "." });
    if (replyToMessage && messageIDType !== "String") return callback({ error: "MessageID should be of type string and not " + threadIDType + "." });
    if (msgType === "String") msg = { body: msg };
    const disallowedProperties = Object.keys(msg).filter(prop => !allowedProperties[prop]);
    if (disallowedProperties.length > 0) return callback({ error: "Disallowed props: `" + disallowedProperties.join(", ") + "`" });
    const messageAndOTID = utils.generateOfflineThreadingID();
    const form = {
      client: "mercury",
      action_type: "ma-type:user-generated-message",
      author: "fbid:" + ctx.userID,
      timestamp: Date.now(),
      timestamp_absolute: "Today",
      timestamp_relative: utils.generateTimestampRelative(),
      timestamp_time_passed: "0",
      is_unread: false,
      is_cleared: false,
      is_forward: false,
      is_filtered_content: false,
      is_filtered_content_bh: false,
      is_filtered_content_account: false,
      is_filtered_content_quasar: false,
      is_filtered_content_invalid_app: false,
      is_spoof_warning: false,
      source: "source:chat:web",
      "source_tags[0]": "source:chat",
      body: msg.body ? msg.body.toString() : "",
      html_body: false,
      ui_push_phase: "V3",
      status: "0",
      offline_threading_id: messageAndOTID,
      message_id: messageAndOTID,
      threading_id: utils.generateThreadingID(ctx.clientID),
      ephemeral_ttl_mode: "0",
      manual_retry_cnt: "0",
      signatureID: utils.getSignatureID(),
      replied_to_message_id: replyToMessage
    };
    applyPageAuthor(form, msg);
    handleLocation(msg, form, callback, () =>
      handleSticker(msg, form, callback, () =>
        handleAttachment(msg, form, callback, () =>
          handleUrl(msg, form, callback, () =>
            handleEmoji(msg, form, callback, () =>
              handleMention(msg, form, callback, () => {
                finalizeHasAttachment(form);
                send(form, threadID, messageAndOTID, callback, isGroup);
              })
            )
          )
        )
      )
    );
    return returnPromise;
  };
};
