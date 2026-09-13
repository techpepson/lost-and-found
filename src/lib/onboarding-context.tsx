import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

const key = "legon.onboarding.v1";
const Context = createContext({
  ready: false,
  seen: false,
  complete: async () => {},
});

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key)
      .then((value) => {
        if (active) setSeen(value === "done");
      })
      .catch(() => {
        /* A storage failure shows onboarding rather than trapping launch. */
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function complete() {
    await AsyncStorage.setItem(key, "done");
    setSeen(true);
  }
  return (
    <Context.Provider value={{ ready, seen, complete }}>
      {children}
    </Context.Provider>
  );
}
export const useOnboarding = () => useContext(Context);
