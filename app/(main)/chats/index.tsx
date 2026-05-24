import { useRouter } from 'expo-router';
import { MessageCircle, Plus, Settings as SettingsIcon, User } from 'lucide-react-native';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuthStore } from '../../../store/authStore';
import { useChatStore } from '../../../store/chatStore';
import { Chat } from '../../../types';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChatsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { chats, loadChats, loadFromCache, syncPendingMessages } = useChatStore();

  useEffect(() => {
    if (!user) return;

    console.log('Loading chats for user:', user.id);
    loadFromCache(user.id);
    const unsubscribe = loadChats(user.id);
    syncPendingMessages();

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes < 1 ? 'Just now' : `${minutes}m ago`;
    } else if (hours < 24) {
      return `${hours}h ago`;
    } else {
      const days = Math.floor(hours / 24);
      return days === 1 ? 'Yesterday' : `${days}d ago`;
    }
  };

  const getOtherUser = (chat: Chat) => {
    const otherUserId = chat.participants.find(id => id !== user?.id);
    return otherUserId ? chat.participantDetails[otherUserId] : null;
  };

  const renderChatItem = ({ item }: { item: Chat }) => {
    const otherUser = getOtherUser(item);
    if (!otherUser) return null;

    const unreadCount = user ? item.unreadCount[user.id] || 0 : 0;
    const lastMessage = item.lastMessage;

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => router.push(`/(main)/chats/${item.id}`)}
      >
        <View style={styles.avatar}>
          <User size={24} color="#fff" />
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName}>{otherUser.displayName}</Text>
            {lastMessage && (
              <Text style={styles.timestamp}>
                {formatTimestamp(lastMessage.timestamp)}
              </Text>
            )}
          </View>

          {lastMessage && (
            <View style={styles.lastMessageContainer}>
              <Text
                style={[styles.lastMessage, unreadCount > 0 && styles.unreadMessage]}
                numberOfLines={1}
              >
                {lastMessage.senderId === user?.id ? 'You: ' : ''}
                {lastMessage.text}
              </Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {otherUser.isOnline && <View style={styles.onlineIndicator} />}
      </TouchableOpacity>
    );
  };

  if (!user) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/(main)/profile')}
          >
            <User size={24} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/(main)/settings' as any)}
          >
            <SettingsIcon size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={chats}
        renderItem={renderChatItem}
        keyExtractor={item => item.id}
        contentContainerStyle={chats.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MessageCircle size={64} color="#CCC" strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptySubtitle}>
              Start a new conversation by tapping the + button
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(main)/new-chat')}
      >
        <Plus size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#000',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingVertical: 8,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#000',
  },
  timestamp: {
    fontSize: 13,
    color: '#8E8E93',
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastMessage: {
    fontSize: 15,
    color: '#8E8E93',
    flex: 1,
  },
  unreadMessage: {
    fontWeight: '600' as const,
    color: '#000',
  },
  badge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  onlineIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#fff',
    position: 'absolute',
    left: 56,
    top: 56,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 30,
    bottom: 50,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
