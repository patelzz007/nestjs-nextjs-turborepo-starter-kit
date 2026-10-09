// ============================================
// contracts/versioning.ts - API versioning (single source of truth)
// ============================================
// The API serves every business endpoint under `/api/v1/<path>`. Instead of
// Nest's `enableVersioning` machinery (whose `VERSION_NEUTRAL`/exclude
// handling was the source of subtle path bugs), the version prefix is a plain
// constant: the SERVER controller decorators build their physical paths with
// `apiPath()`, and the CLIENT transport prepends the same `API_VERSION_PREFIX`
// to the logical contract paths — both sides derive from this one definition,
// so they can never drift. Unversioned routes (health / webhook / the version
// manifest) simply don't use `apiPath()`.
//
// Deliberately a STANDALONE module with no workspace imports (only zod) —
// `contracts/index.ts` imports schemas, so importing `../../contracts` from a
// schema would create a runtime circular-import crash. Anything that only needs
// the version constants imports `./versioning` directly.

import { z } from "zod";

/** The API versions that exist. Add `"v3"` here before any new major. */
export const ApiVersionSchema = z.enum(["v1", "v2"]);

export type ApiVersion = z.output<typeof ApiVersionSchema>;

/** The current default version served by the API. */
export const API_VERSION: ApiVersion = "v1";

/** Build a versioned path prefix (`"v1"` → `"/api/v1"`). */
export function apiVersionPrefix(version: ApiVersion): string {
	return `/api/${version}`;
}

export const API_VERSION_PREFIX: string = apiVersionPrefix(API_VERSION);

/**
 * Route prefixes that are allowed to stay UNVERSIONED. Every other controller
 * MUST use `apiPath()` — enforced by the `no-unversioned-controller` ESLint
 * rule in apps/api (a controller that forgets the helper silently serves a
 * path the client can't reach, exactly like the `/session` regression).
 */
export const UnversionedRoutePrefixSchema = z.enum(["", "health", "notifications/email-webhook", "version"]);

export type UnversionedRoutePrefix = z.output<typeof UnversionedRoutePrefixSchema>;

export const UNVERSIONED_ROUTE_PREFIXES: readonly UnversionedRoutePrefix[] = UnversionedRoutePrefixSchema.options;

/**
 * Every business controller prefix, as a compile-time literal union: a typo
 * like `apiPath("/authh")` now fails to compile instead of 404ing at runtime.
 */
export const VersionedRoutePrefixSchema = z.enum([
	"/auth",
	"/auth/signup-referrals",
	"/session",
	"/notifications/email-preview",
	"/notifications/email-log",
	"/version",
	"/admin/roles",
	"/admin/permissions",
	"/admin/audit",
	"/admin/audit-logs",
	"/admin/organizations",
	"/geo",
	"/rewards",
	"/legal",
	"/claims",
	"/reward-notifications",
	"/redemptions",
	"/pos/terminals",
	"/files",
	"/orgs",
	"/orgs/memberships",
	"/orgs/:orgSlug",
	"/orgs/:orgSlug/kyb",
	"/orgs/:orgSlug/kyb/documents",
	"/orgs/:orgSlug/rewards",
	"/orgs/:orgSlug/api-keys",
	"/orgs/:orgSlug/terminals",
	"/orgs/:orgSlug/redemptions",
	"/orgs/:orgSlug/analytics",
	"/orgs/:orgSlug/locations",
	"/orgs/onboarding",
	"/orgs/invites",
	"/orgs/:orgSlug/members",
	"/policies",
	"/support-access",
	"/admin/invites",
	"/admin/rewards",
	"/admin/merchants",
	"/admin/merchants/documents",
	"/admin/location-requests",
	"/admin/analytics",
	"/sample-category",
	"/product",
	"/capabilities/catalog",
	"/authorization/decisions",
]);

export type VersionedRoutePrefix = z.output<typeof VersionedRoutePrefixSchema>;

export const VERSIONED_ROUTE_PREFIXES: readonly VersionedRoutePrefix[] = VersionedRoutePrefixSchema.options;

/**
 * Prefix a logical endpoint path with an API version.
 *
 * ```ts
 * apiPath("/auth/login")             // "/api/v1/auth/login"
 * apiPath("/geo/countries") // "/api/v1/geo/countries"
 * apiPath("/beta", "v2")             // "/api/v2/beta" (per-route version override)
 * ```
 */
export function apiPath(path: VersionedRoutePrefix, version: ApiVersion = API_VERSION): string {
	return `${apiVersionPrefix(version)}${path}`;
}

/** The Swagger UI path for a version (`"v1"` → `"/v1/docs"`). */
export function apiDocsPath(version: ApiVersion = API_VERSION): string {
	return `/${version}/docs`;
}

/** A version that is still served but scheduled for removal (drives `Sunset`). */
export interface DeprecatedApiVersion {
	readonly version: ApiVersion;
	/** ISO date after which the version is removed. */
	readonly sunsetAt: string;
}

/** Versions currently marked deprecated — responses to them get a `Sunset` header. */
export const API_DEPRECATED_VERSIONS: readonly DeprecatedApiVersion[] = [];
