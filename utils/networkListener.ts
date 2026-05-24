import { useChatStore } from '../store/chatStore';
import NetInfo from '@react-native-community/netinfo';

export const setupNetworkListener = () => {
  const unsubscribe = NetInfo.addEventListener(state => {
    console.log('Network status changed:', state.isConnected);
    
    if (state.isConnected) {
      const { syncPendingMessages } = useChatStore.getState();
      syncPendingMessages();
    }
  });

  return unsubscribe;
};
