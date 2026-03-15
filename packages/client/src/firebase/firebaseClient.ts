import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import type { UserProfile } from "@bumpbuddies/shared";
import { FIRESTORE } from "@bumpbuddies/shared";

// ─── Init ─────────────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp;

function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return app;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signInAnon(): Promise<User> {
  const auth = getAuth(getFirebaseApp());
  const result = await signInAnonymously(auth);
  return result.user;
}

export async function linkWithGoogle(): Promise<User | null> {
  const auth = getAuth(getFirebaseApp());
  if (!auth.currentUser) return null;
  const provider = new GoogleAuthProvider();
  const result = await linkWithPopup(auth.currentUser, provider);
  return result.user;
}

export function getCurrentUser(): User | null {
  return getAuth(getFirebaseApp()).currentUser;
}

export function onUserChanged(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getAuth(getFirebaseApp()), callback);
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, FIRESTORE.USERS, user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return snap.data() as UserProfile;
  }

  const profile: UserProfile = {
    uid: user.uid,
    displayName: user.displayName ?? `Player_${user.uid.slice(0, 6)}`,
    wins: 0,
    losses: 0,
    points: 0,
    createdAt: Date.now(),
  };
  await setDoc(ref, profile);
  return profile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getFirestore(getFirebaseApp());
  const ref = doc(db, FIRESTORE.USERS, uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getTopPlayers(count = 20): Promise<UserProfile[]> {
  const db = getFirestore(getFirebaseApp());
  const q = query(
    collection(db, FIRESTORE.USERS),
    orderBy("wins", "desc"),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserProfile);
}
