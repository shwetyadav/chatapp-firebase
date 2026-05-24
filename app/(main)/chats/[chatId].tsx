import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Send, Trash2 } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';

import { db } from '../../../config/firebase';
import { useAuthStore } from '../../../store/authStore';
import { useChatStore } from '../../../store/chatStore';
import { Message } from '../../../types';

// ─── Message Bubble ──────────────────────────────────────────────────────────

const MessageBubble = ({
  item,
  isOwn,
  onDelete,
}: {
  item: Message;
  isOwn: boolean;
  onDelete: () => void;
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  };

  return (
    <View style={[styles.messageContainer, isOwn && styles.ownMessageContainer]}>
      <Pressable
        onLongPress={isOwn ? onDelete : undefined}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        delayLongPress={500}
        style={isPressed && styles.messagePressedScale}
      >
        <View
          style={[
            styles.messageBubble,
            isOwn && styles.ownMessageBubble,
            isPressed && styles.messagePressedOpacity,
          ]}
        >
          <Text style={[styles.messageText, isOwn && styles.ownMessageText]}>
            {item.text}
          </Text>
          {item.timestamp && (
            <Text style={[styles.timestampText, isOwn && styles.ownTimestampText]}>
              {formatTime(item.timestamp)}
            </Text>
          )}
        </View>
      </Pressable>
    </View>
  );
};

// ─── Chat Screen ─────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { user } = useAuthStore();
  const { messages, loadMessages, sendMessage, deleteMessage, deleteChat, markAsRead } =
    useChatStore();

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [otherUserName, setOtherUserName] = useState('');
  const [recipientId, setRecipientId] = useState('');

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!chatId || !user) return;

    loadMessages(chatId);
    markAsRead(chatId, user.id);

    const chatRef = doc(db, 'chats', chatId);
    const unsubChat = onSnapshot(chatRef, snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      const otherId = data.participants.find((id: string) => id !== user.id);
      if (otherId) {
        setRecipientId(otherId);
        setOtherUserName(data.participantDetails?.[otherId]?.displayName ?? 'Chat');
      }
    });

    const msgQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('timestamp', 'desc')
    );

    const unsubMsgs = onSnapshot(msgQuery, () => {
      loadMessages(chatId);
      markAsRead(chatId, user.id);
    });

    return () => {
      unsubChat();
      unsubMsgs();
    };
  }, [chatId, user?.id]);

  const handleSend = async () => {
    if (!inputText.trim() || !chatId || !user || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      let targetId = recipientId;

      if (!targetId) {
        const snap = await getDoc(doc(db, 'chats', chatId));
        targetId = snap.data()?.participants.find((id: string) => id !== user.id);
      }

      if (!targetId) throw new Error('Recipient not found');

      await sendMessage(chatId, text, user.id, targetId);
    } catch (e) {
      Alert.alert('Error', 'Failed to send message');
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMessage(chatId, messageId);
          } catch (e) {
            Alert.alert('Error', 'Failed to delete message');
          }
        },
      },
    ]);
  };

  const handleDeleteChat = () => {
    Alert.alert('Delete Chat', 'Are you sure you want to delete this entire chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteChat(chatId, user!.id);
          router.back();
        },
      },
    ]);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.senderId === user?.id;
    return (
      <MessageBubble
        item={item}
        isOwn={isOwn}
        onDelete={() => handleDeleteMessage(item.id)}
      />
    );
  };

  const chatMessages = messages[chatId] || [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen
        options={{
          title: otherUserName || 'Chat',
          headerRight: () => (
            <TouchableOpacity onPress={handleDeleteChat} style={styles.headerButton}>
              <Trash2 size={22} color="#FF3B30" />
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={chatMessages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          inverted
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        />

        <View
          style={[
            styles.inputContainer,
            { paddingBottom: Math.max(insets.bottom, 8) },
          ]}
        >
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Type a message…"
              placeholderTextColor="#999"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
              scrollEnabled
              returnKeyType="default"
              blurOnSubmit={false}
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || sending) && styles.sendButtonDisabled,
              ]}
              disabled={!inputText.trim() || sending}
              onPress={handleSend}
              activeOpacity={0.7}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Send size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  flex: {
    flex: 1,
  },
  headerButton: {
    padding: 4,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  messageContainer: {
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  ownMessageContainer: {
    alignItems: 'flex-end',
  },
  messagePressedScale: {
    transform: [{ scale: 0.98 }],
  },
  messagePressedOpacity: {
    opacity: 0.7,
  },
  messageBubble: {
    backgroundColor: '#E9E9EB',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ownMessageBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  timestampText: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownTimestampText: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
    maxHeight: 120,
    color: '#000',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  sendButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
});