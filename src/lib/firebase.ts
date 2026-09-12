import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  type Auth,
  type Persistence,
} from "firebase/auth";
// The `firebase` umbrella package maps ./auth to browser types unconditionally,
// so getReactNativePersistence is missing from the type surface even though
// Metro resolves @firebase/auth to its react-native build, which does export it.
// See https://github.com/firebase/firebase-js-sdk/issues/9316 — @ts-expect-error
// will start failing once that ships, which is the signal to delete these lines.
// @ts-expect-error
import { getReactNativePersistence as untypedRnPersistence } from "firebase/auth";

/** Mirrors @firebase/auth's ReactNativeAsyncStorage, which we can't import here. */
interface ReactNativeAsyncStorage {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
}

// Restores the argument checking that @ts-expect-error would otherwise discard
// by widening the import to `any`.
const getReactNativePersistence = untypedRnPersistence as (
  storage: ReactNativeAsyncStorage,
) => Persistence;
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length > 0) {
  throw new Error(
    `Firebase config is incomplete (missing: ${missing.join(", ")}). ` +
      `Copy .env.example to .env, fill in the values from the Firebase Console, ` +
      `then restart the dev server with 'npx expo start --clear'.`,
  );
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// The Firebase JS SDK defaults to in-memory persistence on React Native, which
// signs the user out on every cold start. AsyncStorage has to be wired in
// explicitly. The web build resolves a browser bundle that has no
// getReactNativePersistence and persists to localStorage on its own.
function createAuth(): Auth {
  if (Platform.OS === "web") {
    return getAuth(app);
  }

  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Already initialized — happens when Fast Refresh re-evaluates this module.
    return getAuth(app);
  }
}

const auth: Auth = createAuth();

export const db = getFirestore(app);
export const storage = getStorage(app);
export { auth };
export default app;
