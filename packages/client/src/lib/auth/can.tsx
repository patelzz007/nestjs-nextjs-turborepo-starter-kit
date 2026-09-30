"use client";

import * as React from "react";

import { parsePermissionSlug, readResourceCapability, type CapabilitySlug, type ResourceAuthorization } from "@workspace/shared";

import { createGrantedCapabilities, isCapabilityGranted, type GrantedCapabilities } from "./permission-check";

/**
 * Requirement evaluation mode for multi-permission checks:
 * - "all" — every capability must be granted (AND).
 * - "any" — at least one capability must be granted (OR, default).
 */
export type CapabilityCheckMode = "all" | "any";

/**
 * Any payload that may carry server-evaluated capabilities
 * (`order.authorization.can.delete`). Resources without `authorization`
 * are checked against the global session grants only.
 */
export interface AuthorizableResource {
	readonly authorization?: ResourceAuthorization;
}

/**
 * Synchronous authorization checks backed by the session capability set.
 *
 * Without a resource (or for a resource without an `authorization` payload)
 * the global capability decides (`MANAGE` on the same resource implies the
 * action). When the resource carries `authorization`, its server-evaluated
 * entry decides: it already reflects scope, ownership, ACL, and policy rules,
 * and a missing entry denies — the browser never re-derives those rules.
 */
export interface AuthorizationChecker {
	/** True when the permission is granted (and allowed on `resource`, when given). */
	readonly can: (permission: CapabilitySlug, resource?: AuthorizableResource) => boolean;
	/** Negation of `can` — reads better in disabled/hidden conditions. */
	readonly cannot: (permission: CapabilitySlug, resource?: AuthorizableResource) => boolean;
	/** AND semantics — true when every permission is granted. */
	readonly canAll: (permissions: readonly CapabilitySlug[], resource?: AuthorizableResource) => boolean;
	/** OR semantics — true when at least one permission is granted. */
	readonly canAny: (permissions: readonly CapabilitySlug[], resource?: AuthorizableResource) => boolean;
}

/** Back-compat name for {@link AuthorizationChecker}. */
export type CapabilitiesChecker = AuthorizationChecker;

const CapabilitiesContext = React.createContext<AuthorizationChecker | null>(null);

/**
 * Server-evaluated capability for one resource, or `undefined` when the
 * resource carries no `authorization` payload. The server answer already
 * includes scope, ownership, ACL, and policy rules, so it is authoritative
 * for that resource (it may grant through an ACL what no global role grants).
 */
function resourceDecision(permission: CapabilitySlug, resource: AuthorizableResource | undefined): boolean | undefined {
	const authorization = resource?.authorization;
	if (authorization === undefined) {
		return undefined;
	}
	const pair = parsePermissionSlug(permission);
	if (pair === null) {
		return false;
	}
	return readResourceCapability(authorization.can, pair.action) === true;
}

function createChecker(granted: GrantedCapabilities): AuthorizationChecker {
	const can = (permission: CapabilitySlug, resource?: AuthorizableResource): boolean => resourceDecision(permission, resource) ?? isCapabilityGranted(granted, permission);

	return {
		can,
		cannot: (permission, resource) => !can(permission, resource),
		canAll: (permissions, resource) => permissions.every((permission) => can(permission, resource)),
		canAny: (permissions, resource) => permissions.some((permission) => can(permission, resource)),
	};
}

const DENY_ALL_CHECKER: AuthorizationChecker = createChecker(createGrantedCapabilities([]));

export interface CapabilitiesProviderProps {
	/** Granted capability slugs from `GET /auth/permissions`. */
	readonly capabilities: readonly CapabilitySlug[];
	readonly children: React.ReactNode;
}

/**
 * Provides the session capability set for `useAuthorization()` / `<Can>`
 * consumers. Purely advisory UX state — the backend remains authoritative.
 */
export function CapabilitiesProvider({ capabilities, children }: CapabilitiesProviderProps): React.JSX.Element {
	const checker = React.useMemo(() => createChecker(createGrantedCapabilities(capabilities)), [capabilities]);

	return <CapabilitiesContext.Provider value={checker}>{children}</CapabilitiesContext.Provider>;
}

/**
 * Local, synchronous authorization checks (never calls the API):
 *
 * ```tsx
 * const auth = useAuthorization();
 * <Button disabled={auth.cannot(PERMISSION.ORDER.DELETE, order)} />
 * ```
 *
 * Falls back to a deny-all checker when no provider is present: fail closed.
 */
export function useAuthorization(): AuthorizationChecker {
	return React.useContext(CapabilitiesContext) ?? DENY_ALL_CHECKER;
}

/** Alias of {@link useAuthorization} kept for existing callers. */
export function useCan(): AuthorizationChecker {
	return useAuthorization();
}

export interface CanProps<TResource extends AuthorizableResource> {
	/** Single required capability. */
	readonly permission?: CapabilitySlug;
	/** Alternative: multiple capabilities evaluated with `mode` semantics. */
	readonly permissions?: readonly CapabilitySlug[];
	readonly mode?: CapabilityCheckMode;
	/** Optional resource whose server-provided `authorization.can` decides the action. */
	readonly resource?: TResource;
	/** Rendered when the requirement is not met. */
	readonly fallback?: React.ReactNode;
	readonly children: React.ReactNode;
}

/**
 * Conditional render gate:
 *
 * ```tsx
 * <Can permission={PERMISSION.USER.DELETE} resource={user} fallback={<DisabledButton />}>
 *   <DeleteButton />
 * </Can>
 * ```
 */
export function Can<TResource extends AuthorizableResource>({
	permission,
	permissions,
	mode = "any",
	resource,
	fallback = null,
	children,
}: CanProps<TResource>): React.JSX.Element {
	const { can, canAll, canAny } = useAuthorization();

	const allowed = React.useMemo(() => {
		if (permissions !== undefined) {
			return mode === "all" ? canAll(permissions, resource) : canAny(permissions, resource);
		}
		return permission !== undefined && can(permission, resource);
	}, [can, canAll, canAny, mode, permission, permissions, resource]);

	if (!allowed) {
		return <>{fallback}</>;
	}

	return <>{children}</>;
}
