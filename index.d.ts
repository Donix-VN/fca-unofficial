// Type definitions for @dongdev/fca-unofficial
// Project: https://github.com/Donix-VN/fca-unofficial
// Definitions by: DongDev <https://github.com/Donix-VN>

declare module "@dongdev/fca-unofficial" {
  // ==================== LOGIN TYPES ====================

  export interface LoginCredentials {
    email?: string;
    password?: string;
    appState?: AppState;
  }

  export type AppState = Array<{
    key: string;
    value: string;
    domain: string;
    path: string;
    hostOnly: boolean;
    creation: string;
    lastAccessed: string;
  }>;

  export interface LoginError {
    error: string;
    continue?: (code: string) => void;
  }

  export interface LoginOptions {
    logLevel?: "silent" | "error" | "warn" | "info" | "verbose";
    forceLogin?: boolean;
    userAgent?: string;
    pauseLog?: boolean;
  }

  // ==================== API OPTIONS ====================

  export interface ApiOptions {
    listenEvents?: boolean;
    selfListen?: boolean;
    autoMarkRead?: boolean;
    autoMarkDelivery?: boolean;
    online?: boolean;
    logLevel?: "silent" | "error" | "warn" | "info" | "verbose";
    userAgent?: string;
    proxy?: string;
    pauseLog?: boolean;
  }

  // ==================== MESSAGE TYPES ====================

  export interface Message {
    body?: string;
    sticker?: string;
    emoji?: string;
    emojiSize?: "small" | "medium" | "large";
    attachment?: any | any[];
    url?: string;
    mentions?: MessageMention[];
  }

  export interface MessageMention {
    tag: string;
    id: string;
    fromIndex: number;
  }

  export interface MessageInfo {
    threadID: string;
    messageID: string;
    timestamp: number;
  }

  // ==================== EVENT TYPES ====================

  export interface MessageEvent {
    type: "message";
    threadID: string;
    messageID: string;
    senderID: string;
    body: string;
    attachments: MessageAttachment[];
    mentions: { [key: string]: string };
    timestamp: number;
    isGroup: boolean;
    participantIDs?: string[];
  }

  export interface MessageAttachment {
    type: string;
    ID: string;
    url: string;
    filename?: string;
    mimeType?: string;
    width?: number;
    height?: number;
    fileSize?: number;
  }

  export interface EventLog {
    type: "event";
    threadID: string;
    logMessageType: string;
    logMessageData: any;
    logMessageBody?: string;
    author: string;
  }

  export interface TypingEvent {
    type: "typ";
    threadID: string;
    from: string;
    fromMobile: boolean;
    isTyping: boolean;
  }

  export interface ReadReceiptEvent {
    type: "read_receipt";
    threadID: string;
    reader: string;
    time: number;
  }

  export interface PresenceEvent {
    type: "presence";
    userID: string;
    statuses: number;
    timestamp: number;
  }

  export type Event = MessageEvent | EventLog | TypingEvent | ReadReceiptEvent | PresenceEvent;

  // ==================== USER INFO TYPES ====================

  export interface UserInfo {
    name: string;
    firstName: string;
    vanity: string;
    thumbSrc: string;
    profileUrl: string;
    gender: "MALE" | "FEMALE" | string;
    type: "user" | "friend" | "page";
    isFriend: boolean;
    isBirthday: boolean;
  }

  export interface UserInfoResult {
    [userID: string]: UserInfo;
  }

  // ==================== THREAD INFO TYPES ====================

  export interface ThreadInfo {
    threadID: string;
    threadName: string;
    participantIDs: string[];
    userInfo: UserInfo[];
    nicknames: { [userID: string]: string };
    color: string;
    emoji: string;
    adminIDs: string[];
    approvalMode: boolean;
    approvalQueue: any[];
    isGroup: boolean;
    isSubscribed: boolean;
    timestamp: number;
    muteUntil: number;
    lastReadTimestamp: number;
    messageCount: number;
    imageSrc: string;
  }

  // ==================== THREAD LIST TYPES ====================

  export interface Thread {
    threadID: string;
    name: string;
    isGroup: boolean;
    isSubscribed: boolean;
    participantIDs: string[];
    imageSrc: string;
    unreadCount: number;
    messageCount: number;
    timestamp: number;
    snippet: string;
    snippetAttachments: any[];
    snippetSender: string;
    lastMessageTimestamp: number;
    muteUntil: number;
    isArchived: boolean;
  }

  // ==================== MESSAGE HISTORY TYPES ====================

  export interface HistoryMessage {
    type: string;
    senderName: string;
    senderID: string;
    participantNames: string[];
    participantIDs: string[];
    body: string;
    threadID: string;
    threadName: string;
    location: any;
    messageID: string;
    attachments: MessageAttachment[];
    timestamp: number;
    timestampAbsolute: string;
    timestampRelative: string;
    timestampDatetime: string;
    tags: string[];
    reactions: any[];
    isGroup: boolean;
  }

  // ==================== POLL TYPES ====================

  export interface PollInfo {
    question: string;
    options: { [option: string]: boolean };
    author: string;
  }

  // ==================== SEARCH TYPES ====================

  export interface SearchResult {
    name: string;
    threadID: string;
    participantIDs: string[];
    imageSrc: string;
    isGroup: boolean;
  }

  // ==================== API INTERFACE ====================

  export interface API {
    // ===== Configuration =====
    setOptions(options: ApiOptions): void;
    getAppState(): AppState;

    // ===== Messaging =====
    sendMessage(
      message: string | Message,
      threadID: string,
      callback?: (err: any, messageInfo?: MessageInfo) => void
    ): void;
    sendMessage(
      message: string | Message,
      threadID: string,
      messageID?: string,
      callback?: (err: any, messageInfo?: MessageInfo) => void
    ): void;

    unsendMessage(
      messageID: string,
      callback?: (err: any) => void
    ): void;

    deleteMessage(
      messageID: string,
      callback?: (err: any) => void
    ): void;

    forwardAttachment(
      attachmentID: string,
      userOrThreadID: string,
      callback?: (err: any) => void
    ): void;

    setMessageReaction(
      reaction: string,
      messageID: string,
      callback?: (err: any) => void
    ): void;

    // ===== Listening =====
    listenMqtt(callback: (err: any, event?: Event) => void): () => void;
    listen(callback: (err: any, event?: Event) => void): () => void;

    // ===== Status & Indicators =====
    markAsRead(
      threadID: string,
      callback?: (err: any) => void
    ): void;

    markAsDelivered(
      threadID: string,
      messageID: string,
      callback?: (err: any) => void
    ): void;

    markAsReadAll(callback?: (err: any) => void): void;

    sendTypingIndicator(
      threadID: string,
      callback?: (err: any) => void,
      isTyping?: boolean
    ): void;

    // ===== User Information =====
    getUserInfo(
      userID: string | string[],
      callback: (err: any, userInfo?: UserInfoResult) => void
    ): void;

    getUserID(
      name: string,
      callback: (err: any, data?: { userID: string }) => void
    ): void;

    getCurrentUserID(): string;

    // ===== Thread Information =====
    getThreadInfo(
      threadID: string,
      callback: (err: any, threadInfo?: ThreadInfo) => void
    ): void;

    getThreadList(
      limit: number,
      timestamp: number | null,
      tags: string[],
      callback: (err: any, threads?: Thread[]) => void
    ): void;

    getThreadHistory(
      threadID: string,
      amount: number,
      timestamp: number | null,
      callback: (err: any, history?: HistoryMessage[]) => void
    ): void;

    getThreadPictures(
      threadID: string,
      offset: number,
      limit: number,
      callback: (err: any, pictures?: any[]) => void
    ): void;

    searchForThread(
      name: string,
      callback: (err: any, results?: SearchResult[]) => void
    ): void;

    // ===== Thread Management =====
    setTitle(
      newTitle: string,
      threadID: string,
      callback?: (err: any) => void
    ): void;

    changeThreadColor(
      color: string,
      threadID: string,
      callback?: (err: any) => void
    ): void;

    changeThreadEmoji(
      emoji: string,
      threadID: string,
      callback?: (err: any) => void
    ): void;

    changeNickname(
      nickname: string,
      threadID: string,
      userID: string,
      callback?: (err: any) => void
    ): void;

    changeArchivedStatus(
      threadID: string,
      archive: boolean,
      callback?: (err: any) => void
    ): void;

    deleteThread(
      threadID: string,
      callback?: (err: any) => void
    ): void;

    muteThread(
      threadID: string,
      muteSeconds: number,
      callback?: (err: any) => void
    ): void;

    // ===== Group Management =====
    addUserToGroup(
      userID: string | string[],
      threadID: string,
      callback?: (err: any) => void
    ): void;

    removeUserFromGroup(
      userID: string,
      threadID: string,
      callback?: (err: any) => void
    ): void;

    createNewGroup(
      participantIDs: string[],
      groupTitle: string,
      callback?: (err: any, threadID?: string) => void
    ): void;

    createPoll(
      title: string,
      threadID: string,
      options: { [option: string]: boolean },
      callback?: (err: any, pollInfo?: PollInfo) => void
    ): void;

    // ===== Message Requests =====
    handleMessageRequest(
      threadID: string,
      accept: boolean,
      callback?: (err: any) => void
    ): void;

    // ===== Blocking =====
    changeBlockedStatus(
      userID: string,
      block: boolean,
      callback?: (err: any) => void
    ): void;

    // ===== Media =====
    resolvePhotoUrl(
      photoID: string,
      callback: (err: any, url?: string) => void
    ): void;

    // ===== Authentication =====
    logout(callback?: (err: any) => void): void;
  }

  // ==================== MAIN EXPORT ====================

  function login(
    credentials: LoginCredentials,
    callback: (err: LoginError | null, api?: API) => void
  ): void;

  function login(
    credentials: LoginCredentials,
    options: LoginOptions,
    callback: (err: LoginError | null, api?: API) => void
  ): void;

  export default login;
}
