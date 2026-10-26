import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/authApi";
import type { AuthUser } from "../types/api";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export interface RegistrationInput {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  role: "seller" | "buyer";
  display_name?: string;
  location_name: string;
  latitude: number;
  longitude: number;
  solar_capacity_kw?: number;
  has_battery: boolean;
  battery_capacity_kwh?: number;
  household_category: string;
  demand_base_kw?: number;
  terms_accepted: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (payload: RegistrationInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function homeForRole(role: AuthUser["role"]): string {
  if (role === "seller") return "/seller";
  if (role === "buyer") return "/buyer";
  return "/";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refreshSession = useCallback(async () => {
    try {
      const session = await authApi.session();
      setUser(session.user);
      setStatus(session.user ? "authenticated" : "anonymous");
    } catch {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setStatus("anonymous");
      queryClient.clear();
    };
    window.addEventListener("solargrid:session-expired", onExpired);
    return () => window.removeEventListener("solargrid:session-expired", onExpired);
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authApi.login(email, password);
      queryClient.clear();
      setUser(result.user);
      setStatus("authenticated");
      return result.user;
    },
    [queryClient],
  );

  const register = useCallback(
    async (payload: RegistrationInput) => {
      const result = await authApi.register(payload as unknown as Record<string, unknown>);
      queryClient.clear();
      setUser(result.user);
      setStatus("authenticated");
      return result.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus("anonymous");
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, status, login, register, logout, refreshSession }),
    [user, status, login, register, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
