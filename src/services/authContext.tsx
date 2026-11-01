import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  signInWithPopup, 
  signOut as fbSignOut, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  isOwnerEmail: boolean;
  isEmailVerified: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, pass: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Primary bootstrap admin email from project metadata
const BOOTSTRAP_ADMIN_EMAIL = 'sukeshkavin@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isOwnerEmail, setIsOwnerEmail] = useState<boolean>(false);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const evaluateAdminStatus = async (user: User | null) => {
    if (!user) {
      setIsAdmin(false);
      setIsOwnerEmail(false);
      setIsEmailVerified(false);
      setUserProfile(null);
      return;
    }

    const emailMatches = Boolean(
      user.email && user.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase()
    );
    const verified = Boolean(user.emailVerified);
    setIsOwnerEmail(emailMatches);
    setIsEmailVerified(verified);

    let adminStatus = false;

    // Check custom claims from Firebase Auth token first
    try {
      const tokenResult = await user.getIdTokenResult();
      if (tokenResult?.claims?.admin === true) {
        adminStatus = true;
      }
    } catch {
      // Ignore token claim read error
    }

    // Require verified email for designated administrator
    if (!adminStatus && emailMatches && verified) {
      adminStatus = true;
    }

    // Fallback: check admin registry document
    if (!adminStatus) {
      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid));
        if (adminDoc.exists()) {
          adminStatus = true;
        }
      } catch {
        // Non-admins denied read to /admins
        adminStatus = false;
      }
    }

    setIsAdmin(adminStatus);
    setUserProfile({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0] || 'Customer',
      photoURL: user.photoURL,
      isAdmin: adminStatus,
    });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      await evaluateAdminStatus(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const clearError = () => setError(null);

  const formatAuthError = (err: any): string => {
    const code = err?.code || '';
    switch (code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please try again.';
      case 'auth/email-already-in-use':
        return 'An account already exists with this email address. Please sign in instead.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/invalid-email':
        return 'Please provide a valid email address.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in popup was closed before completing.';
      case 'auth/cancelled-popup-request':
        return 'Previous sign-in attempt was cancelled.';
      default:
        return err?.message || 'Authentication failed. Please try again.';
    }
  };

  const signInWithGoogle = async () => {
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(formatAuthError(err));
      }
      throw err;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const signUpWithEmail = async (name: string, email: string, pass: string) => {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const sendVerificationEmail = async () => {
    setError(null);
    if (!auth.currentUser) {
      throw new Error('No user is currently signed in.');
    }
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err: any) {
      const msg = formatAuthError(err);
      setError(msg);
      throw new Error(msg);
    }
  };

  const reloadUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setCurrentUser({ ...auth.currentUser });
      await evaluateAdminStatus(auth.currentUser);
    }
  };

  const logout = async () => {
    setError(null);
    try {
      await fbSignOut(auth);
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('Logout error:', err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        isAdmin,
        isOwnerEmail,
        isEmailVerified,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        sendVerificationEmail,
        reloadUser,
        resetPassword,
        logout,
        error,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
