import { db } from '../config/firebase';
import { Chat, Message, PendingMessage, User } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    increment,
    limit,
    onSnapshot,
    orderBy,
    query,
    QueryDocumentSnapshot,
    setDoc,
    startAfter,
    updateDoc,
    where,
    writeBatch,
} from 'firebase/firestore';
import { create } from 'zustand';

interface ChatState {
  chats: Chat[];
  messages: { [chatId: string]: Message[] };
  loading: boolean;
  pendingMessages: PendingMessage[];
  lastVisible: { [chatId: string]: QueryDocumentSnapshot | null };
  hasMore: { [chatId: string]: boolean };
  
  loadChats: (userId: string) => () => void;
  loadMessages: (chatId: string, loadMore?: boolean) => Promise<void>;
  sendMessage: (chatId: string, text: string, senderId: string, recipientId: string) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  deleteChat: (chatId: string, userId: string) => Promise<void>;
  markAsRead: (chatId: string, userId: string) => Promise<void>;
  getOrCreateChat: (currentUserId: string, otherUserId: string) => Promise<string>;
  syncPendingMessages: () => Promise<void>;
  loadFromCache: (userId: string) => Promise<void>;
}

const MESSAGES_CACHE_KEY = 'messages_cache_';
const CHATS_CACHE_KEY = 'chats_cache';
const PENDING_MESSAGES_KEY = 'pending_messages';

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  messages: {},
  loading: false,
  pendingMessages: [],
  lastVisible: {},
  hasMore: {},

  loadFromCache: async (userId: string) => {
    try {
      const cachedChats = await AsyncStorage.getItem(`${CHATS_CACHE_KEY}_${userId}`);
      if (cachedChats) {
        const chats = JSON.parse(cachedChats);
        set({ chats });
        console.log('Loaded chats from cache:', chats.length);
      }

      const pendingStr = await AsyncStorage.getItem(PENDING_MESSAGES_KEY);
      if (pendingStr) {
        const pending = JSON.parse(pendingStr);
        set({ pendingMessages: pending });
      }
    } catch (error) {
      console.error('Failed to load from cache:', error);
    }
  },

  loadChats: (userId: string) => {
    console.log('Loading chats for user:', userId);
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', userId),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Chat));

      console.log('Chats updated:', chats.length);
      set({ chats });

      await AsyncStorage.setItem(`${CHATS_CACHE_KEY}_${userId}`, JSON.stringify(chats));

      for (const chat of chats) {
        const cachedMessages = await AsyncStorage.getItem(`${MESSAGES_CACHE_KEY}${chat.id}`);
        if (cachedMessages) {
          const messages = JSON.parse(cachedMessages);
          set(state => ({
            messages: { ...state.messages, [chat.id]: messages }
          }));
        }
      }
    }, (error) => {
      console.error('Error loading chats:', error);
    });

    return () => unsubscribe();
  },

  loadMessages: async (chatId: string, loadMore = false) => {
    const state = get();
    const lastDoc = state.lastVisible[chatId];

    let q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    if (loadMore && lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    try {
      const snapshot = await getDocs(q);
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));

      const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
      const hasMore = snapshot.docs.length === 50;

      set(state => {
        const existingMessages = state.messages[chatId] || [];
        const allMessages = loadMore 
          ? [...existingMessages, ...newMessages]
          : newMessages;

        const uniqueMessages = Array.from(
          new Map(allMessages.map(m => [m.id, m])).values()
        ).sort((a, b) => b.timestamp - a.timestamp);

        AsyncStorage.setItem(`${MESSAGES_CACHE_KEY}${chatId}`, JSON.stringify(uniqueMessages));

        return {
          messages: { ...state.messages, [chatId]: uniqueMessages },
          lastVisible: { ...state.lastVisible, [chatId]: lastVisible },
          hasMore: { ...state.hasMore, [chatId]: hasMore },
        };
      });

      console.log('Loaded messages for chat:', chatId, newMessages.length);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  },

  sendMessage: async (chatId: string, text: string, senderId: string, recipientId: string) => {
    const localId = `local_${Date.now()}_${Math.random()}`;
    const timestamp = Date.now();

    const optimisticMessage: Message = {
      id: localId,
      chatId,
      text,
      senderId,
      timestamp,
      status: 'sending',
      localId,
    };

    set(state => ({
      messages: {
        ...state.messages,
        [chatId]: [optimisticMessage, ...(state.messages[chatId] || [])],
      },
    }));

    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      const pendingMessage: PendingMessage = {
        localId,
        chatId,
        text,
        senderId,
        timestamp,
        recipientId,
      };

      const pendingMessages = [...get().pendingMessages, pendingMessage];
      set({ pendingMessages });
      await AsyncStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(pendingMessages));

      set(state => ({
        messages: {
          ...state.messages,
          [chatId]: state.messages[chatId].map(m =>
            m.localId === localId ? { ...m, status: 'failed' as const } : m
          ),
        },
      }));

      console.log('Message queued for later:', localId);
      return;
    }

    try {
      // Check if chat exists before sending message
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (!chatDoc.exists()) {
        console.warn('Chat does not exist (may have been deleted):', chatId);
        set(state => ({
          messages: {
            ...state.messages,
            [chatId]: state.messages[chatId].map(m =>
              m.localId === localId ? { ...m, status: 'failed' as const } : m
            ),
          },
        }));
        return;
      }

      const messageRef = doc(collection(db, 'chats', chatId, 'messages'));
      const messageData = {
        text,
        senderId,
        timestamp,
        status: 'sent',
      };

      await setDoc(messageRef, messageData);

      const chatRef = doc(db, 'chats', chatId);
      const batch = writeBatch(db);
      
      batch.update(chatRef, {
        lastMessage: {
          text,
          senderId,
          timestamp,
        },
        updatedAt: timestamp,
        [`unreadCount.${recipientId}`]: increment(1),
      });

      await batch.commit();

      set(state => ({
        messages: {
          ...state.messages,
          [chatId]: state.messages[chatId].map(m =>
            m.localId === localId 
              ? { ...m, id: messageRef.id, status: 'sent' as const } 
              : m
          ),
        },
      }));

      console.log('Message sent:', messageRef.id);
    } catch (error: any) {
      if (error.code === 'not-found') {
        console.warn('Chat not found for sending message (may have been deleted):', chatId);
        set(state => ({
          messages: {
            ...state.messages,
            [chatId]: state.messages[chatId].map(m =>
              m.localId === localId ? { ...m, status: 'failed' as const } : m
            ),
          },
        }));
        return;
      }
      console.error('Failed to send message:', error);
      
      set(state => ({
        messages: {
          ...state.messages,
          [chatId]: state.messages[chatId].map(m =>
            m.localId === localId ? { ...m, status: 'failed' as const } : m
          ),
        },
      }));
    }
  },

  syncPendingMessages: async () => {
    const { pendingMessages } = get();
    if (pendingMessages.length === 0) return;

    console.log('Syncing pending messages:', pendingMessages.length);

    for (const pending of pendingMessages) {
      try {
        const messageRef = doc(collection(db, 'chats', pending.chatId, 'messages'));
        await setDoc(messageRef, {
          text: pending.text,
          senderId: pending.senderId,
          timestamp: pending.timestamp,
          status: 'sent',
        });

        const chatRef = doc(db, 'chats', pending.chatId);
        await updateDoc(chatRef, {
          lastMessage: {
            text: pending.text,
            senderId: pending.senderId,
            timestamp: pending.timestamp,
          },
          updatedAt: pending.timestamp,
          [`unreadCount.${pending.recipientId}`]: increment(1),
        });

        set(state => ({
          messages: {
            ...state.messages,
            [pending.chatId]: state.messages[pending.chatId]?.map(m =>
              m.localId === pending.localId 
                ? { ...m, id: messageRef.id, status: 'sent' as const }
                : m
            ) || [],
          },
          pendingMessages: state.pendingMessages.filter(p => p.localId !== pending.localId),
        }));

        console.log('Pending message synced:', pending.localId);
      } catch (error) {
        console.error('Failed to sync pending message:', error);
      }
    }

    const remaining = get().pendingMessages;
    await AsyncStorage.setItem(PENDING_MESSAGES_KEY, JSON.stringify(remaining));
  },

  deleteMessage: async (chatId: string, messageId: string) => {
    try {
      await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
      
      set(state => ({
        messages: {
          ...state.messages,
          [chatId]: state.messages[chatId]?.filter(m => m.id !== messageId) || [],
        },
      }));

      console.log('Message deleted:', messageId);
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  },

  deleteChat: async (chatId: string, userId: string) => {
    try {
      const messagesSnapshot = await getDocs(collection(db, 'chats', chatId, 'messages'));
      const batch = writeBatch(db);
      
      messagesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      batch.delete(doc(db, 'chats', chatId));
      await batch.commit();

      set(state => ({
        chats: state.chats.filter(c => c.id !== chatId),
        messages: { ...state.messages, [chatId]: [] },
      }));

      await AsyncStorage.removeItem(`${MESSAGES_CACHE_KEY}${chatId}`);
      console.log('Chat deleted:', chatId);
    } catch (error) {
      console.error('Failed to delete chat:', error);
      throw error;
    }
  },

  markAsRead: async (chatId: string, userId: string) => {
    try {
      // Check if chat exists before updating
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (!chatDoc.exists()) {
        console.warn('Chat does not exist (may have been deleted):', chatId);
        return;
      }

      await updateDoc(doc(db, 'chats', chatId), {
        [`unreadCount.${userId}`]: 0,
      });
    } catch (error: any) {
      if (error.code === 'not-found') {
        console.warn('Chat not found for marking as read:', chatId);
        return;
      }
      console.error('Failed to mark as read:', error);
    }
  },

  getOrCreateChat: async (currentUserId: string, otherUserId: string) => {
    const { chats } = get();
    const existingChat = chats.find(chat => 
      chat.participants.includes(currentUserId) && 
      chat.participants.includes(otherUserId)
    );

    if (existingChat) {
      return existingChat.id;
    }

    const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
    const otherUser = otherUserDoc.data() as User;

    const currentUserDoc = await getDoc(doc(db, 'users', currentUserId));
    const currentUser = currentUserDoc.data() as User;

    const chatRef = doc(collection(db, 'chats'));
    const newChat: Chat = {
      id: chatRef.id,
      participants: [currentUserId, otherUserId],
      participantDetails: {
        [currentUserId]: {
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
          isOnline: currentUser.isOnline,
        },
        [otherUserId]: {
          displayName: otherUser.displayName,
          photoURL: otherUser.photoURL,
          isOnline: otherUser.isOnline,
        },
      },
      unreadCount: {
        [currentUserId]: 0,
        [otherUserId]: 0,
      },
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };

    await setDoc(chatRef, newChat);
    console.log('Chat created:', chatRef.id);
    return chatRef.id;
  },
}));
