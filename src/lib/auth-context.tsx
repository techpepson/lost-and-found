import createContextHook from "@nkzw/create-context-hook";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useEffect, useState, useCallback, useMemo } from "react";

interface UserData {
  uid: string;
  email: string | null;
  displayName?: string | null;
  createdAt: Date;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const [AuthProvider, useAuth] = createContextHook<AuthContextType>(
  () => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser);

        if (firebaseUser) {
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid));
          if (userDoc.exists()) {
            setUserData(userDoc.data() as UserData);
          }
        } else {
          setUserData(null);
        }

        setIsLoading(false);
      });

      return () => unsubscribe();
    }, []);

    const signUp = useCallback(async (email: string, password: string) => {
      try {
        const { user: newUser } = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const userData: UserData = {
          uid: newUser.uid,
          email: newUser.email,
          createdAt: new Date(),
        };
        await setDoc(doc(db, "users", newUser.uid), userData);
        setUserData(userData);
      } catch (error: any) {
        console.error("Auth context signup error:", error);

        // Provide user-friendly error messages
        if (error.code === "auth/email-already-in-use") {
          throw new Error(
            "This email is already registered. Please sign in instead.",
          );
        } else if (error.code === "auth/invalid-email") {
          throw new Error("Please enter a valid email address.");
        } else if (error.code === "auth/weak-password") {
          throw new Error(
            "Password is too weak. Please use at least 6 characters.",
          );
        } else if (error.code === "auth/network-request-failed") {
          throw new Error(
            "Network error. Please check your internet connection.",
          );
        } else if (error.code === "auth/configuration-not-found") {
          throw new Error(
            "Firebase is not properly configured. Please contact support.",
          );
        } else {
          throw new Error(
            error.message || "Failed to create account. Please try again.",
          );
        }
      }
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error: any) {
        console.error("Auth context signin error:", error);

        // Provide user-friendly error messages
        if (error.code === "auth/user-not-found") {
          throw new Error(
            "No account found with this email. Please sign up first.",
          );
        } else if (error.code === "auth/wrong-password") {
          throw new Error("Incorrect password. Please try again.");
        } else if (error.code === "auth/invalid-email") {
          throw new Error("Please enter a valid email address.");
        } else if (error.code === "auth/invalid-credential") {
          throw new Error("Invalid email or password. Please try again.");
        } else if (error.code === "auth/network-request-failed") {
          throw new Error(
            "Network error. Please check your internet connection.",
          );
        } else if (error.code === "auth/too-many-requests") {
          throw new Error("Too many failed attempts. Please try again later.");
        } else {
          throw new Error(
            error.message || "Failed to sign in. Please try again.",
          );
        }
      }
    }, []);

    const logout = useCallback(async () => {
      await signOut(auth);
    }, []);

    return useMemo(
      () => ({ user, userData, isLoading, signUp, signIn, logout }),
      [user, userData, isLoading, signUp, signIn, logout],
    );
  },
);
