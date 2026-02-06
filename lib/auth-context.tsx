import React, { createContext, useContext, useReducer, useEffect, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
      return { ...state, error: action.payload, isLoading: false };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    case "LOGOUT":
      return { ...state, user: null, token: null };
    case "SET_INITIALIZED":
      return { ...state, isInitialized: true };
    default:
      return state;
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth from secure storage
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        dispatch({ type: "SET_LOADING", payload: true });

        // Try to get token from secure storage
        const token = await SecureStore.getItemAsync("auth_token");
        const userJson = await AsyncStorage.getItem("auth_user");

        if (token && userJson) {
          const user = JSON.parse(userJson) as User;
          dispatch({ type: "SET_TOKEN", payload: token });
          dispatch({ type: "SET_USER", payload: user });
        }
      } catch (error) {
        console.error("[Auth] Failed to initialize:", error);
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
      // TODO: Call backend login endpoint
      // const response = await fetch("/api/auth/login", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ email, password }),
      // });

      // For now, mock the response
      const mockUser: User = {
        id: `user_${Date.now()}`,
        email,
        firstName: email.split("@")[0],
        lastName: null,
        role: "cleaner",
        companyId: null,
        managerId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockToken = `token_${Date.now()}`;

      // Store token securely
      await SecureStore.setItemAsync("auth_token", mockToken);
      await AsyncStorage.setItem("auth_user", JSON.stringify(mockUser));

      dispatch({ type: "SET_TOKEN", payload: mockToken });
      dispatch({ type: "SET_USER", payload: mockUser });
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
      // TODO: Call backend logout endpoint
      // await fetch("/api/auth/logout", { method: "POST" });

      // Clear secure storage
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
    if (!state.token) {
      throw new Error("No token available");
    }

    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // TODO: Call backend to get current user
      // const response = await fetch("/api/auth/me", {
      //   headers: { Authorization: `Bearer ${state.token}` },
      // });
      // const data = await response.json();
      // dispatch({ type: "SET_USER", payload: data.user });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to refresh user";
      dispatch({ type: "SET_ERROR", payload: message });
      throw error;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    // TODO: Call backend to update user role (Super Manager only)
    // This will be implemented when building the Super Manager screens
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

// ============================================================================
// PERMISSION HOOKS
// ============================================================================

/**
 * Check if user is a Super Manager
 */
export function useIsSuperManager(): boolean {
  const { user } = useAuth();
  return user?.role === "super_manager";
}

/**
 * Check if user is a Manager or Super Manager
 */
export function useIsManager(): boolean {
  const { user } = useAuth();
  return user?.role === "manager" || user?.role === "super_manager";
}

/**
 * Check if user is a Cleaner
 */
export function useIsCleaner(): boolean {
  const { user } = useAuth();
  return user?.role === "cleaner";
}

/**
 * Check if user has permission to perform an action
 */
export function useCanPerformAction(action: "assign_jobs" | "view_guests" | "contact_guests" | "override_job" | "adjust_pricing"): boolean {
  const { user } = useAuth();

  if (!user) return false;

  switch (action) {
    case "assign_jobs":
      return user.role === "manager" || user.role === "super_manager";
    case "view_guests":
      return user.role === "super_manager";
    case "contact_guests":
      return user.role === "super_manager";
    case "override_job":
      return user.role === "super_manager";
    case "adjust_pricing":
      return user.role === "manager" || user.role === "super_manager";
    default:
      return false;
  }
}

/**
 * Get user's display name
 */
export function useUserDisplayName(): string {
  const { user } = useAuth();
  if (!user) return "Unknown";
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user.firstName) {
    return user.firstName;
  }
  return user.email;
}
