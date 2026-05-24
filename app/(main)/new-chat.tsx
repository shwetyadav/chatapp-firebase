import { useRouter } from 'expo-router';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuthStore } from '../../store/authStore';
import { useChatStore } from '../../store/chatStore';
import { User as UserType } from '../../types';
import { Search, User } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function NewChatScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const { getOrCreateChat } = useChatStore();

  const loadUsers = useCallback(async () => {
    if (!currentUser) return;

    console.log('🔍 Starting to load users for currentUser:', currentUser.id);
    setLoading(true);
    try {
      console.log('📱 Fetching users collection from Firestore...');
      const usersSnapshot = await getDocs(collection(db, 'users'));
      console.log('✅ Got users snapshot, total docs:', usersSnapshot.docs.length);
      
      const allUsers = usersSnapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as UserType))
        .filter(u => u.id !== currentUser.id);
      
      console.log('✅ Loaded users (excluding current user):', allUsers.length);
      console.log('👥 Users:', allUsers.map(u => ({ id: u.id, displayName: u.displayName, email: u.email })));
      
      setUsers(allUsers);
    } catch (error) {
      console.error('❌ Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const filteredUsers = users.filter(u =>
    u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    console.log('🔎 Search query changed to:', searchQuery);
    console.log('📊 Total users available:', users.length);
    console.log('🎯 Filtered users result:', filteredUsers.length);
    if (filteredUsers.length > 0) {
      console.log('📝 Filtered users:', filteredUsers.map(u => ({ displayName: u.displayName, email: u.email })));
    }
  }, [searchQuery, users, filteredUsers]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSelectUser = async (selectedUser: UserType) => {
    if (!currentUser) return;

    console.log('👤 Selected user:', selectedUser.displayName, selectedUser.id);
    console.log('📋 Creating/getting chat with:', selectedUser.displayName);
    setLoading(true);
    try {
      const chatId = await getOrCreateChat(currentUser.id, selectedUser.id);
      console.log('✅ Chat created/found:', chatId);
      router.back();
      router.push(`/(main)/chats/${chatId}` as any);
    } catch (error) {
      console.error('❌ Failed to create chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderUserItem = ({ item }: { item: UserType }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleSelectUser(item)}
      disabled={loading}
    >
      <View style={styles.avatar}>
        <User size={24} color="#fff" />
      </View>

      <View style={styles.userInfo}>
        <Text style={styles.userName}>{item.displayName}</Text>
        <Text style={styles.userEmail}>{item.email}</Text>
      </View>

      {item.isOnline && <View style={styles.onlineIndicator} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Search size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={(text) => {
            console.log('🔎 User typing search:', text);
            setSearchQuery(text);
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          renderItem={renderUserItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <User size={64} color="#CCC" strokeWidth={1.5} />
              <Text style={styles.emptyText}>No users found</Text>
            </View>
          }
        />
      )}
    </View>
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
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
  },
  listContent: {
    paddingVertical: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 14,
    color: '#8E8E93',
  },
  onlineIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#fff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },
});
