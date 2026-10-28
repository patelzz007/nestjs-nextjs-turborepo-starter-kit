// ============================================
// domain/access/access-request.ts — the question and the answer (ADR 067)
// ============================================
// Plain, framework-free data: the same request shape is decided for a platform
// user and for a tenant member, so every caller (the route guard, the merchant
// capability gate, a service checking one record) asks the same question.

import type { PermissionPair, PermissionResource, ShareLevel } from "@workspace/shared";
import { z } from "zod";

/** The record a check is about. `locationId` is the record's store, when it has one. */
export interface AccessTarget {
	readonly resource: PermissionResource;
	readonly resourceId?: string;
	readonly locationId?: string;
}

/** "May `userId` do `permission` (inside `tenantId`, on `target`)?" */
export interface AccessRequest {
	readonly userId: string;
	/** The verified tenant the request acts in; absent = a platform request. */
	readonly tenantId?: string;
	readonly permission: PermissionPair;
	readonly target?: AccessTarget;
}

/** The four ways a request can be allowed, in the order they are tried (ADR 067). */
export const AllowPathNameSchema = z.enum(["role", "grant", "share", "ownership"]);

export type AllowPathName = z.output<typeof AllowPathNameSchema>;

/** The answer, and which path gave it (`null` when nothing allowed it — deny by default). */
export interface AccessDecision {
	readonly allowed: boolean;
	readonly path: AllowPathName | null;
}

/** Deny by default: what a request gets when no allow path says yes. */
export const DENIED: AccessDecision = { allowed: false, path: null };

/** The actions a per-record share level gives: VIEW reads, EDIT reads and updates. */
export const SHARE_LEVEL_ACTIONS: Readonly<Record<ShareLevel, readonly PermissionPair["action"][]>> = {
	VIEW: ["READ"],
	EDIT: ["READ", "UPDATE"],
};

/** The only actions ownership satisfies, and only on the owned record (ADR 067). */
export const OWNERSHIP_ACTIONS: readonly PermissionPair["action"][] = ["READ", "UPDATE"];
