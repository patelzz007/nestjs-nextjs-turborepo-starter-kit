import { SetMetadata } from "@nestjs/common";

import { ALLOW_API_KEY_AUTH_KEY } from "../constants/api-key-auth.constants";
import type { ApiKeyProvider } from "../types/api-key-auth.types";

export interface AllowApiKeyAuthOptions {
	readonly providers?: readonly ApiKeyProvider[];
}

const DEFAULT_ALLOW_API_KEY_AUTH_OPTIONS: AllowApiKeyAuthOptions = {
	providers: ["merchant"],
};

/**
 * Marks a route as accepting API key authentication (in addition to JWT).
 * Use with `MerchantActorInterceptor` so services receive a unified actor context.
 */
export const AllowApiKeyAuth = (options?: AllowApiKeyAuthOptions): ReturnType<typeof SetMetadata> =>
	SetMetadata(ALLOW_API_KEY_AUTH_KEY, options ?? DEFAULT_ALLOW_API_KEY_AUTH_OPTIONS);
