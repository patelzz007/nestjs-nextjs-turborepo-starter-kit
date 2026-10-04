import { SetMetadata } from "@nestjs/common";
import type { OrganizationApiKeyScope } from "@workspace/shared";

import { ALLOW_API_KEY_AUTH_KEY } from "../constants/api-key-auth.constants";
import type { ApiKeyProvider } from "../types/api-key-auth.types";

export interface AllowApiKeyAuthOptions {
	readonly providers?: readonly ApiKeyProvider[];
	/** Merchant key scopes accepted on the route (default: `INTEGRATION` only — a POS till key never reaches the organization API). */
	readonly scopes?: readonly OrganizationApiKeyScope[];
}

/** Key scopes an `@AllowApiKeyAuth()` route accepts when the decorator names none. */
export const DEFAULT_ALLOWED_API_KEY_SCOPES: readonly OrganizationApiKeyScope[] = ["INTEGRATION"];

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
