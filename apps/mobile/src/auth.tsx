import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { clearTokens, loadTokens, setTokens } from "./session";
import type { PublicUser } from "./types";

interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, heightCm: number) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (u: PublicUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Przy starcie: spróbuj wczytać zapisane tokeny i pobrać profil.
  useEffect(() => {
    (async () => {
      try {
        const tokens = await loadTokens();
        if (tokens) setUser(await api.me());
      } catch {
        await clearTokens();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      async signIn(username, password) {
        const res = await api.login({ username, password });
        await setTokens(res.tokens);
        setUser(res.user);
      },
      async signUp(username, password, heightCm) {
        const res = await api.register({ username, password, heightCm });
        await setTokens(res.tokens);
        setUser(res.user);
      },
      async signOut() {
        await clearTokens();
        setUser(null);
      },
      setUser,
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth musi być użyte wewnątrz AuthProvider");
  return ctx;
}
