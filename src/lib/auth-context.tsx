import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onIdTokenChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { auth } from "./firebase";
import { mutate, errorMessage } from "./api";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
  verified: boolean;
  error: string;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  verify: () => Promise<void>;
  reset: (email: string) => Promise<void>;
}
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isAdmin, setAdmin] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let generation = 0;
    let active = true;
    const off = onIdTokenChanged(
      auth,
      async (current) => {
        const run = ++generation;
        setLoading(true);
        setError("");
        setUser(current);
        setAdmin(false);
        setVerified(current?.emailVerified ?? false);
        try {
          if (current) {
            const token = await current.getIdTokenResult();
            await mutate("syncProfile");
            if (active && run === generation)
              setAdmin(token.claims.admin === true);
          }
        } catch (e) {
          if (active && run === generation) setError(errorMessage(e));
        } finally {
          if (active && run === generation) setLoading(false);
        }
      },
      (e) => {
        if (active) {
          setError(errorMessage(e));
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
      off();
    };
  }, []);
  const sync = async () => {
    await mutate("syncProfile");
  };
  const refresh = async () => {
    setLoading(true);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        await auth.currentUser.getIdToken(true);
        setUser(auth.currentUser);
        setVerified(auth.currentUser.emailVerified);
        await sync();
      }
      setError("");
    } catch (e) {
      setError(errorMessage(e));
      throw e;
    } finally {
      setLoading(false);
    }
  };
  const signUp = async (email: string, password: string, name = "") => {
    const result = await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password,
    );
    await updateProfile(result.user, { displayName: name.trim() });
    await sendEmailVerification(result.user);
    await sync();
  };
  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };
  return (
    <Context.Provider
      value={{
        user,
        isLoading,
        isAdmin,
        verified,
        error,
        signUp,
        signIn,
        logout: () => signOut(auth),
        refresh,
        verify: async () => {
          if (auth.currentUser) await sendEmailVerification(auth.currentUser);
        },
        reset: (email) => sendPasswordResetEmail(auth, email.trim()),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error("AuthProvider is missing.");
  return context;
}
