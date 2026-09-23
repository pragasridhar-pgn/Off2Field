import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";

export type UserRole = "inspector" | "admin";

export interface AppUser {
  uid: string;
  email: string | null;
  role: UserRole;
  displayName?: string;
  isOfflineUser?: boolean;
}

const LOCAL_AUTH_CACHE_KEY = "off2field_cached_auth_user";

/**
 * Helper to cache authenticated user in localStorage for offline sessions.
 */
function cacheUser(user: AppUser | null) {
  try {
    if (user) {
      localStorage.setItem(LOCAL_AUTH_CACHE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_AUTH_CACHE_KEY);
    }
  } catch (e) {
    console.warn("Failed to update auth local cache:", e);
  }
}

/**
 * Helper to get cached user from localStorage during offline startup.
 */
export function getCachedUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_AUTH_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Sign up a new user with Email & Password and create profile in Firestore.
 */
export async function signUp(
  email: string,
  password: string,
  role: UserRole = "inspector"
): Promise<AppUser> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const fbUser = userCredential.user;

  const appUser: AppUser = {
    uid: fbUser.uid,
    email: fbUser.email,
    role,
    displayName: email.split("@")[0],
  };

  // Attempt to create user document in Firestore
  try {
    await setDoc(doc(db, "users", fbUser.uid), {
      uid: fbUser.uid,
      email: fbUser.email,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Could not write user profile to Firestore (may be offline):", err);
  }

  cacheUser(appUser);
  return appUser;
}

/**
 * Sign in with Email and Password.
 */
export async function signIn(email: string, password: string): Promise<AppUser> {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const fbUser = userCredential.user;

  let role: UserRole = "inspector";
  try {
    const userDoc = await getDoc(doc(db, "users", fbUser.uid));
    if (userDoc.exists()) {
      role = (userDoc.data()?.role as UserRole) || "inspector";
    } else {
      // Create missing Firestore user profile
      await setDoc(doc(db, "users", fbUser.uid), {
        uid: fbUser.uid,
        email: fbUser.email,
        role: "inspector",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn("Could not read user profile from Firestore:", err);
  }

  const appUser: AppUser = {
    uid: fbUser.uid,
    email: fbUser.email,
    role,
    displayName: email.split("@")[0],
  };

  cacheUser(appUser);
  return appUser;
}

/**
 * Sign out current user and clear local session cache.
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn("Firebase signout error:", err);
  }
  cacheUser(null);
}

/**
 * Get current Firebase user, or cached offline user if Firebase user is null.
 */
export function getCurrentUser(): AppUser | null {
  const fbUser = auth.currentUser;
  if (fbUser) {
    const cached = getCachedUser();
    return {
      uid: fbUser.uid,
      email: fbUser.email,
      role: cached?.role || "inspector",
      displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "User",
    };
  }
  return getCachedUser();
}

/**
 * Subscribe to Firebase auth state changes.
 */
export function subscribeToAuthState(
  callback: (user: AppUser | null, isReady: boolean) => void
): () => void {
  // Call immediately with cached user if available
  const cached = getCachedUser();
  if (cached) {
    callback(cached, true);
  }

  const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      let role: UserRole = cached?.role || "inspector";
      try {
        const snap = await getDoc(doc(db, "users", fbUser.uid));
        if (snap.exists()) {
          role = (snap.data().role as UserRole) || role;
        }
      } catch (err) {
        console.warn("Error reading Firestore profile during auth state change:", err);
      }

      const appUser: AppUser = {
        uid: fbUser.uid,
        email: fbUser.email,
        role,
        displayName: fbUser.displayName || fbUser.email?.split("@")[0] || "User",
      };

      cacheUser(appUser);
      callback(appUser, true);
    } else {
      // If we are offline and have a cached user, keep the offline user active
      if (!navigator.onLine && cached) {
        callback(cached, true);
      } else {
        cacheUser(null);
        callback(null, true);
      }
    }
  });

  return unsubscribe;
}
