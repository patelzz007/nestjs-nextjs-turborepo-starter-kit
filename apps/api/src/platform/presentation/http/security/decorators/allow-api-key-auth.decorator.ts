import { SetMetadata } from "@nestjs/common";
import type { TenantApiKeyScope } from "@workspace/shared";

import type { ApiKeyProvider } from "../../../../application/ports/api-key-verification.port";
import { ALLOW_API_KEY_AUTH_KEY } from "../api-keys/api-key-request";

export interface AllowApiKeyAuthOptions {
	readonly providers?: readonly ApiKeyProvider[];
	/** Merchant key scopes accepted on the route (default: `INTEGRATION` only — a POS till key never reaches the tenant API). */
	readonly scopes?: readonly TenantApiKeyScope[];
}

/** Key scopes an `@AllowApiKeyAuth()` route accepts when the decorator names none. */
export const DEFAULT_ALLOWED_API_KEY_SCOPES: readonly TenantApiKeyScope[] = ["INTEGRATION"];

const DEFAULT_ALLOW_API_KEY_AUTH_OPTIONS: AllowApiKeyAuthOptions = {
	providers: ["merchant"],
	scopes: DEFAULT_ALLOWED_API_KEY_SCOPES,
};

/**
 * Marks a route as accepting API key authentication (in addition to JWT).
 * Use with `MerchantActorInterceptor` so services receive a unified actor context.
 */
export const AllowApiKeyAuth = (options?: AllowApiKeyAuthOptions): ReturnType<typeof SetMetadata> =>
	SetMetadata(ALLOW_API_KEY_AUTH_KEY, options ?? DEFAULT_ALLOW_API_KEY_AUTH_OPTIONS);
