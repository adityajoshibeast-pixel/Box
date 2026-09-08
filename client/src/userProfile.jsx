import { createContext, useContext } from "react";

export const USERNAME_STORAGE_KEY = "resource_navigator_username";

export const UserProfileContext = createContext({
  username: "",
  requestUsernameChange: () => {},
});

export function useUserProfile() {
  return useContext(UserProfileContext);
}

export function normalizeUsername(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
}
