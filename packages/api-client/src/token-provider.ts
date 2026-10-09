// ============================================
// token-provider.ts - where the token transport keeps its tokens
// ============================================
// The API client never stores a token itself: the app injects a provider. The
// mobile app backs it with its OS secret store (`expo-secure-store`, ADR 029);
// tests back it with memory. Every method is async because secret stores are.

import { z } from "zod";

import type { BodyTokenPair } from "./body-token-contract";

/** Storage of the access and refresh tokens of the body token transport. */
export interface TokenProvider {
	/** The current access token, or `null` when signed out. */
	getAccessToken(): Promise<string | null>;
	/** The current refresh token, or `null` when signed out. */
	getRefreshToken(): Promise<string | null>;
	/** Replaces both tokens (after a login or a refresh rotated them). */
	saveTokens(tokens: BodyTokenPair): Promise<void>;
	/** Removes both tokens (the session ended). */
	clearTokens(): Promise<void>;
}

const CallableSchema = z.function();

/** The provider's methods are real functions — checked by shape, never assumed. */
const TokenProviderShapeSchema = z.object({
	getAccessToken: CallableSchema,
	getRefreshToken: CallableSchema,
	saveTokens: CallableSchema,
	clearTokens: CallableSchema,
});

/**
 * A {@link TokenProvider}. The object itself passes through untouched (a class
 * instance keeps its prototype and its methods their `this`).
 */
export const TokenProviderSchema = z.custom<TokenProvider>((value) => TokenProviderShapeSchema.safeParse(value).success, {
	error: "must implement getAccessToken, getRefreshToken, saveTokens and clearTokens",
});
