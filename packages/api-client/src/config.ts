// ============================================
// config.ts - the injected, zod-validated client configuration
// ============================================
// The package reads no environment: every app resolves its own API address
// (Next: `NEXT_PUBLIC_API_URL`; mobile: the Expo host or `EXPO_PUBLIC_API_URL`)
// and injects it here with its client type and transport. The config is
// validated when the client is built, so a wrong one fails at app start, not
// on the first request.

import {
	APP_VERSION_HEADER,
	AppVersionSchema,
	AuthClientTypeSchema,
	CLIENT_TYPE_HEADER,
	HttpUrlEnvSchema,
	isBrowserClientType,
	MUTATION_INTENT_HEADER,
} from "@workspace/shared";
import { z } from "zod";

import type { RefreshCall } from "./refresh";
import type { ApiRequestContext } from "./request";
import { AUTHORIZATION_HEADER } from "./http";
import { TokenProviderSchema } from "./token-provider";
import { COOKIE_REQUEST_TRANSPORT, createTokenRequestTransport, type OnSessionExpired } from "./transport";

const CallableSchema = z.function();

/** A cookie-transport refresh call (the web auth facade's single-flight cookie refresh). */
const RefreshCallSchema = z.custom<RefreshCall>((value) => CallableSchema.safeParse(value).success, { error: "must be a function" });

const OnSessionExpiredSchema = z.custom<OnSessionExpired>((value) => CallableSchema.safeParse(value).success, { error: "must be a function" });

/**
 * Cookie transport (browsers): requests carry the httpOnly session cookies
 * (`credentials: "include"`). `refreshSession` runs on a 401; the web auth
 * facade passes its single-flight cookie refresh.
 */
export const CookieTransportSchema = z.strictObject({
	kind: z.literal("cookie"),
	refreshSession: RefreshCallSchema.optional(),
});

/**
 * Token transport (mobile, ADR 029): requests carry `Authorization: Bearer`;
 * the tokens live in the injected provider (the device's secret store).
 */
export const TokenTransportSchema = z.strictObject({
	kind: z.literal("token"),
	tokenProvider: TokenProviderSchema,
});

export const ApiClientTransportSchema = z.discriminatedUnion("kind", [CookieTransportSchema, TokenTransportSchema]);

export type CookieTransport = z.input<typeof CookieTransportSchema>;

export type TokenTransport = z.input<typeof TokenTransportSchema>;

/** An HTTP header name: an RFC 9110 token. */
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/** Visible ASCII and spaces/tabs only — header values are bytes; anything else must be percent-encoded first. */
const HEADER_VALUE_PATTERN = /^[\t\x20-\x7e]*$/;

/**
 * Headers the client itself owns. A config may not set them: the session
 * transport, the client type, the app version and the mutation intent are
 * never the caller's to override.
 */
const RESERVED_HEADER_NAMES: readonly string[] = [
	AUTHORIZATION_HEADER,
	CLIENT_TYPE_HEADER,
	APP_VERSION_HEADER,
	MUTATION_INTENT_HEADER,
	"Accept",
	"Content-Type",
	"Cookie",
].map((name: string): string => name.toLowerCase());

/**
 * Extra headers sent with EVERY request of the client, the refresh included —
 * e.g. the mobile app's device model and name (`X-Device-Model` / `X-Device-Name`,
 * percent-encoded). Display data only; a per-call header of the same name wins.
 */
export const ApiClientHeadersSchema = z
	.record(z.string().regex(HEADER_NAME_PATTERN, "must be an HTTP header name"), z.string().regex(HEADER_VALUE_PATTERN, "must be visible ASCII (percent-encode other text)"))
	.refine((headers): boolean => Object.keys(headers).every((name: string): boolean => !RESERVED_HEADER_NAMES.includes(name.toLowerCase())), {
		error: "must not set a header the client owns (Authorization, X-Client-Type, X-App-Version, the mutation intent, Accept, Content-Type, Cookie)",
	});

/**
 * Everything the API client needs, injected by the app. The transport follows
 * the client type, never a separate flag (ADR 029): `mobile` uses the token
 * transport and sends its app version; the browser client types use the
 * cookie transport and send no app version.
 */
export const ApiClientConfigSchema = z
	.strictObject({
		/** Absolute http(s) address of the API (each app resolves it its own way). */
		baseUrl: HttpUrlEnvSchema,
		clientType: AuthClientTypeSchema,
		transport: ApiClientTransportSchema,
		/** Mobile only: the app's semantic version, sent as `X-App-Version` (ADR 033) — the shared `AppVersionSchema` the API checks. */
		appVersion: AppVersionSchema.optional(),
		/** The session ended for good (refresh refused or session revoked); the app routes to sign-in. */
		onSessionExpired: OnSessionExpiredSchema.optional(),
		/** Static headers for every request of this client (see {@link ApiClientHeadersSchema}). */
		headers: ApiClientHeadersSchema.optional(),
	})
	.superRefine((config, context): void => {
		const isMobile = !isBrowserClientType(config.clientType);
		if (isMobile && config.transport.kind !== "token") {
			context.addIssue({ code: "custom", path: ["transport"], message: "the mobile client type uses the token transport (ADR 029)" });
		}
		if (!isMobile && config.transport.kind === "token") {
			context.addIssue({ code: "custom", path: ["transport"], message: "browser client types use the cookie transport (ADR 029)" });
		}
		if (isMobile && config.appVersion === undefined) {
			context.addIssue({ code: "custom", path: ["appVersion"], message: "the mobile client type must send its app version (ADR 033)" });
		}
		if (!isMobile && config.appVersion !== undefined) {
			context.addIssue({ code: "custom", path: ["appVersion"], message: "only the mobile client type sends an app version (ADR 033)" });
		}
	});

/** What an app passes to {@link createApiClientContext}. */
export type ApiClientConfig = z.input<typeof ApiClientConfigSchema>;

/** One problem of a rejected config: where, and why — never the value (it may be a secret). */
export interface ApiClientConfigIssue {
	readonly path: string;
	readonly message: string;
}

/** The injected config is not valid. Thrown when the client is built, so it fails at app start. */
export class InvalidApiClientConfigError extends Error {
	public readonly issues: readonly ApiClientConfigIssue[];

	public constructor(issues: readonly ApiClientConfigIssue[]) {
		super(`Invalid API client config — ${issues.map((issue: ApiClientConfigIssue): string => `${issue.path}: ${issue.message}`).join("; ")}`);
		this.name = "InvalidApiClientConfigError";
		this.issues = issues;
	}
}

function toConfigIssue(issue: z.core.$ZodIssue): ApiClientConfigIssue {
	return {
		path: issue.path.length === 0 ? "root" : issue.path.map((segment: PropertyKey): string => String(segment)).join("."),
		message: issue.message,
	};
}

/**
 * Validates the injected config and builds the request context every call of
 * this client shares. Build it once per app (or once per auth provider mount):
 * a token transport holds the single-flight refresh, so two contexts would
 * mean two refreshes racing for one refresh token.
 *
 * @throws {InvalidApiClientConfigError} when the config is not valid.
 */
export function createApiClientContext(input: ApiClientConfig): ApiRequestContext {
	const parsed = ApiClientConfigSchema.safeParse(input);
	if (!parsed.success) {
		throw new InvalidApiClientConfigError(parsed.error.issues.map(toConfigIssue));
	}
	const { baseUrl, clientType, transport, appVersion, onSessionExpired, headers } = parsed.data;

	switch (transport.kind) {
		case "cookie":
			return { baseUrl, clientType, headers, onUnauthorized: onSessionExpired, onRefresh: transport.refreshSession, transport: COOKIE_REQUEST_TRANSPORT };
		case "token":
			return {
				baseUrl,
				clientType,
				appVersion,
				headers,
				transport: createTokenRequestTransport({ baseUrl, clientType, appVersion, headers, tokenProvider: transport.tokenProvider, onSessionExpired }),
			};
	}
}
