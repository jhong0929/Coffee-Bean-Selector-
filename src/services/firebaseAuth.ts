import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google Auth Provider with requested Google Workspace scopes
export const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/drive.file');

// In-memory access token cache (NOT in localStorage per security guidelines)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

/**
 * Initialize auth state listener.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // User is logged into Firebase, but OAuth access token might need interactive sign-in
        if (onAuthSuccess) onAuthSuccess(user, null);
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Trigger Google Sign-In popup with requested Workspace scopes.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error('無法從 Google 授權取得存取憑證 (Access Token)');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current in-memory access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Set cached access token manually if needed.
 */
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

/**
 * Sign out and clear in-memory tokens.
 */
export const logoutAuth = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};
