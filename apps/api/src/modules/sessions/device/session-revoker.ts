import type { SessionRevokedBy, SessionSystemRevoker, ToDiscoUnion } from "@workspace/shared";

/**
 * Who revokes a device session — recorded as its `deletedBy`
 * (docs/technical/mobile/mobile-app.md §8.3): a user (the owner signing out,
 * revoking a device or signing out everywhere; an admin whose RBAC change
 * signed the user out) or a system marker from the closed
 * `SessionSystemRevokerSchema`.
 */
export type SessionRevoker = ToDiscoUnion<{ user: { readonly userId: string }; system: { readonly marker: SessionSystemRevoker } }, "kind">;

export function revokedByUser(userId: string): SessionRevoker {
	return { kind: "user", userId };
}

export function revokedBySystem(marker: SessionSystemRevoker): SessionRevoker {
	return { kind: "system", marker };
}

/** The `deleted_by` column value of a revocation. */
export function sessionRevokerColumn(revoker: SessionRevoker): SessionRevokedBy {
	return revoker.kind === "user" ? revoker.userId : revoker.marker;
}
