import { parsePermissionSlug } from "../../authorization/permission";
import type { CapabilitySlug } from "../../contexts/authorization/schemas/capabilities";
import type { z } from "zod";
import type { SidebarPermissionModeSchema } from "./sidebar-menu-schema";

/** The session's grants, indexed once so repeated checks stay cheap. */
export interface GrantedCapabilities {
	readonly slugs: ReadonlySet<string>;
}

/** Indexes a capability list once so repeated checks stay cheap. */
export function createGrantedCapabilities(capabilities: readonly CapabilitySlug[]): GrantedCapabilities {
	return { slugs: new Set<string>(capabilities) };
}

/**
 * True when `required` is held: the exact capability. There is no catch-all action (ADR 067 retired
 * `MANAGE`), so holding one verb on a resource never implies another.
 */
export function isCapabilityGranted(granted: GrantedCapabilities, required: CapabilitySlug): boolean {
	return granted.slugs.has(required);
}

/**
 * Config-time slug check: platform slugs must resolve to a known
 * `(action, resource)` pair so typos such as `platform:product.lsit` fail
 * at load instead of silently denying. Other namespaces are validated by
 * `CapabilitySlugSchema`'s shape only (their catalog is database-driven).
 */
export function isKnownPermissionSlug(slug: string): boolean {
	if (slug.startsWith("platform:")) {
		return parsePermissionSlug(slug) !== null;
	}
	return true;
}

/**
 * Requirement evaluation mode for multi-permission checks:
 * - "all" — every capability must be granted (AND).
 * - "any" — at least one capability must be granted (OR, default).
 */
export type CapabilityCheckMode = z.output<typeof SidebarPermissionModeSchema>;

/**
 * Synchronous authorization checks backed by the session capability set
 * (each capability held exactly). For showing and
 * hiding UI only: the API checks every request again, record by record.
 */
export interface AuthorizationChecker {
	/** True when the permission is granted. */
	readonly can: (permission: CapabilitySlug) => boolean;
	/** Negation of `can` — reads better in disabled/hidden conditions. */
	readonly cannot: (permission: CapabilitySlug) => boolean;
	/** AND semantics — true when every permission is granted. */
	readonly canAll: (permissions: readonly CapabilitySlug[]) => boolean;
	/** OR semantics — true when at least one permission is granted. */
	readonly canAny: (permissions: readonly CapabilitySlug[]) => boolean;
}

/** The checker over a session's capabilities: what every app's `useAuthorization()` / `<Can>` reads (web and mobile). */
export function createAuthorizationChecker(capabilities: readonly CapabilitySlug[]): AuthorizationChecker {
	const granted = createGrantedCapabilities(capabilities);
	const can = (permission: CapabilitySlug): boolean => isCapabilityGranted(granted, permission);

	return {
		can,
		cannot: (permission) => !can(permission),
		canAll: (permissions) => permissions.every(can),
		canAny: (permissions) => permissions.some(can),
	};
}

/** What `<Can>` asks for: one capability, or several under `mode` ("any" by default). */
export interface CanRequirement {
	readonly permission?: CapabilitySlug | undefined;
	readonly permissions?: readonly CapabilitySlug[] | undefined;
	readonly mode?: CapabilityCheckMode | undefined;
}

/** Whether `checker` meets `requirement`; a requirement naming no capability is never met (fail closed). */
export function meetsRequirement(checker: AuthorizationChecker, { permission, permissions, mode = "any" }: CanRequirement): boolean {
	if (permissions !== undefined) {
		return mode === "all" ? checker.canAll(permissions) : checker.canAny(permissions);
	}
	return permission !== undefined && checker.can(permission);
}
