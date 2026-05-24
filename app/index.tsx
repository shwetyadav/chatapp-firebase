import { Redirect } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function Index() {
  const { user, loading } = useAuthStore();

  if (loading) {
    return null;
  }

  if (user) {
    return <Redirect href="/(main)/chats" />;
  }

  return <Redirect href="/(auth)/login" />;
}
