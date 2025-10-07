# FCA-Unofficial - Complete API Documentation

## Introduction

**@dongdev/fca-unofficial** is an unofficial Node.js library for interacting with Facebook Messenger by emulating browser behavior. This library allows you to create chat bots and automate tasks on Facebook Messenger.

## Installation

```bash
npm install @dongdev/fca-unofficial@latest
```

---

## 1. LOGIN

### 1.1. Login with Email & Password

```javascript
const login = require("@dongdev/fca-unofficial");

const credentials = {
    email: "your_email@example.com",
    password: "your_password"
};

login(credentials, (err, api) => {
    if (err) {
        console.error("Login error:", err);
        return;
    }
    console.log("Login successful!");
});
```

### 1.2. Login with 2FA (Two-Factor Authentication)

When your account has 2FA enabled, you need to provide the 2FA code:

```javascript
const login = require("@dongdev/fca-unofficial");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const credentials = {
    email: "your_email@example.com",
    password: "your_password"
};

login(credentials, (err, api) => {
    if (err) {
        // If 2FA is required
        if (err.error === 'login-approval') {
            console.log("2FA code required!");

            rl.question("Enter 2FA code: ", (code) => {
                err.continue(code);
                rl.close();
            });
        } else {
            console.error("Login error:", err);
        }
        return;
    }

    console.log("Login successful!");
});
```

### 1.3. Login with AppState (Recommended)

AppState is saved cookies and session data. Login with AppState helps avoid entering password each time and reduces checkpoint risk.

#### Get and Save AppState:

```javascript
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

const credentials = {
    email: "your_email@example.com",
    password: "your_password"
};

login(credentials, (err, api) => {
    if (err) {
        console.error("Login error:", err);
        return;
    }

    // Save AppState to file
    try {
        const appState = api.getAppState();
        fs.writeFileSync("appstate.json", JSON.stringify(appState, null, 2));
        console.log("✅ AppState saved!");
    } catch (error) {
        console.error("Error saving AppState:", error);
    }
});
```

#### Use Saved AppState:

```javascript
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

const credentials = {
    appState: JSON.parse(fs.readFileSync("appstate.json", "utf8"))
};

login(credentials, (err, api) => {
    if (err) {
        console.error("Login error:", err);
        return;
    }

    console.log("Login successful with AppState!");
});
```

**Note:** You can use [c3c-fbstate](https://github.com/c3cbot/c3c-fbstate) tool to get AppState from browser.

---

## 2. CONFIGURATION (Options)

After login, you can configure API options:

```javascript
api.setOptions({
    // Listen to events (add/remove members, change group name, etc.)
    listenEvents: true,

    // Listen to your own messages
    selfListen: false,

    // Auto mark messages as read
    autoMarkRead: false,

    // Auto mark as delivered
    autoMarkDelivery: false,

    // Online status (true/false)
    online: true,

    // Log level (silent/error/warn/info/verbose)
    logLevel: "info",

    // Custom user agent
    userAgent: "Mozilla/5.0..."
});
```

---

## 3. DETAILED API METHODS

### 3.1. sendMessage - Send Message

Send message to user or group chat.

#### Syntax:
```javascript
api.sendMessage(message, threadID, [messageID], [callback])
```

#### Parameters:
- `message`: Message content (string or object)
- `threadID`: Conversation ID (user ID or group ID)
- `messageID`: (Optional) Message ID to reply to
- `callback`: (Optional) Callback function `(err, messageInfo)`

#### Basic Example:

```javascript
api.sendMessage("Hello!", "100012345678901", (err, messageInfo) => {
    if (err) {
        console.error("Send message error:", err);
        return;
    }
    console.log("Message sent, ID:", messageInfo.messageID);
});
```

#### Send Messages with Various Content Types:

```javascript
// 1. Simple text message
api.sendMessage("Hello World", threadID);

// 2. Send sticker
api.sendMessage({
    sticker: "767334476655547"  // Sticker ID
}, threadID);

// 3. Send emoji with size
api.sendMessage({
    body: "Awesome!",
    emoji: "👍",
    emojiSize: "large"  // small, medium, large
}, threadID);

// 4. Send file/image
const fs = require("fs");
api.sendMessage({
    body: "Here is an image",
    attachment: fs.createReadStream("./image.jpg")
}, threadID);

// 5. Send multiple files
api.sendMessage({
    body: "Multiple attachments",
    attachment: [
        fs.createReadStream("./image1.jpg"),
        fs.createReadStream("./image2.jpg"),
        fs.createReadStream("./document.pdf")
    ]
}, threadID);

// 6. Send URL
api.sendMessage({
    body: "Check this link",
    url: "https://example.com"
}, threadID);

// 7. Reply to message
api.sendMessage({
    body: "This is a reply"
}, threadID, messageID);

// 8. Mention users
api.sendMessage({
    body: "Hello @User1 and @User2!",
    mentions: [
        {
            tag: "@User1",
            id: "100012345678901",
            fromIndex: 6  // Starting position of @User1
        },
        {
            tag: "@User2",
            id: "100012345678902",
            fromIndex: 17
        }
    ]
}, threadID);
```

---

### 3.2. listenMqtt - Listen for Messages

Listen for messages and events from Facebook Messenger (using MQTT).

#### Syntax:
```javascript
const stopListening = api.listenMqtt(callback);
```

#### Parameters:
- `callback`: Function `(err, event)` called when new message/event arrives

#### Example:

```javascript
const stopListening = api.listenMqtt((err, event) => {
    if (err) {
        console.error("Listen error:", err);
        return;
    }

    // Handle events
    switch (event.type) {
        case "message":
            console.log("New message:", event.body);
            console.log("From user:", event.senderID);
            console.log("In conversation:", event.threadID);

            // Reply to message
            if (event.body === "Hi") {
                api.sendMessage("Hello!", event.threadID);
            }
            break;

        case "event":
            console.log("Event:", event.logMessageType);
            // log_message_type can be:
            // - log:subscribe (member added)
            // - log:unsubscribe (member removed)
            // - log:thread-name (group name changed)
            // - log:thread-icon (group icon changed)
            // - log:thread-color (chat color changed)
            break;

        case "typ":
            console.log(event.from, "is typing...");
            break;

        case "read_receipt":
            console.log("Message read by:", event.reader);
            break;
    }
});

// Stop listening
// stopListening();
```

#### Event Object Details:

```javascript
// Event type: "message"
{
    type: "message",
    threadID: "1234567890",
    messageID: "mid.xxx",
    senderID: "100012345678901",
    body: "Message content",
    attachments: [],  // Array of attachments
    mentions: {},     // Object of mentions
    timestamp: 1234567890000,
    isGroup: false    // true if group chat
}

// Event type: "event"
{
    type: "event",
    threadID: "1234567890",
    logMessageType: "log:subscribe",
    logMessageData: {...},
    author: "100012345678901"
}

// Event type: "typ" (typing)
{
    type: "typ",
    threadID: "1234567890",
    from: "100012345678901",
    isTyping: true
}

// Event type: "read_receipt" (read)
{
    type: "read_receipt",
    threadID: "1234567890",
    reader: "100012345678901",
    time: 1234567890000
}
```

---

### 3.3. getUserInfo - Get User Information

Get detailed information about one or more users.

#### Syntax:
```javascript
api.getUserInfo(userID, callback);
```

#### Example:

```javascript
// Get info for 1 user
api.getUserInfo("100012345678901", (err, userInfo) => {
    if (err) {
        console.error(err);
        return;
    }

    console.log(userInfo);
    // {
    //   "100012345678901": {
    //     name: "John Doe",
    //     firstName: "John",
    //     vanity: "john.doe",
    //     thumbSrc: "avatar_url",
    //     profileUrl: "https://facebook.com/john.doe",
    //     gender: "MALE",  // MALE/FEMALE
    //     type: "user",
    //     isFriend: true,
    //     isBirthday: false
    //   }
    // }
});

// Get info for multiple users
api.getUserInfo(["100012345678901", "100012345678902"], (err, userInfo) => {
    if (err) return console.error(err);

    for (let id in userInfo) {
        console.log(userInfo[id].name);
    }
});
```

---

### 3.4. getThreadInfo - Get Thread Information

Get information about conversation/group chat.

#### Syntax:
```javascript
api.getThreadInfo(threadID, callback);
```

#### Example:

```javascript
api.getThreadInfo("1234567890", (err, threadInfo) => {
    if (err) {
        console.error(err);
        return;
    }

    console.log("Group name:", threadInfo.threadName);
    console.log("Member count:", threadInfo.participantIDs.length);
    console.log("Members list:", threadInfo.participantIDs);
    console.log("Admins:", threadInfo.adminIDs);
    console.log("Nicknames:", threadInfo.nicknames);
    console.log("Chat color:", threadInfo.color);
    console.log("Emoji:", threadInfo.emoji);
});
```

---

### 3.5. changeThreadColor - Change Chat Color

Change the color of conversation.

#### Syntax:
```javascript
api.changeThreadColor(color, threadID, callback);
```

#### Example:

```javascript
// Color can be:
// "#0084ff" (Messenger Blue)
// "#44bec7" (Teal Blue)
// "#ffc300" (Yellow)
// "#fa3c4c" (Red)
// "#d696bb" (Pink)
// "#6699cc" (Sky Blue)
// "#13cf13" (Green)
// "#ff7e29" (Orange)
// "#e68585" (Light Red)
// "#7646ff" (Purple)
// "#20cef5" (Cyan)
// or any hex color code

api.changeThreadColor("#ffc300", "1234567890", (err) => {
    if (err) {
        console.error("Change color error:", err);
        return;
    }
    console.log("Chat color changed successfully!");
});
```

---

### 3.6. changeThreadEmoji - Change Group Emoji

Change the default emoji of conversation.

#### Syntax:
```javascript
api.changeThreadEmoji(emoji, threadID, callback);
```

#### Example:

```javascript
api.changeThreadEmoji("👍", "1234567890", (err) => {
    if (err) {
        console.error("Change emoji error:", err);
        return;
    }
    console.log("Emoji changed successfully!");
});
```

---

### 3.7. setTitle - Change Group Name

Change the name of group chat.

#### Syntax:
```javascript
api.setTitle(newTitle, threadID, callback);
```

#### Example:

```javascript
api.setTitle("New Chat Group", "1234567890", (err) => {
    if (err) {
        console.error("Change name error:", err);
        return;
    }
    console.log("Group name changed successfully!");
});
```

---

### 3.8. addUserToGroup - Add Member to Group

Add user to group chat.

#### Syntax:
```javascript
api.addUserToGroup(userID, threadID, callback);
```

#### Example:

```javascript
// Add 1 person
api.addUserToGroup("100012345678901", "1234567890", (err) => {
    if (err) {
        console.error("Add user error:", err);
        return;
    }
    console.log("Member added successfully!");
});

// Add multiple people
api.addUserToGroup(["100012345678901", "100012345678902"], "1234567890", (err) => {
    if (err) return console.error(err);
    console.log("Multiple members added!");
});
```

---

### 3.9. removeUserFromGroup - Remove Member from Group

Remove user from group chat.

#### Syntax:
```javascript
api.removeUserFromGroup(userID, threadID, callback);
```

#### Example:

```javascript
api.removeUserFromGroup("100012345678901", "1234567890", (err) => {
    if (err) {
        console.error("Remove user error:", err);
        return;
    }
    console.log("Member removed successfully!");
});
```

---

### 3.10. changeNickname - Change Nickname

Change user's nickname in group chat.

#### Syntax:
```javascript
api.changeNickname(nickname, threadID, userID, callback);
```

#### Example:

```javascript
api.changeNickname("Admin Bot", "1234567890", "100012345678901", (err) => {
    if (err) {
        console.error("Change nickname error:", err);
        return;
    }
    console.log("Nickname changed successfully!");
});

// Remove nickname (set to original name)
api.changeNickname("", "1234567890", "100012345678901", (err) => {
    if (err) return console.error(err);
    console.log("Nickname removed!");
});
```

---

### 3.11. markAsRead - Mark as Read

Mark message as read.

#### Syntax:
```javascript
api.markAsRead(threadID, callback);
```

#### Example:

```javascript
api.listenMqtt((err, event) => {
    if (err) return console.error(err);

    if (event.type === "message") {
        // Auto mark as read
        api.markAsRead(event.threadID, (err) => {
            if (err) console.error("Mark as read error:", err);
        });
    }
});
```

---

### 3.12. markAsDelivered - Mark as Delivered

Mark message as delivered.

#### Syntax:
```javascript
api.markAsDelivered(threadID, messageID, callback);
```

#### Example:

```javascript
api.markAsDelivered("1234567890", "mid.xxx", (err) => {
    if (err) {
        console.error("Mark as delivered error:", err);
        return;
    }
    console.log("Marked as delivered!");
});
```

---

### 3.13. markAsReadAll - Mark All as Read

Mark all messages as read.

#### Syntax:
```javascript
api.markAsReadAll(callback);
```

#### Example:

```javascript
api.markAsReadAll((err) => {
    if (err) {
        console.error("Error:", err);
        return;
    }
    console.log("All messages marked as read!");
});
```

---

### 3.14. sendTypingIndicator - Show Typing Indicator

Display "typing..." status in chat.

#### Syntax:
```javascript
api.sendTypingIndicator(threadID, callback);
```

#### Example:

```javascript
// Show typing
api.sendTypingIndicator("1234567890", (err) => {
    if (err) return console.error(err);

    // After 3 seconds, send message
    setTimeout(() => {
        api.sendMessage("Hello!", "1234567890");
    }, 3000);
});

// Or stop typing indicator
api.sendTypingIndicator("1234567890", (err) => {
    if (err) return console.error(err);
}, true);  // 3rd parameter is true to turn off typing
```

---

### 3.15. unsendMessage - Unsend Message

Unsend/recall a sent message.

#### Syntax:
```javascript
api.unsendMessage(messageID, callback);
```

#### Example:

```javascript
api.sendMessage("This message will be deleted", "1234567890", (err, messageInfo) => {
    if (err) return console.error(err);

    // Unsend after 5 seconds
    setTimeout(() => {
        api.unsendMessage(messageInfo.messageID, (err) => {
            if (err) {
                console.error("Unsend error:", err);
                return;
            }
            console.log("Message unsent!");
        });
    }, 5000);
});
```

---

### 3.16. createPoll - Create Poll

Create poll in group chat.

#### Syntax:
```javascript
api.createPoll(title, threadID, options, callback);
```

#### Example:

```javascript
const title = "Choose travel destination?";
const options = {
    "Da Lat": false,    // false = allow multiple choices
    "Nha Trang": false,
    "Phu Quoc": false
};

api.createPoll(title, "1234567890", options, (err, pollInfo) => {
    if (err) {
        console.error("Create poll error:", err);
        return;
    }
    console.log("Poll created successfully!");
});
```

---

### 3.17. handleMessageRequest - Handle Message Request

Accept or decline message from stranger.

#### Syntax:
```javascript
api.handleMessageRequest(threadID, accept, callback);
```

#### Example:

```javascript
// Accept message
api.handleMessageRequest("1234567890", true, (err) => {
    if (err) {
        console.error("Error:", err);
        return;
    }
    console.log("Message accepted!");
});

// Decline message
api.handleMessageRequest("1234567890", false, (err) => {
    if (err) return console.error(err);
    console.log("Message declined!");
});
```

---

### 3.18. muteThread - Mute Notifications

Mute or unmute notifications for conversation.

#### Syntax:
```javascript
api.muteThread(threadID, muteSeconds, callback);
```

#### Example:

```javascript
// Mute for 1 hour (3600 seconds)
api.muteThread("1234567890", 3600, (err) => {
    if (err) {
        console.error("Error:", err);
        return;
    }
    console.log("Muted for 1 hour!");
});

// Mute permanently
api.muteThread("1234567890", -1, (err) => {
    if (err) return console.error(err);
    console.log("Muted permanently!");
});

// Unmute
api.muteThread("1234567890", 0, (err) => {
    if (err) return console.error(err);
    console.log("Unmuted!");
});
```

---

### 3.19. getThreadList - Get Thread List

Get list of conversations.

#### Syntax:
```javascript
api.getThreadList(limit, timestamp, tags, callback);
```

#### Example:

```javascript
// Get 20 most recent conversations
api.getThreadList(20, null, ["INBOX"], (err, threads) => {
    if (err) {
        console.error("Error:", err);
        return;
    }

    threads.forEach(thread => {
        console.log("Thread ID:", thread.threadID);
        console.log("Name:", thread.name);
        console.log("Unread count:", thread.unreadCount);
        console.log("Last message:", thread.snippet);
        console.log("---");
    });
});

// Tags can be:
// - "INBOX" : Inbox
// - "ARCHIVED" : Archived
// - "PENDING" : Pending messages
// - "OTHER" : Other
```

---

### 3.20. getThreadHistory - Get Message History

Get message history of conversation.

#### Syntax:
```javascript
api.getThreadHistory(threadID, amount, timestamp, callback);
```

#### Example:

```javascript
// Get 50 most recent messages
api.getThreadHistory("1234567890", 50, null, (err, history) => {
    if (err) {
        console.error("Error:", err);
        return;
    }

    history.forEach(msg => {
        console.log("From:", msg.senderName);
        console.log("Content:", msg.body);
        console.log("Time:", new Date(msg.timestamp));
        console.log("---");
    });
});

// Get older messages (pagination)
const oldestTimestamp = history[history.length - 1].timestamp;
api.getThreadHistory("1234567890", 50, oldestTimestamp, (err, olderHistory) => {
    if (err) return console.error(err);
    console.log("Retrieved 50 older messages!");
});
```

---

### 3.21. getThreadPictures - Get Thread Pictures

Get conversation/group avatar URL.

#### Syntax:
```javascript
api.getThreadPictures(threadID, offset, limit, callback);
```

#### Example:

```javascript
api.getThreadPictures("1234567890", 0, 10, (err, pictures) => {
    if (err) {
        console.error("Error:", err);
        return;
    }

    pictures.forEach(pic => {
        console.log("Image URL:", pic.url);
        console.log("Width:", pic.width);
        console.log("Height:", pic.height);
    });
});
```

---

### 3.22. getUserID - Get User ID

Get User ID from username or profile URL.

#### Syntax:
```javascript
api.getUserID(name, callback);
```

#### Example:

```javascript
// From username
api.getUserID("john.doe", (err, data) => {
    if (err) {
        console.error("Error:", err);
        return;
    }
    console.log("User ID:", data.userID);
});

// From profile URL
api.getUserID("https://facebook.com/john.doe", (err, data) => {
    if (err) return console.error(err);
    console.log("User ID:", data.userID);
});
```

---

### 3.23. getAppState - Get Current AppState

Get current AppState (cookies, session).

#### Syntax:
```javascript
const appState = api.getAppState();
```

#### Example:

```javascript
const fs = require("fs");

// Get and save AppState
const appState = api.getAppState();
fs.writeFileSync("appstate.json", JSON.stringify(appState, null, 2));
console.log("✅ AppState saved!");

// Periodically update AppState (every 10 minutes)
setInterval(() => {
    const updatedAppState = api.getAppState();
    fs.writeFileSync("appstate.json", JSON.stringify(updatedAppState, null, 2));
    console.log("🔄 AppState updated");
}, 10 * 60 * 1000);
```

---

### 3.24. deleteMessage - Delete Message (from your side)

Delete message from your side (not unsend).

#### Syntax:
```javascript
api.deleteMessage(messageID, callback);
```

#### Example:

```javascript
api.deleteMessage("mid.xxx", (err) => {
    if (err) {
        console.error("Delete message error:", err);
        return;
    }
    console.log("Message deleted!");
});
```

---

### 3.25. deleteThread - Delete Thread

Delete conversation from your list.

#### Syntax:
```javascript
api.deleteThread(threadID, callback);
```

#### Example:

```javascript
api.deleteThread("1234567890", (err) => {
    if (err) {
        console.error("Delete thread error:", err);
        return;
    }
    console.log("Thread deleted!");
});
```

---

### 3.26. forwardAttachment - Forward Attachment

Forward attachment from one message to another.

#### Syntax:
```javascript
api.forwardAttachment(attachmentID, userOrThreadID, callback);
```

#### Example:

```javascript
api.listenMqtt((err, event) => {
    if (err) return console.error(err);

    if (event.type === "message" && event.attachments.length > 0) {
        // Forward first attachment
        const attachmentID = event.attachments[0].ID;

        api.forwardAttachment(attachmentID, "100012345678901", (err) => {
            if (err) {
                console.error("Forward error:", err);
                return;
            }
            console.log("Attachment forwarded!");
        });
    }
});
```

---

### 3.27. setMessageReaction - React to Message

Add reaction (like, love, haha, wow, sad, angry) to message.

#### Syntax:
```javascript
api.setMessageReaction(reaction, messageID, callback);
```

#### Example:

```javascript
// Reaction can be:
// "👍" or ":like:" - Like
// "❤️" or ":love:" - Love
// "😂" or ":haha:" - Haha
// "😮" or ":wow:" - Wow
// "😢" or ":sad:" - Sad
// "😠" or ":angry:" - Angry
// "" (empty string) - Remove reaction

api.listenMqtt((err, event) => {
    if (err) return console.error(err);

    if (event.type === "message" && event.body === "React me") {
        api.setMessageReaction("❤️", event.messageID, (err) => {
            if (err) {
                console.error("React error:", err);
                return;
            }
            console.log("Message reacted!");
        });
    }
});

// Remove reaction
api.setMessageReaction("", "mid.xxx", (err) => {
    if (err) return console.error(err);
    console.log("Reaction removed!");
});
```

---

### 3.28. searchForThread - Search for Thread

Search for conversation by name.

#### Syntax:
```javascript
api.searchForThread(name, callback);
```

#### Example:

```javascript
api.searchForThread("Study Group", (err, threads) => {
    if (err) {
        console.error("Search error:", err);
        return;
    }

    threads.forEach(thread => {
        console.log("Name:", thread.name);
        console.log("Thread ID:", thread.threadID);
        console.log("Type:", thread.isGroup ? "Group" : "Personal");
        console.log("---");
    });
});
```

---

### 3.29. logout - Logout

Logout from Facebook account.

#### Syntax:
```javascript
api.logout(callback);
```

#### Example:

```javascript
api.logout((err) => {
    if (err) {
        console.error("Logout error:", err);
        return;
    }
    console.log("Logged out successfully!");
});
```

---

### 3.30. getCurrentUserID - Get Current User ID

Get User ID of currently logged in account.

#### Syntax:
```javascript
const myUserID = api.getCurrentUserID();
```

#### Example:

```javascript
const myUserID = api.getCurrentUserID();
console.log("Bot's User ID:", myUserID);

// Use to check if message is from bot
api.listenMqtt((err, event) => {
    if (err) return console.error(err);

    if (event.type === "message") {
        if (event.senderID === myUserID) {
            console.log("This is a message from bot!");
        } else {
            console.log("Message from someone else");
        }
    }
});
```

---

### 3.31. resolvePhotoUrl - Get High Quality Photo URL

Get high resolution photo URL from photo ID.

#### Syntax:
```javascript
api.resolvePhotoUrl(photoID, callback);
```

#### Example:

```javascript
api.resolvePhotoUrl("1234567890123456", (err, url) => {
    if (err) {
        console.error("Error:", err);
        return;
    }
    console.log("High quality image URL:", url);
});
```

---

### 3.32. changeArchivedStatus - Archive/Unarchive Thread

Archive or unarchive conversation.

#### Syntax:
```javascript
api.changeArchivedStatus(threadID, archive, callback);
```

#### Example:

```javascript
// Archive conversation
api.changeArchivedStatus("1234567890", true, (err) => {
    if (err) {
        console.error("Error:", err);
        return;
    }
    console.log("Thread archived!");
});

// Unarchive
api.changeArchivedStatus("1234567890", false, (err) => {
    if (err) return console.error(err);
    console.log("Thread unarchived!");
});
```

---

### 3.33. changeBlockedStatus - Block/Unblock User

Block or unblock user.

#### Syntax:
```javascript
api.changeBlockedStatus(userID, block, callback);
```

#### Example:

```javascript
// Block user
api.changeBlockedStatus("100012345678901", true, (err) => {
    if (err) {
        console.error("Error:", err);
        return;
    }
    console.log("User blocked!");
});

// Unblock
api.changeBlockedStatus("100012345678901", false, (err) => {
    if (err) return console.error(err);
    console.log("User unblocked!");
});
```

---

### 3.34. createNewGroup - Create New Group

Create new group chat with member list.

#### Syntax:
```javascript
api.createNewGroup(participantIDs, groupTitle, callback);
```

#### Example:

```javascript
const members = ["100012345678901", "100012345678902", "100012345678903"];
const groupName = "New Chat Group";

api.createNewGroup(members, groupName, (err, threadID) => {
    if (err) {
        console.error("Create group error:", err);
        return;
    }
    console.log("Group created successfully!");
    console.log("Thread ID:", threadID);

    // Send message to new group
    api.sendMessage("Welcome to the group!", threadID);
});
```

---

## 4. COMPLETE BOT EXAMPLES

### 4.1. Echo Bot (Message Repeater)

```javascript
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

// Login
login(
    { appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")) },
    (err, api) => {
        if (err) {
            console.error("Login error:", err);
            return;
        }

        console.log("✅ Bot started!");

        // Configuration
        api.setOptions({
            listenEvents: true,
            selfListen: false,
            logLevel: "silent"
        });

        // Listen for messages
        api.listenMqtt((err, event) => {
            if (err) return console.error(err);

            if (event.type === "message") {
                const { body, threadID, messageID, senderID } = event;

                // Stop bot command
                if (body === "/stop") {
                    api.sendMessage("Bot stopped!", threadID);
                    process.exit(0);
                }

                // Echo message
                api.sendMessage(`📣 Echo: ${body}`, threadID, messageID);
            }
        });
    }
);
```

---

### 4.2. Group Management Bot

```javascript
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

// Admin list (User IDs)
const ADMINS = ["100012345678901", "100012345678902"];

// Check admin permission
function isAdmin(userID) {
    return ADMINS.includes(userID);
}

login(
    { appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")) },
    (err, api) => {
        if (err) return console.error(err);

        console.log("✅ Group management bot started!");

        api.setOptions({ listenEvents: true });

        api.listenMqtt((err, event) => {
            if (err) return console.error(err);

            const { type, threadID, senderID, body, messageID } = event;

            // Handle messages
            if (type === "message") {
                // Only admins can use commands
                if (!isAdmin(senderID)) {
                    if (body.startsWith("/")) {
                        api.sendMessage(
                            "❌ You don't have permission to use this command!",
                            threadID,
                            messageID
                        );
                    }
                    return;
                }

                // Kick command
                if (body.startsWith("/kick ")) {
                    const userID = body.split(" ")[1];
                    api.removeUserFromGroup(userID, threadID, (err) => {
                        if (err) {
                            api.sendMessage("❌ Error kicking user!", threadID);
                        } else {
                            api.sendMessage("✅ User kicked!", threadID);
                        }
                    });
                }

                // Rename command
                else if (body.startsWith("/rename ")) {
                    const newName = body.substring(8);
                    api.setTitle(newName, threadID, (err) => {
                        if (err) {
                            api.sendMessage("❌ Error renaming group!", threadID);
                        } else {
                            api.sendMessage(`✅ Group renamed to: ${newName}`, threadID);
                        }
                    });
                }

                // Group info command
                else if (body === "/info") {
                    api.getThreadInfo(threadID, (err, info) => {
                        if (err) return api.sendMessage("❌ Error getting info!", threadID);

                        const message = `
📊 GROUP INFORMATION
━━━━━━━━━━━━━━━
👥 Name: ${info.threadName}
📝 Members: ${info.participantIDs.length}
👑 Admins: ${info.adminIDs.length}
🎨 Color: ${info.color}
😊 Emoji: ${info.emoji || "Default"}
                        `.trim();

                        api.sendMessage(message, threadID);
                    });
                }

                // Help command
                else if (body === "/help") {
                    const helpMessage = `
🤖 COMMAND LIST
━━━━━━━━━━━━━━━
/kick [userID] - Kick member
/rename [new name] - Rename group
/info - View group info
/help - Show help
                    `.trim();

                    api.sendMessage(helpMessage, threadID);
                }
            }

            // Handle events
            else if (type === "event") {
                // Welcome new members
                if (event.logMessageType === "log:subscribe") {
                    const addedUsers = event.logMessageData.addedParticipants;
                    addedUsers.forEach(user => {
                        api.sendMessage(
                            `👋 Welcome ${user.fullName} to the group!`,
                            threadID
                        );
                    });
                }

                // Notify when someone leaves
                else if (event.logMessageType === "log:unsubscribe") {
                    api.sendMessage(`👋 Goodbye! A member left the group.`, threadID);
                }
            }
        });
    }
);
```

---

### 4.3. AI ChatBot Style (Mock)

```javascript
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

// Store chat history by threadID
const chatHistory = {};

// Mock AI response function
function getAIResponse(message, threadID) {
    // Initialize history if not exists
    if (!chatHistory[threadID]) {
        chatHistory[threadID] = [];
    }

    // Add user message to history
    chatHistory[threadID].push({ role: "user", content: message });

    // Limit history to last 10 messages
    if (chatHistory[threadID].length > 10) {
        chatHistory[threadID] = chatHistory[threadID].slice(-10);
    }

    // Mock response (you can integrate real ChatGPT API here)
    let response = "";

    if (message.toLowerCase().includes("hello")) {
        response = "Hello! How can I help you?";
    } else if (message.toLowerCase().includes("name")) {
        response = "I'm an AI Assistant Bot!";
    } else if (message.toLowerCase().includes("weather")) {
        response = "Sorry, I don't have weather information. Please check weather apps!";
    } else {
        response = `I received your message: "${message}". Thank you for chatting with me!`;
    }

    // Add response to history
    chatHistory[threadID].push({ role: "assistant", content: response });

    return response;
}

login(
    { appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")) },
    (err, api) => {
        if (err) return console.error(err);

        console.log("✅ AI Bot started!");

        api.setOptions({
            listenEvents: true,
            selfListen: false
        });

        api.listenMqtt((err, event) => {
            if (err) return console.error(err);

            if (event.type === "message" && event.body) {
                const { body, threadID, messageID } = event;

                // Ignore if doesn't start with "ai" prefix
                if (!body.toLowerCase().startsWith("ai ")) {
                    return;
                }

                // Get message content (remove "ai " prefix)
                const userMessage = body.substring(3).trim();

                // Show typing indicator
                api.sendTypingIndicator(threadID);

                // Delay for more natural feel
                setTimeout(() => {
                    const aiResponse = getAIResponse(userMessage, threadID);
                    api.sendMessage(`🤖 ${aiResponse}`, threadID, messageID);
                }, 1500);
            }
        });
    }
);
```

---

### 4.4. Auto-Reply Bot with Keywords

```javascript
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

// Auto-reply dictionary
const autoReplies = {
    "hello": "Hi there! How can I help you?",
    "hi": "Hello! What's up?",
    "bye": "Goodbye! See you later!",
    "thanks": "You're welcome! 😊",
    "help": "I'm here to assist! Just ask me anything.",
    "time": () => `Current time: ${new Date().toLocaleTimeString()}`,
    "date": () => `Today's date: ${new Date().toLocaleDateString()}`
};

function getAutoReply(message) {
    const lowerMessage = message.toLowerCase().trim();

    // Check for exact matches
    for (let keyword in autoReplies) {
        if (lowerMessage.includes(keyword)) {
            const reply = autoReplies[keyword];
            // If reply is function, execute it
            return typeof reply === 'function' ? reply() : reply;
        }
    }

    return null; // No match found
}

login(
    { appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")) },
    (err, api) => {
        if (err) return console.error(err);

        console.log("✅ Auto-reply bot started!");

        api.setOptions({
            listenEvents: true,
            selfListen: false
        });

        api.listenMqtt((err, event) => {
            if (err) return console.error(err);

            if (event.type === "message" && event.body) {
                const { body, threadID, messageID } = event;

                const reply = getAutoReply(body);

                if (reply) {
                    api.sendMessage(reply, threadID, messageID);
                }
            }
        });
    }
);
```

---

### 4.5. Command Handler Bot

```javascript
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

// Command prefix
const PREFIX = "/";

// Commands object
const commands = {
    ping: {
        description: "Check bot latency",
        execute: (api, event) => {
            const start = Date.now();
            api.sendMessage("Pong! 🏓", event.threadID, (err) => {
                if (!err) {
                    const latency = Date.now() - start;
                    api.sendMessage(`Latency: ${latency}ms`, event.threadID);
                }
            });
        }
    },

    userinfo: {
        description: "Get user information",
        execute: (api, event) => {
            api.getUserInfo(event.senderID, (err, userInfo) => {
                if (err) return api.sendMessage("Error getting user info!", event.threadID);

                const user = userInfo[event.senderID];
                const info = `
👤 USER INFO
━━━━━━━━━━━━
Name: ${user.name}
Gender: ${user.gender}
Profile: ${user.profileUrl}
                `.trim();

                api.sendMessage(info, event.threadID);
            });
        }
    },

    time: {
        description: "Get current time",
        execute: (api, event) => {
            const now = new Date();
            api.sendMessage(`🕐 Current time: ${now.toLocaleString()}`, event.threadID);
        }
    },

    help: {
        description: "Show command list",
        execute: (api, event) => {
            let helpText = "📋 AVAILABLE COMMANDS\n━━━━━━━━━━━━━━━\n";

            for (let cmd in commands) {
                helpText += `${PREFIX}${cmd} - ${commands[cmd].description}\n`;
            }

            api.sendMessage(helpText, event.threadID);
        }
    }
};

login(
    { appState: JSON.parse(fs.readFileSync("appstate.json", "utf8")) },
    (err, api) => {
        if (err) return console.error(err);

        console.log("✅ Command handler bot started!");

        api.setOptions({ listenEvents: true, selfListen: false });

        api.listenMqtt((err, event) => {
            if (err) return console.error(err);

            if (event.type === "message" && event.body) {
                const { body, threadID } = event;

                // Check if message starts with prefix
                if (!body.startsWith(PREFIX)) return;

                // Parse command
                const args = body.slice(PREFIX.length).trim().split(/ +/);
                const commandName = args.shift().toLowerCase();

                // Execute command
                if (commands[commandName]) {
                    try {
                        commands[commandName].execute(api, event, args);
                    } catch (error) {
                        console.error("Command execution error:", error);
                        api.sendMessage("Error executing command!", threadID);
                    }
                } else {
                    api.sendMessage(`Unknown command: ${commandName}\nUse ${PREFIX}help for command list`, threadID);
                }
            }
        });
    }
);
```

---

## 5. ERROR HANDLING & BEST PRACTICES

### 5.1. Handle Checkpoint/Security Check

When Facebook detects unusual activity, account may be checkpointed:

```javascript
login(credentials, (err, api) => {
    if (err) {
        switch (err.error) {
            case "login-approval":
                console.log("❗ 2FA code required");
                // Handle 2FA
                break;

            case "checkpoint":
                console.log("❌ Account checkpointed!");
                console.log("Please login via browser and verify");
                break;

            default:
                console.error("Login error:", err);
        }
        return;
    }
});
```

---

### 5.2. Auto-save AppState

```javascript
// Save AppState every 10 minutes
setInterval(() => {
    try {
        const appState = api.getAppState();
        fs.writeFileSync("appstate.json", JSON.stringify(appState, null, 2));
        console.log("🔄 AppState updated");
    } catch (error) {
        console.error("Error saving AppState:", error);
    }
}, 10 * 60 * 1000);
```

---

### 5.3. Connection Error Handling

```javascript
api.listenMqtt((err, event) => {
    if (err) {
        console.error("Listen error:", err);

        // Retry connection after 5 seconds
        setTimeout(() => {
            console.log("🔄 Reconnecting...");
            api.listenMqtt(arguments.callee);
        }, 5000);
        return;
    }

    // Handle events normally
});
```

---

### 5.4. Rate Limiting (Avoid Spam)

```javascript
const MESSAGE_COOLDOWN = {}; // Store last message time

function canSendMessage(threadID, cooldownTime = 1000) {
    const now = Date.now();
    const lastTime = MESSAGE_COOLDOWN[threadID] || 0;

    if (now - lastTime < cooldownTime) {
        return false;
    }

    MESSAGE_COOLDOWN[threadID] = now;
    return true;
}

api.listenMqtt((err, event) => {
    if (err) return console.error(err);

    if (event.type === "message") {
        // Check cooldown
        if (!canSendMessage(event.threadID, 2000)) {
            console.log("⏱️  On cooldown...");
            return;
        }

        // Handle message
        api.sendMessage("Response", event.threadID);
    }
});
```

---

### 5.5. Logging and Debug

```javascript
// Enable detailed logging
api.setOptions({
    logLevel: "verbose"  // silent/error/warn/info/verbose
});

// Custom logger
function log(type, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type.toUpperCase()}] ${message}`, data);
}

api.listenMqtt((err, event) => {
    if (err) {
        log("error", "Listen error", err);
        return;
    }

    log("info", "New event", {
        type: event.type,
        threadID: event.threadID
    });
});
```

---

### 5.6. Environment Variables for Credentials

```javascript
require('dotenv').config();

const credentials = {
    email: process.env.FB_EMAIL,
    password: process.env.FB_PASSWORD
};

// Or use AppState
const credentials = {
    appState: JSON.parse(fs.readFileSync(process.env.APPSTATE_PATH, "utf8"))
};
```

**.env file:**
```
FB_EMAIL=your_email@example.com
FB_PASSWORD=your_password
APPSTATE_PATH=./appstate.json
```

---

## 6. IMPORTANT NOTES

### ⚠️ Security Warnings

1. **Never share AppState**: The `appstate.json` file contains login information, never make it public
2. **Use .gitignore**: Add `appstate.json` to `.gitignore`
3. **Avoid hardcoding passwords**: Use environment variables or config files
4. **Keep dependencies updated**: Regularly update the package

### 📝 Best Practices

1. **Use AppState instead of email/password**: Reduces checkpoint risk
2. **Don't spam**: Avoid sending too many messages in short time
3. **Complete error handling**: Always have callbacks to handle errors
4. **Rate limiting**: Limit number of messages/requests
5. **Log activities**: Keep logs for debugging

### 🚫 Avoid Getting Banned

- Don't login/logout repeatedly
- Don't mass message strangers
- Don't send spam links
- Use real browser User-Agent
- Limit requests per minute
- Be a responsible Facebook citizen

---

## 7. TROUBLESHOOTING

### Error: "Wrong username/password"
- Check email and password
- Try logging in manually via browser
- Account may be checkpointed

### Error: "Login approval needed"
- Account has 2FA enabled
- Provide 2FA verification code

### Error: "Checkpoint required"
- Login to Facebook via browser
- Complete verification steps
- Get new AppState after verification

### Bot not receiving messages
- Check internet connection
- Check logs for detailed errors
- Try restarting bot
- Update AppState

### Messages sending too slowly
- Implement message queue
- Use rate limiting
- Check network latency

---

## 8. ADVANCED FEATURES

### 8.1. Message Queue System

```javascript
class MessageQueue {
    constructor(api) {
        this.api = api;
        this.queue = [];
        this.processing = false;
        this.delay = 1000; // 1 second delay between messages
    }

    add(message, threadID, messageID) {
        this.queue.push({ message, threadID, messageID });
        if (!this.processing) {
            this.process();
        }
    }

    async process() {
        this.processing = true;

        while (this.queue.length > 0) {
            const { message, threadID, messageID } = this.queue.shift();

            await new Promise((resolve) => {
                this.api.sendMessage(message, threadID, messageID, (err) => {
                    if (err) console.error("Send error:", err);
                    setTimeout(resolve, this.delay);
                });
            });
        }

        this.processing = false;
    }
}

// Usage
const messageQueue = new MessageQueue(api);

api.listenMqtt((err, event) => {
    if (err) return console.error(err);

    if (event.type === "message") {
        messageQueue.add("Response", event.threadID, event.messageID);
    }
});
```

---

### 8.2. Multi-Account Bot Manager

```javascript
const fs = require("fs");
const login = require("@dongdev/fca-unofficial");

class BotManager {
    constructor() {
        this.bots = new Map();
    }

    async addBot(name, appStatePath) {
        return new Promise((resolve, reject) => {
            const credentials = {
                appState: JSON.parse(fs.readFileSync(appStatePath, "utf8"))
            };

            login(credentials, (err, api) => {
                if (err) {
                    reject(err);
                    return;
                }

                this.bots.set(name, api);
                console.log(`✅ Bot "${name}" connected`);
                resolve(api);
            });
        });
    }

    getBot(name) {
        return this.bots.get(name);
    }

    getAllBots() {
        return Array.from(this.bots.values());
    }
}

// Usage
const manager = new BotManager();

(async () => {
    await manager.addBot("bot1", "./appstate1.json");
    await manager.addBot("bot2", "./appstate2.json");

    const bot1 = manager.getBot("bot1");
    const bot2 = manager.getBot("bot2");

    // Use bots independently
    bot1.sendMessage("Message from Bot 1", threadID);
    bot2.sendMessage("Message from Bot 2", threadID);
})();
```

---

### 8.3. Database Integration (SQLite Example)

```javascript
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bot.db');

// Initialize database
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        username TEXT,
        message_count INTEGER DEFAULT 0,
        last_interaction TEXT
    )`);
});

// Track user messages
function trackUser(userID, username) {
    db.run(`
        INSERT INTO users (user_id, username, message_count, last_interaction)
        VALUES (?, ?, 1, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
            message_count = message_count + 1,
            last_interaction = datetime('now')
    `, [userID, username]);
}

// Get user stats
function getUserStats(userID, callback) {
    db.get('SELECT * FROM users WHERE user_id = ?', [userID], callback);
}

// Usage in bot
api.listenMqtt((err, event) => {
    if (err) return console.error(err);

    if (event.type === "message") {
        // Track user
        api.getUserInfo(event.senderID, (err, info) => {
            if (!err) {
                const username = info[event.senderID].name;
                trackUser(event.senderID, username);
            }
        });

        // Stats command
        if (event.body === "/stats") {
            getUserStats(event.senderID, (err, row) => {
                if (err || !row) return;

                const stats = `
📊 YOUR STATS
━━━━━━━━━━━━
Messages: ${row.message_count}
Last seen: ${row.last_interaction}
                `.trim();

                api.sendMessage(stats, event.threadID);
            });
        }
    }
});
```

---

## 9. RESOURCES

- **GitHub Repository**: https://github.com/Donix-VN/fca-unofficial
- **NPM Package**: @dongdev/fca-unofficial
- **AppState Tool**: https://github.com/c3cbot/c3c-fbstate
- **Facebook Developer Docs**: https://developers.facebook.com/docs/messenger-platform

---

## Conclusion

This is a comprehensive documentation for **@dongdev/fca-unofficial** API methods. This library is very powerful but should be used carefully to avoid violating Facebook's policies and getting your account banned.

**Happy bot coding! 🚀**
