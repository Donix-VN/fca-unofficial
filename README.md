# @dongdev/fca-unofficial

[![npm version](https://img.shields.io/npm/v/@dongdev/fca-unofficial.svg)](https://www.npmjs.com/package/@dongdev/fca-unofficial)
[![npm downloads](https://img.shields.io/npm/dm/@dongdev/fca-unofficial.svg)](https://www.npmjs.com/package/@dongdev/fca-unofficial)

> **Unofficial Facebook Chat API for Node.js** - Interact with Facebook Messenger programmatically

## ⚠️ Important Disclaimer

**We are not responsible if your account gets banned for spammy activities such as:**

- Sending lots of messages to people you don't know
- Sending messages very quickly
- Sending spammy looking URLs
- Logging in and out very quickly

**Recommendation:** Use Firefox browser or [this website](https://fca.dongdev.id.vn) to reduce logout issues, especially for iOS users.

**Support:** If you encounter errors, contact us [here](https://www.facebook.com/mdong.dev)

## 🔍 Introduction

Facebook now has an [official API for chat bots](https://developers.facebook.com/docs/messenger-platform), however it's only available for Facebook Pages.

`@dongdev/fca-unofficial` is the only API that allows you to automate chat functionalities on a **user account** by emulating the browser. This means:

- Making the exact same GET/POST requests as a browser
- Does not work with auth tokens
- Requires Facebook account credentials (email/password) or AppState

## 📦 Installation

```bash
npm install @dongdev/fca-unofficial@latest
```

## 🚀 Basic Usage

### 1. Login and Simple Echo Bot

```javascript
const login = require("@dongdev/fca-unofficial");

login({ appState: [] }, (err, api) => {
    if (err) return console.error(err);

    api.listenMqtt((err, event) => {
        if (err) return console.error(err);

        // Echo back the received message
        api.sendMessage(event.body, event.threadID);
    });
});
```

### 2. Send Text Message

```javascript
const login = require("@dongdev/fca-unofficial");

login({ appState: [] }, (err, api) => {
    if (err) {
        console.error("Login Error:", err);
        return;
    }

    let yourID = "000000000000000"; // Replace with actual Facebook ID
    let msg = "Hey!";

    api.sendMessage(msg, yourID, err => {
        if (err) console.error("Message Sending Error:", err);
        else console.log("Message sent successfully!");
    });
});
```

**Tip:** To find your Facebook ID, look inside the cookies under the name `c_user`

### 3. Send File/Image

```javascript
const login = require("@dongdev/fca-unofficial");
const fs = require("fs");

login({ appState: [] }, (err, api) => {
    if (err) {
        console.error("Login Error:", err);
        return;
    }

    let yourID = "000000000000000";
    let imagePath = __dirname + "/image.jpg";

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
        console.error("Error: Image file not found!");
        return;
    }

    let msg = {
        body: "Hey!",
        attachment: fs.createReadStream(imagePath)
    };

    api.sendMessage(msg, yourID, err => {
        if (err) console.error("Message Sending Error:", err);
        else console.log("Message sent successfully!");
    });
});
```

## 📝 Message Types

| Type                   | Usage                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| **Regular text** | `{ body: "message text" }`                                      |
| **Sticker**      | `{ sticker: "sticker_id" }`                                     |
| **File/Image**   | `{ attachment: fs.createReadStream(path) }` or array of streams |
| **URL**          | `{ url: "https://example.com" }`                                |
| **Large emoji**  | `{ emoji: "👍", emojiSize: "large" }` (small/medium/large)      |

**Note:** A message can only be a regular message (which can be empty) and optionally **one of the following**: a sticker, an attachment, or a URL.

## 💾 Saving AppState to Avoid Re-login

### Save AppState

```javascript
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

const credentials = { appState: [] };

login(credentials, (err, api) => {
    if (err) {
        console.error("Login Error:", err);
        return;
    }

    try {
        const appState = JSON.stringify(api.getAppState(), null, 2);
        fs.writeFileSync("appstate.json", appState);
        console.log("✅ AppState saved successfully!");
    } catch (error) {
        console.error("Error saving AppState:", error);
    }
});
```

### Use Saved AppState

```javascript
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

login(
    { appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")) },
    (err, api) => {
        if (err) {
            console.error("Login Error:", err);
            return;
        }

        console.log("✅ Logged in successfully!");
        // Your code here
    }
);
```

**Alternative:** Use [c3c-fbstate](https://github.com/c3cbot/c3c-fbstate) to get fbstate.json

## 👂 Listening for Messages

### Echo Bot with Stop Command

```javascript
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

login(
    { appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")) },
    (err, api) => {
        if (err) {
            console.error("Login Error:", err);
            return;
        }

        // Enable listening to events (join/leave, title change, etc.)
        api.setOptions({ listenEvents: true });

        const stopListening = api.listenMqtt((err, event) => {
            if (err) {
                console.error("Listen Error:", err);
                return;
            }

            // Mark as read
            api.markAsRead(event.threadID, err => {
                if (err) console.error("Mark as read error:", err);
            });

            // Handle different event types
            switch (event.type) {
                case "message":
                    if (event.body && event.body.trim().toLowerCase() === "/stop") {
                        api.sendMessage("Goodbye…", event.threadID);
                        stopListening();
                        return;
                    }
                    api.sendMessage(`TEST BOT: ${event.body}`, event.threadID);
                    break;

                case "event":
                    console.log("Event Received:", event);
                    break;
            }
        });
    }
);
```

### Listen Options

```javascript
api.setOptions({
    listenEvents: true,  // Receive events (join/leave, rename, etc.)
    selfListen: true,    // Receive messages from yourself
    logLevel: "silent"   // Disable logs (silent/error/warn/info/verbose)
});
```

**By default:**

- `listenEvents` is `false` - won't receive events like joining/leaving chat, title changes
- `selfListen` is `false` - will ignore messages sent by the current account

## 🛠️ Projects Using This API

- **[c3c](https://github.com/lequanglam/c3c)** - Customizable bot with plugins, supports Facebook & Discord
- **[Miraiv2](https://github.com/miraiPr0ject/miraiv2)** - Simple Facebook Messenger Bot
- **[Messer](https://github.com/mjkaufer/Messer)** - Command-line messaging for Facebook Messenger
- **[messen](https://github.com/tomquirk/messen)** - Rapidly build Facebook Messenger apps in Node.js
- **[Concierge](https://github.com/concierge/Concierge)** - Highly modular chat bot with built-in package manager
- **[Marc Zuckerbot](https://github.com/bsansouci/marc-zuckerbot)** - Facebook chat bot
- **[Botyo](https://github.com/ivkos/botyo)** - Modular bot for group chat rooms
- **[matrix-puppet-facebook](https://github.com/matrix-hacks/matrix-puppet-facebook)** - Facebook bridge for Matrix
- **[Miscord](https://github.com/Bjornskjald/miscord)** - Easy-to-use Facebook bridge for Discord
- **[chat-bridge](https://github.com/rexx0520/chat-bridge)** - Messenger, Telegram and IRC chat bridge
- **[Botium](https://github.com/codeforequity-at/botium-core)** - The Selenium for Chatbots
- **[Messenger-CLI](https://github.com/AstroCB/Messenger-CLI)** - Command-line interface for Facebook Messenger
- **[BotCore](https://github.com/AstroCB/BotCore)** - Tools for writing and managing Facebook Messenger bots

[See more projects...](https://github.com/Donix-VN/fca-unofficial#projects-using-this-api)

## 📚 Full API Documentation

See [DOCS.md](./DOCS.md) for detailed information about:

- All available API methods
- Parameters and options
- Event types
- Error handling
- Advanced usage examples

## 🎯 Quick Reference

### Common API Methods

```javascript
// Send message
api.sendMessage(message, threadID, callback);

// Send typing indicator
api.sendTypingIndicator(threadID, callback);

// Mark as read
api.markAsRead(threadID, callback);

// Get user info
api.getUserInfo(userID, callback);

// Get thread info
api.getThreadInfo(threadID, callback);

// Change thread color
api.changeThreadColor(color, threadID, callback);

// Change thread emoji
api.changeThreadEmoji(emoji, threadID, callback);

// Set message reaction
api.setMessageReaction(reaction, messageID, callback);
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a new branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details.

## 👨‍💻 Author

**DongDev** - [Facebook](https://www.facebook.com/mdong.dev)

## ⭐ Support

If this project is helpful, please give it a ⭐ on GitHub!

## 🔗 Links

- [NPM Package](https://www.npmjs.com/package/@dongdev/fca-unofficial)
- [GitHub Repository](https://github.com/Donix-VN/fca-unofficial)
- [Issue Tracker](https://github.com/Donix-VN/fca-unofficial/issues)

---

**Disclaimer:** This is an unofficial API and is not officially supported by Facebook. Use responsibly and comply with [Facebook Terms of Service](https://www.facebook.com/terms.php).
