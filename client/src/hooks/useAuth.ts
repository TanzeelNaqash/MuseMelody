import { useCallback, useEffect, useMemo, useState } from "react";

type StoredUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  isEmailVerified?: boolean | null;
};

interface UseAuthResult {
  user: StoredUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  login: (user: StoredUser, token: string) => void;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token");
    const storedUserRaw = localStorage.getItem("auth_user");

    if (!storedToken || !storedUserRaw) {
      setIsLoading(false);
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUserRaw) as StoredUser;
      setToken(storedToken);
      setUser(parsedUser);

      const isGuest = storedToken === "guest-token" || parsedUser.id === "guest";
      if (isGuest) {
        setIsLoading(false);
        return;
      }

      // Validate token with server, but don't clear on network errors
      fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:5001"}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
        credentials: "include",
      })
        .then(async (response) => {
          if (!response.ok) {
            // Only clear if it's a 403 (invalid token), not network errors
            if (response.status === 403 || response.status === 401) {
              throw new Error("Token invalid");
            }
            // For other errors, keep the cached user
            return parsedUser;
          }
          return (await response.json()) as StoredUser;
        })
        .then((freshUser) => {
          // Update with fresh user data
          setUser(freshUser);
          localStorage.setItem("auth_user", JSON.stringify(freshUser));
        })
        .catch((error) => {
          // Only clear if token is explicitly invalid (403/401)
          // For network errors, keep the cached user
          if (error.message === "Token invalid") {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
            setToken(null);
            setUser(null);
          }
          // Otherwise, keep the cached user data
        })
        .finally(() => setIsLoading(false));
    } catch {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      setToken(null);
      setUser(null);
      setIsLoading(false);
    }
  }, []);

  const login = useCallback((userData: StoredUser, authToken: string) => {
    // Update state immediately
    setUser(userData);
    setToken(authToken);
    // Ensure localStorage is set (should already be set, but double-check)
    localStorage.setItem("auth_token", authToken);
    localStorage.setItem("auth_user", JSON.stringify(userData));
    // Ensure the app stops showing loading and renders main UI immediately
    setIsLoading(false);
    // State update will trigger isAuthenticated to become true
    // Router will re-render and show main page
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:5001"}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch (error) {
      console.warn("logout failed", error);
    }

    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setToken(null);
    setUser(null);

    try {
      window.location.reload();
    } catch {
      /* noop */
    }
  }, [token]);

  const { isAuthenticated, isGuest } = useMemo(() => {
    const guest = user?.id === "guest" || token === "guest-token";
    // Allow both authenticated users and guests to access the app
    return {
      isAuthenticated: (!!user && !!token) || guest,
      isGuest: guest,
    };
  }, [token, user]);

  return {
    user,
    isLoading,
    isAuthenticated,
    isGuest,
    login,
    logout,
  };
}
