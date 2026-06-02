import * as SecureStore from "expo-secure-store";
import type { AuthTokens } from "./types";

const ACCESS_KEY = "betaclimb.accessToken";
const REFRESH_KEY = "betaclimb.refreshToken";

// Tokeny trzymamy w pamięci dla szybkiego dostępu i w SecureStore dla trwałości.
let access: string | null = null;
let refresh: string | null = null;

export async function loadTokens(): Promise<AuthTokens | null> {
  access = await SecureStore.getItemAsync(ACCESS_KEY);
  refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  if (access && refresh) return { accessToken: access, refreshToken: refresh };
  return null;
}

export async function setTokens(tokens: AuthTokens): Promise<void> {
  access = tokens.accessToken;
  refresh = tokens.refreshToken;
  await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
}

export async function clearTokens(): Promise<void> {
  access = null;
  refresh = null;
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export function getAccessToken(): string | null {
  return access;
}

export function getRefreshToken(): string | null {
  return refresh;
}
