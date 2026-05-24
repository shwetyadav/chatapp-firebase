// import * as ImagePicker from 'expo-image-picker';
import { Camera, User } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuthStore } from '../../store/authStore';

export default function ProfileScreen() {
  const { user, updateUserProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name cannot be empty');
      return;
    }

    setLoading(true);
    try {
      await updateUserProfile(displayName.trim());
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
  //   const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
  //   if (status !== 'granted') {
  //     Alert.alert('Permission Required', 'We need camera roll permissions to update your profile picture');
  //     return;
  //   }

  //   const result = await ImagePicker.launchImageLibraryAsync({
  //     mediaTypes: ImagePicker.MediaTypeOptions.Images,
  //     allowsEditing: true,
  //     aspect: [1, 1],
  //     quality: 0.5,
  //   });

  //   if (!result.canceled && result.assets[0]) {
  //     Alert.alert('Note', 'Profile picture upload will be implemented with Firebase Storage');
  //   }
  // };

  // if (!user) {
  //   return (
  //     <View style={styles.centerContainer}>
  //       <ActivityIndicator size="large" color="#007AFF" />
  //     </View>
  //   );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.avatarSection}>
        <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage}>
          <View style={styles.avatar}>
            <User size={48} color="#fff" />
          </View>
          <View style={styles.cameraButton}>
            <Camera size={16} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            editable={!loading}
          />
        </View>

        <View style={styles.statusContainer}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Status</Text>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, user.isOnline && styles.onlineDot]} />
              <Text style={styles.statusText}>{user.isOnline ? 'Online' : 'Offline'}</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleUpdateProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  content: {
    paddingVertical: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButton: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  email: {
    fontSize: 14,
    color: '#8E8E93',
  },
  form: {
    paddingHorizontal: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 8,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  statusContainer: {
    marginBottom: 32,
  },
  statusItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  statusLabel: {
    fontSize: 16,
    color: '#000',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8E8E93',
  },
  onlineDot: {
    backgroundColor: '#34C759',
  },
  statusText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  button: {
    height: 52,
    backgroundColor: '#007AFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
