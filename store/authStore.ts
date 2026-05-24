import { auth, db } from '../config/firebase';
import { User } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    createUserWithEmailAndPassword,
    deleteUser as firebaseDeleteUser,
    signOut as firebaseSignOut,
    User as FirebaseUser,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    updateProfile
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserProfile: (displayName: string, photoURL?: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  setOnlineStatus: (isOnline: boolean) => Promise<void>;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  firebaseUser: null,
  loading: true,
  initialized: false,

  initialize: () => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.uid);
      
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          set({ user: userData, firebaseUser, loading: false, initialized: true });
          
          await updateDoc(doc(db, 'users', firebaseUser.uid), {
            isOnline: true,
            lastSeen: Date.now(),
          });
        } else {
          set({ user: null, firebaseUser, loading: false, initialized: true });
        }
      } else {
        set({ user: null, firebaseUser: null, loading: false, initialized: true });
      }
    });

    return unsubscribe;
  },

  signIn: async (email: string, password: string) => {
    try {
      console.log('Signing in:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        await updateDoc(doc(db, 'users', userCredential.user.uid), {
          isOnline: true,
          lastSeen: Date.now(),
        });
        set({ user: userData, firebaseUser: userCredential.user });
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(error.message || 'Failed to sign in');
    }
  },

  signUp: async (email: string, password: string, displayName: string) => {
    try {
      console.log('Signing up:', email);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      await updateProfile(userCredential.user, { displayName });
      
      const newUser: User = {
        id: userCredential.user.uid,
        email: userCredential.user.email!,
        displayName,
        photoURL: userCredential.user.photoURL || "url",
        isOnline: true,
        lastSeen: Date.now(),
        createdAt: Date.now(),
      };
      
      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      set({ user: newUser, firebaseUser: userCredential.user });
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(error.message || 'Failed to sign up');
    }
  },

  signOut: async () => {
    const { user } = get();
    if (user) {
      await updateDoc(doc(db, 'users', user.id), {
        isOnline: false,
        lastSeen: Date.now(),
      });
    }
    await firebaseSignOut(auth);
    await AsyncStorage.clear();
    set({ user: null, firebaseUser: null });
  },

  updateUserProfile: async (displayName: string, photoURL?: string) => {
    const { user, firebaseUser } = get();
    if (!user || !firebaseUser) throw new Error('Not authenticated');

    await updateProfile(firebaseUser, { displayName, photoURL });
    await updateDoc(doc(db, 'users', user.id), {
      displayName,
      ...(photoURL && { photoURL }),
    });

    set({ 
      user: { ...user, displayName, ...(photoURL && { photoURL }) },
    });
  },

  deleteAccount: async () => {
    const { user, firebaseUser } = get();
    if (!user || !firebaseUser) throw new Error('Not authenticated');

    await deleteDoc(doc(db, 'users', user.id));
    await firebaseDeleteUser(firebaseUser);
    await AsyncStorage.clear();
    set({ user: null, firebaseUser: null });
  },

  setOnlineStatus: async (isOnline: boolean) => {
    const { user } = get();
    if (!user) return;

    await updateDoc(doc(db, 'users', user.id), {
      isOnline,
      lastSeen: Date.now(),
    });

    set({ user: { ...user, isOnline, lastSeen: Date.now() } });
  },
}));
