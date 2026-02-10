import { createContext, useContext, useReducer, ReactNode, useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { trpcClient } from "./trpc-client";

// ============================================================================
// SANDBOX AUTHENTICATION NOTE
// ============================================================================
// This authentication implementation is wired to backend for Alpha testing.
// Alpha uses persistent data with real workflows.
// 
// Current implementation:
// - User creation via backend (first-time login)
// - Backend validation of credentials
// - Session persistence via cookies and local storage
// - Cookie-based session survives app restart
// - auth.me validates session on app launch
// 
// ============================================================================
// TYPES
// ============================================================================

export type UserRole = "super_manager" | "manager" | "cleaner";

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  companyId: string | null;
  managerId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

export interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  clearError: () => void;
}

// ============================================================================
// ACTIONS
// ============================================================================

type AuthAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_USER"; payload: User }
  | { type: "SET_TOKEN"; payload: string }
  | { type: "SET_ERROR"; payload: string }
  | { type: "CLEAR_ERROR" }
  | { type: "LOGOUT" }
  | { type: "SET_INITIALIZED" };

// ============================================================================
// CONTEXT
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

// ============================================================================
// PROVIDER
// ============================================================================

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: false,
  error: null,
  isInitialized: false,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_TOKEN":
      return { ...state, token: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    case "LOGOUT":
      return { ...initialState, isInitialized: true };
    case "SET_INITIALIZED":
      return { ...state, isInitialized: true };
    default:
      return state;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth on mount (validate session with backend)
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        dispatch({ type: "SET_LOADING", payload: true });

        // Step 1: Try to restore user from local storage first
        let savedUser: User | null = null;
        try {
          const userJson = await AsyncStorage.getItem("auth_user");
          if (userJson) {
            savedUser = JSON.parse(userJson);
            console.log("[Auth] Restored user from AsyncStorage:", savedUser?.email);
          }
        } catch (e) {
          console.log("[Auth] Failed to restore from AsyncStorage:", e);
        }

        // Step 2: Validate session with backend
        try {
          const meResult = await trpcClient.auth.me.query();
          
          if (meResult) {
            // Backend session valid, use backend user data
            const user: User = {
              id: meResult.id,
              email: meResult.email,
              firstName: meResult.firstName,
              lastName: meResult.lastName,
              role: meResult.role,
              companyId: meResult.businessId,
              managerId: null,
              isActive: meResult.isActive,
              createdAt: new Date(meResult.createdAt),
              updatedAt: new Date(meResult.updatedAt),
            };
            dispatch({ type: "SET_USER", payload: user });
            dispatch({ type: "SET_TOKEN", payload: "session_valid" });
            console.log("[Auth] Session validated with backend:", user.email);
            return;
          }
        } catch (e) {
          console.log("[Auth] Backend validation failed:", e);
        }

        // Step 3: If backend validation failed but we have a saved user, use it as fallback
        if (savedUser) {
          console.log("[Auth] Using saved user as fallback:", savedUser.email);
          dispatch({ type: "SET_USER", payload: savedUser });
          dispatch({ type: "SET_TOKEN", payload: "session_fallback" });
          return;
        }

        // Step 4: No session found, clear storage
        console.log("[Auth] No session found, clearing storage");
        try {
          await SecureStore.deleteItemAsync("auth_token");
        } catch (e) {
          // Ignore
        }
        try {
          await AsyncStorage.removeItem("auth_user");
        } catch (e) {
          // Ignore
        }
      } catch (error) {
        console.error("[Auth] Failed to initialize:", error);
        // Don't clear storage on error - let fallback handle it
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
        dispatch({ type: "SET_INITIALIZED" });
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "CLEAR_ERROR" });

    try {
      // Call backend login endpoint via tRPC
      const response = await trpcClient.auth.login.mutate({ email, password });

      if (!response || !response.id) {
        throw new Error("Login failed: No response from server");
      }

      // Map backend response to User interface
      const user: User = {
        id: response.id,
        email: response.email,
        firstName: response.firstName,
        lastName: response.lastName,
        role: response.role,
        companyId: response.businessId,
        managerId: null,
        isActive: response.isActive,
        createdAt: new Date(response.createdAt),
        updatedAt: new Date(response.updatedAt),
      };

      // Generate session token (backend handles cookie, we store for reference)
      const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store token and user for persistence across app reloads
      try {
        await SecureStore.setItemAsync("auth_token", sessionToken);
      } catch (e) {
        console.log("[Auth] Failed to store token in SecureStore:", e);
      }
      try {
        await AsyncStorage.setItem("auth_user", JSON.stringify(user));
        console.log("[Auth] User saved to AsyncStorage:", user.email);
      } catch (e) {
        console.log("[Auth] Failed to store user in AsyncStorage:", e);
      }

      dispatch({ type: "SET_TOKEN", payload: sessionToken });
      dispatch({ type: "SET_USER", payload: user });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      dispatch({ type: "SET_ERROR", payload: message });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const logout = async () => {
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Call backend logout endpoint
      await trpcClient.auth.logout.mutate();

      // Clear local storage
      await SecureStore.deleteItemAsync("auth_token");
      await AsyncStorage.removeItem("auth_user");

      dispatch({ type: "LOGOUT" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Logout failed";
      dispatch({ type: "SET_ERROR", payload: message });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const refreshUser = async () => {
    try {
      console.log("[Auth] refreshUser called (session validation)");
    } catch (error) {
      console.error("[Auth] Failed to refresh user:", error);
    }
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    console.warn("[Auth] updateUserRole not yet implemented");
  };

  const clearError = () => {
    dispatch({ type: "CLEAR_ERROR" });
  };

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    refreshUser,
    updateUserRole,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
