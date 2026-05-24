export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  isOnline: boolean;
  lastSeen: number;
  createdAt: number;
}

export interface Chat {
  id: string;
  participants: string[];
  participantDetails: {
    [userId: string]: {
      displayName: string;
      photoURL?: string;
      isOnline: boolean;
    };
  };
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: number;
  };
  unreadCount: {
    [userId: string]: number;
  };
  updatedAt: number;
  createdAt: number;
}

export interface Message {
  id: string;
  chatId: string;
  text: string;
  senderId: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'failed';
  localId?: string;
}

export interface PendingMessage {
  localId: string;
  chatId: string;
  text: string;
  senderId: string;
  timestamp: number;
  recipientId: string;
}
