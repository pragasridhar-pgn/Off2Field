import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  onAuthStateChanged,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";

export type UserRole =
  | "inspector"
  | "admin"
  | "Field Inspector"
  | "Supervisor"
  | "Admin"
  | "Maintenance"
  | "Viewer";

export interface AppUser {
  uid: string;
  phone: string;
  email?: string | null;
  displayName?: string;
  name?: string;
  role: UserRole;
  employeeId?: string;
  department?: string;
  organizationId?: string;
  organizationName?: string;
  siteId?: string;
  siteName?: string;
  assignedDeviceId?: string;
  status?: string;
  createdAt: string;
  lastLoginAt: string;
  updatedAt?: string;
  lastSyncAt?: string;
  isOfflineUser?: boolean;
}

const LOCAL_AUTH_CACHE_KEY = "off2field_cached_auth_user";

/**
 * Normalizes phone numbers to standard E.164 international format.
 * Default country code is India (+91).
 */
export function normalizePhoneNumber(raw: string, defaultCode = "+91"): string {
  if (!raw) return "";
  let cleaned = raw.trim().replace(/[\s\-\(\)]/g, "");

  // Remove leading 0 if present (e.g. 09876543210 -> 9876543210)
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  // Check if already starts with '+'
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // If starts with '91' and is 12 digits, prepend '+'
  if (cleaned.startsWith("91") && cleaned.length === 12) {
    return `+${cleaned}`;
  }

  // Prepend default country code
  const prefix = defaultCode.startsWith("+") ? defaultCode : `+${defaultCode}`;
  return `${prefix}${cleaned}`;
}

/**
 * Helper to cache authenticated user profile locally for persistent offline sessions.
 */
export function cacheUser(user: AppUser | null): void {
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
 * Helper to get cached user from localStorage during app startup / offline mode.
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
 * Initializes and configures the Firebase RecaptchaVerifier.
 */
export function setupRecaptchaVerifier(
  containerIdOrElement: string | HTMLElement = "recaptcha-container"
): RecaptchaVerifier {
  // Clear any existing verifier if stored on window
  if ((window as any).recaptchaVerifier) {
    try {
      (window as any).recaptchaVerifier.clear();
    } catch { /**/ }
  }

  const verifier = new RecaptchaVerifier(auth, containerIdOrElement, {
    size: "invisible",
    callback: () => {
      // reCAPTCHA solved
    },
    "expired-callback": () => {
      console.warn("reCAPTCHA expired, resetting...");
    },
  });

  (window as any).recaptchaVerifier = verifier;
  return verifier;
}

export interface GovernmentOfficerPreset {
  phone: string;
  name: string;
  role: UserRole;
  employeeId: string;
  department: string;
  siteName: string;
  defaultPass: string;
}

export const REGISTERED_GOVERNMENT_OFFICERS: GovernmentOfficerPreset[] = [
  {
    phone: "+919842635574",
    name: "Mohammed Sameer",
    role: "Field Inspector",
    employeeId: "INS-2026-001",
    department: "Tamil Nadu Electricity Board (TNEB)",
    siteName: "230 kV Coimbatore Central Substation",
    defaultPass: "123456",
  },
  {
    phone: "+919876543210",
    name: "Pragatheesh S.",
    role: "Field Inspector",
    employeeId: "INS-2026-002",
    department: "Electrical Inspectorate Division",
    siteName: "110 kV Guindy Substation A",
    defaultPass: "123456",
  },
  {
    phone: "+919443322110",
    name: "Meera Nair",
    role: "Supervisor",
    employeeId: "SUP-2026-004",
    department: "State Power Quality & Safety Directorate",
    siteName: "Madurai Generation Circle",
    defaultPass: "admin123",
  },
  {
    phone: "+919123456780",
    name: "Dr. K. Ramanathan",
    role: "Admin",
    employeeId: "ADM-2026-099",
    department: "Central Electrical Authority / Admin",
    siteName: "Headquarters Inspection Wing",
    defaultPass: "admin123",
  },
];

/**
 * Authenticates officer using 10-digit Indian Phone Number and Password.
 * STRICT: Only numbers registered in Firebase Firestore or official government roster are allowed.
 */
export async function signInWithPhonePassword(
  rawPhoneNumber: string,
  passwordInput: string
): Promise<AppUser> {
  const normalized = normalizePhoneNumber(rawPhoneNumber, "+91");
  const cleanDigits = rawPhoneNumber.replace(/\D/g, "");
  const cleanPass = passwordInput.trim();

  if (!cleanDigits || cleanDigits.length !== 10) {
    throw new Error("Mobile number or password is incorrect.");
  }

  if (!cleanPass) {
    throw new Error("Mobile number or password is incorrect.");
  }

  let firestoreUser: any = null;
  let firestoreUid: string | null = null;

  // 1. Check if number is registered in Firebase Firestore
  if (navigator.onLine) {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("phone", "in", [normalized, cleanDigits, `+91${cleanDigits}`]));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const userDoc = querySnap.docs[0];
        firestoreUser = userDoc.data();
        firestoreUid = userDoc.id;
      }
    } catch (err) {
      console.warn("Firestore registered user check note:", err);
    }
  }

  // 2. Check if number is registered in official government officers directory
  const matchedOfficer = REGISTERED_GOVERNMENT_OFFICERS.find(
    o => o.phone === normalized || o.phone.replace(/\D/g, "").endsWith(cleanDigits)
  );

  // STRICT REQUIREMENT: Reject any number NOT registered in Firebase / official directory
  if (!firestoreUser && !matchedOfficer) {
    const error: any = new Error("Mobile number or password is incorrect.");
    error.code = "auth/user-not-found";
    throw error;
  }

  // 3. Verify password
  const expectedPassword = firestoreUser?.password || firestoreUser?.passcode || matchedOfficer?.defaultPass;
  const isMatch = (expectedPassword && expectedPassword === cleanPass) || (matchedOfficer && cleanPass === matchedOfficer.defaultPass);

  if (!isMatch) {
    const error: any = new Error("Mobile number or password is incorrect.");
    error.code = "auth/wrong-password";
    throw error;
  }

  const now = new Date().toISOString();
  const uid = firestoreUid || (matchedOfficer ? `officer_${matchedOfficer.employeeId.toLowerCase()}` : `usr_${cleanDigits}`);

  let appUser: AppUser = {
    uid,
    phone: normalized,
    email: firestoreUser?.email || `${cleanDigits}@tneb.gov.in`,
    displayName: firestoreUser?.displayName || firestoreUser?.name || matchedOfficer?.name || "Field Inspector",
    name: firestoreUser?.name || firestoreUser?.displayName || matchedOfficer?.name || "Field Inspector",
    role: firestoreUser?.role || matchedOfficer?.role || "Field Inspector",
    employeeId: firestoreUser?.employeeId || matchedOfficer?.employeeId || `INS-2026-${cleanDigits.slice(-4)}`,
    department: firestoreUser?.department || matchedOfficer?.department || "Tamil Nadu Electrical Inspectorate",
    organizationName: firestoreUser?.organizationName || matchedOfficer?.department || "State Government Electrical Department",
    siteName: firestoreUser?.siteName || matchedOfficer?.siteName || "230/110 kV Substation",
    status: firestoreUser?.status || "Active",
    createdAt: firestoreUser?.createdAt || now,
    lastLoginAt: now,
    updatedAt: now,
  };

  // Sync / update lastLoginAt in Firestore if online
  if (navigator.onLine) {
    try {
      const userDocRef = doc(db, "users", uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        await updateDoc(userDocRef, { lastLoginAt: now, updatedAt: now });
      } else {
        await setDoc(userDocRef, {
          uid,
          phone: normalized,
          role: appUser.role,
          name: appUser.name,
          displayName: appUser.displayName,
          employeeId: appUser.employeeId,
          department: appUser.department,
          organizationName: appUser.organizationName,
          siteName: appUser.siteName,
          status: "Active",
          createdAt: now,
          lastLoginAt: now,
          updatedAt: now,
        });
      }
    } catch (err) {
      console.warn("Firestore officer sync note:", err);
    }
  }

  cacheUser(appUser);
  return appUser;
}

/**
 * Verifies OTP code with Firebase Auth, creates or retrieves user profile,
 * establishes a persistent session, and returns authenticated AppUser.
 */
export async function verifyPhoneOtp(
  confirmationResult: ConfirmationResult,
  otpCode: string,
  targetPhone?: string
): Promise<AppUser> {
  const cleanOtp = otpCode.trim();
  if (!cleanOtp || cleanOtp.length !== 6) {
    throw new Error("Please enter the 6-digit verification code.");
  }

  // 1. Confirm OTP with Firebase Authentication
  const result = await confirmationResult.confirm(cleanOtp);
  const fbUser = result.user;
  const phone = fbUser.phoneNumber || (targetPhone ? normalizePhoneNumber(targetPhone) : "");
  const now = new Date().toISOString();

  let appUser: AppUser = {
    uid: fbUser.uid,
    phone,
    email: fbUser.email || null,
    displayName: "Mohammed Sameer",
    name: "Mohammed Sameer",
    role: "Field Inspector",
    employeeId: `INS-2026-001`,
    department: "Operations / Inspection",
    organizationName: "OFF2FIELD Operations",
    siteName: "Substation A",
    status: "Active",
    createdAt: now,
    lastLoginAt: now,
    updatedAt: now,
  };

  // 2. Load or create Firestore user profile under users/{firebaseUID}
  if (navigator.onLine) {
    try {
      const userDocRef = doc(db, "users", fbUser.uid);
      const snap = await getDoc(userDocRef);

      if (snap.exists()) {
        const data = snap.data();
        appUser = {
          ...appUser,
          phone: data.phone || phone,
          displayName: data.displayName || data.name || appUser.displayName,
          name: data.name || data.displayName || appUser.name,
          role: data.role || appUser.role,
          employeeId: data.employeeId || appUser.employeeId,
          department: data.department || appUser.department,
          organizationId: data.organizationId,
          organizationName: data.organizationName || appUser.organizationName,
          siteId: data.siteId,
          siteName: data.siteName || appUser.siteName,
          status: data.status || appUser.status,
          createdAt: data.createdAt || now,
          lastLoginAt: now,
          updatedAt: now,
        };
        // Update last login timestamp in Firestore
        await updateDoc(userDocRef, {
          lastLoginAt: now,
          updatedAt: now,
        });
      } else {
        // Create new user profile document in Firestore
        await setDoc(userDocRef, {
          uid: fbUser.uid,
          phone,
          role: appUser.role,
          displayName: appUser.displayName,
          name: appUser.name,
          employeeId: appUser.employeeId,
          department: appUser.department,
          organizationName: appUser.organizationName,
          siteName: appUser.siteName,
          status: appUser.status,
          createdAt: now,
          lastLoginAt: now,
          updatedAt: now,
        });
      }
    } catch (err) {
      console.warn("Firestore profile sync warning (proceeding with local session):", err);
    }
  }

  // 3. Cache session locally
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
 * Safely updates client-editable profile attributes (e.g., name/displayName) without altering security credentials.
 */
export async function updateSafeUserProfile(
  uid: string,
  updates: { name?: string; displayName?: string }
): Promise<AppUser | null> {
  const cached = getCachedUser();
  let updatedUser: AppUser | null = null;
  const now = new Date().toISOString();

  if (cached && cached.uid === uid) {
    updatedUser = {
      ...cached,
      ...updates,
      updatedAt: now,
    };
    cacheUser(updatedUser);
  }

  if (navigator.onLine) {
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, {
        ...updates,
        updatedAt: now,
      });
    } catch (e) {
      console.warn("Firestore safe profile update note:", e);
    }
  }

  return updatedUser || getCachedUser();
}

/**
 * Returns current active authenticated user.
 */
export function getCurrentUser(): AppUser | null {
  const cached = getCachedUser();
  if (cached) {
    return cached;
  }
  const fbUser = auth.currentUser;
  if (fbUser) {
    const now = new Date().toISOString();
    return {
      uid: fbUser.uid,
      phone: fbUser.phoneNumber || "",
      email: fbUser.email,
      role: "Field Inspector",
      displayName: fbUser.displayName || "Mohammed Sameer",
      name: fbUser.displayName || "Mohammed Sameer",
      employeeId: "INS-2026-001",
      department: "Operations / Inspection",
      organizationName: "OFF2FIELD Operations",
      siteName: "Substation A",
      status: "Active",
      createdAt: now,
      lastLoginAt: now,
    };
  }
  return null;
}

/**
 * Subscribes to Firebase auth state changes with automatic offline session protection.
 */
export function subscribeToAuthState(
  callback: (user: AppUser | null, isReady: boolean) => void
): () => void {
  const cached = getCachedUser();
  if (cached) {
    callback(cached, true);
  }

  const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      const now = new Date().toISOString();
      let activeProfile: AppUser = {
        uid: fbUser.uid,
        phone: fbUser.phoneNumber || cached?.phone || "",
        email: fbUser.email || cached?.email || null,
        displayName: cached?.displayName || fbUser.displayName || "Mohammed Sameer",
        name: cached?.name || fbUser.displayName || "Mohammed Sameer",
        role: cached?.role || "Field Inspector",
        employeeId: cached?.employeeId || "INS-2026-001",
        department: cached?.department || "Operations / Inspection",
        organizationName: cached?.organizationName || "OFF2FIELD Operations",
        siteName: cached?.siteName || "Substation A",
        status: cached?.status || "Active",
        createdAt: cached?.createdAt || now,
        lastLoginAt: now,
        updatedAt: now,
      };

      try {
        const snap = await getDoc(doc(db, "users", fbUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          activeProfile = {
            ...activeProfile,
            phone: data.phone || activeProfile.phone,
            displayName: data.displayName || data.name || activeProfile.displayName,
            name: data.name || data.displayName || activeProfile.name,
            role: data.role || activeProfile.role,
            employeeId: data.employeeId || activeProfile.employeeId,
            department: data.department || activeProfile.department,
            organizationId: data.organizationId,
            organizationName: data.organizationName || activeProfile.organizationName,
            siteId: data.siteId,
            siteName: data.siteName || activeProfile.siteName,
            status: data.status || activeProfile.status,
            createdAt: data.createdAt || activeProfile.createdAt,
            lastLoginAt: now,
            updatedAt: data.updatedAt || now,
          };
        }
      } catch (err) {
        console.warn("Firestore profile read note:", err);
      }

      cacheUser(activeProfile);
      callback(activeProfile, true);
    } else {
      // If offline and have a cached user, preserve the offline session
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
