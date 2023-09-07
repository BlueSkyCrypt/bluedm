interface SecretMessageAuthor {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  [k: string]: unknown;
}

interface SecretMessage {
  uri: string;
  cid: string;
  author: SecretMessageAuthor;
  record: {
    bluedmSecretMessage: string;
    createdAt: String;
  };
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  indexedAt: string;
  decryptedMessage: string;
  myPublicKey?: string;
  [k: string]: unknown;
  sentAt?: string;
  isMe?: boolean;
}

interface Keys {
  privateKey: string;
  publicKey: string;
}

interface NotificationData {
  uri: string;
  cid: string;
  author: SecretMessageAuthor;
  record: {}
  isRead: boolean;
  indexedAt: string;
}

interface SecretMessagingSession {
  notificationData: NotificationData
  encryptedSharedkey: string
  counterUserProfileData: string
  sharedKey: string
}