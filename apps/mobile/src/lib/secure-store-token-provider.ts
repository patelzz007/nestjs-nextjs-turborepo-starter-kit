// ============================================
// secure-store-token-provider.ts - where the token transport keeps its tokens
// ============================================
// The api-client never stores a token itself (ADR 029); this provider backs it
// with the OS secret store. The refresh token is read only while the app is
// signed in and unlocked (§11.2): a locked or starting app cannot refresh, so
// nobody who picks up the phone can extend the session past the lock.

import type { BodyTokenPair, TokenProvider } from "@workspace/api-client";

import { deleteSecureValue, readSecureValue, SECURE_STORE_ENTRIES, writeSecureValue } from "./secure-store";

/** The refresh token was asked for while the app lock is pending. */
export class RefreshTokenLockedError extends Error {
	public constructor() {
		super("The refresh token is not readable until the app lock is satisfied.");
		this.name = "RefreshTokenLockedError";
	}
}

export interface SecureStoreTokenProviderOptions {
	/** Whether the refresh token may be read now (signed in and unlocked). */
	readonly canReadRefreshToken: () => boolean;
	/** Called after a new pair is stored (sign-in, refresh) with the new access token. */
	readonly onTokensSaved?: (accessToken: string) => void;
}

export class SecureStoreTokenProvider implements TokenProvider {
	private readonly _options: SecureStoreTokenProviderOptions;

	public constructor(options: SecureStoreTokenProviderOptions) {
		this._options = options;
	}

	public getAccessToken(): Promise<string | null> {
		return readSecureValue(SECURE_STORE_ENTRIES.accessToken);
	}

	/** @throws {RefreshTokenLockedError} while the app lock is pending (the api-client treats it as "no verdict"). */
	public getRefreshToken(): Promise<string | null> {
		if (!this._options.canReadRefreshToken()) {
			return Promise.reject(new RefreshTokenLockedError());
		}
		return readSecureValue(SECURE_STORE_ENTRIES.refreshToken);
	}

	public async saveTokens(tokens: BodyTokenPair): Promise<void> {
		// Refresh token first: an access token without its refresh token would end the session on its first expiry.
		await writeSecureValue(SECURE_STORE_ENTRIES.refreshToken, tokens.refreshToken);
		await writeSecureValue(SECURE_STORE_ENTRIES.accessToken, tokens.accessToken);
		this._options.onTokensSaved?.(tokens.accessToken);
	}

	public async clearTokens(): Promise<void> {
		await deleteSecureValue(SECURE_STORE_ENTRIES.accessToken);
		await deleteSecureValue(SECURE_STORE_ENTRIES.refreshToken);
	}
}
