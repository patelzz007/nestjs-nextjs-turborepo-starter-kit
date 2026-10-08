import { describe, expect, it } from "vitest";
import { LIST_SLOT_INDEX } from "../../../lib/named-list-index";

import { AuthorizationCheckResultSchema, AuthorizationCheckSchema, AuthorizationDecisionsResponseSchema } from "../../../authorization/decisions.schema";
import { AuthorizationResultSchema } from "../../../authorization/policy-dsl.schema";
import { PolicyDraftCreatedResponseSchema, PolicyPublishResponseSchema, PolicySimulationResultSchema } from "../organization/authorization-policy";
import { CapabilityCatalogResponseSchema } from "./capabilities";
import { AuditLogEntrySchema } from "./rbac-audit";
import { RbacMessageResponseSchema } from "./rbac-inspection";
import {
	AdminPermissionResponseSchema,
	CheckPermissionResponseSchema,
	CreatePermissionExtendedSchema,
	PermissionUpdateSchema,
	PermissionGroupsResponseSchema,
	PermissionListResponseSchema,
} from "./rbac-permissions";
import {
	CreateRoleExtendedSchema,
	RoleAssignmentPreviewSchema,
	RoleAssignmentValidationResponseSchema,
	RoleListResponseSchema,
	RoleResponseSchema,
	UpdateRoleSchema,
} from "./rbac-roles";

/** A fixed epoch-ms timestamp (2026-08-23) for the fixtures. */
const CREATED_AT_MS = 1_786_300_000_000;
const UPDATED_AT_MS = 1_786_300_060_000;
const ROLE_ID = "8f9c2a52-1d1f-4c1f-9a51-6c7f0d0b3a10";
const PERMISSION_ID = "0b6c7e8a-3c2d-4f6e-8a1b-2c3d4e5f6a7b";
const DRAFT_ID = "5e1d0c9b-8a7f-4e6d-9c5b-4a3f2e1d0c9b";
const PUBLISHED_VERSION = 3;
const AFFECTED_PRINCIPALS = 12;
const CATALOG_SORT_ORDER = 10;

const role = {
	id: ROLE_ID,
	name: "Editor",
	description: null,
	isActive: true,
	parentId: null,
	isDeleted: false,
	deletedAt: null,
	createdAt: CREATED_AT_MS,
	updatedAt: UPDATED_AT_MS,
};

const permission = {
	id: PERMISSION_ID,
	action: "READ",
	resource: "USER",
	description: "View users",
	scope: "GLOBAL",
	group: null,
	isSystem: true,
	conditions: null,
	isDeleted: false,
	deletedAt: null,
	createdAt: CREATED_AT_MS,
	updatedAt: UPDATED_AT_MS,
};

describe("RBAC response schemas (ADR 022 — open, strip unknown keys)", () => {
	it("strips unknown keys from a role, including nested refs, instead of rejecting it", () => {
		const parsed = RoleResponseSchema.parse({
			...role,
			internalNote: "never on the wire",
			rolePermissions: [{ permission: { id: PERMISSION_ID, action: "READ", resource: "USER", description: null, group: null, conditions: { secret: true } } }],
		});
		expect(parsed).not.toHaveProperty("internalNote");
		expect(parsed.rolePermissions?.[LIST_SLOT_INDEX.first]?.permission).toEqual({ id: PERMISSION_ID, action: "READ", resource: "USER", description: null, group: null });
	});

	it("answers a role detail with the role and never with null (a missing role is a 404)", () => {
		expect(RoleResponseSchema.parse(role)).toEqual(role);
		expect(RoleResponseSchema.safeParse(null).success).toBe(false);
	});

	it("parses the role list, assignment validation, preview and message payloads", () => {
		const listItem = { id: ROLE_ID, name: "Editor", description: null, isActive: true, parentId: null };
		expect(RoleListResponseSchema.parse({ items: [{ ...listItem, isDeleted: false }], total: 1 })).toEqual({ items: [listItem], total: 1 });
		expect(RoleAssignmentValidationResponseSchema.parse({ valid: true, message: "No conflicts detected" })).toEqual({ valid: true, message: "No conflicts detected" });
		const preview = {
			currentRoles: ["Viewer"],
			newRoles: ["Editor"],
			roleAdded: ["Editor"],
			roleRemoved: ["Viewer"],
			permissionsGained: ["UPDATE:USER"],
			permissionsLost: [],
		};
		expect(RoleAssignmentPreviewSchema.parse(preview)).toEqual(preview);
		expect(RbacMessageResponseSchema.parse({ message: "ok", extra: 1 })).toEqual({ message: "ok" });
	});

	it("keeps an admin permission's scope and nested policy-DSL conditions, and never answers a detail with null", () => {
		const conditions = { and: [{ field: "ownerId", operator: "equals", value: "$subject.userId" }] };
		const parsed = AdminPermissionResponseSchema.parse({ ...permission, conditions, legacyFlag: true });
		expect(parsed.scope).toBe("GLOBAL");
		expect(parsed.conditions).toEqual(conditions);
		expect(parsed).not.toHaveProperty("legacyFlag");
		expect(AdminPermissionResponseSchema.safeParse(null).success).toBe(false);
	});

	it("parses the permission list, groups and check payloads", () => {
		const listItem = { id: PERMISSION_ID, action: "READ", resource: "USER", description: null, group: null, isSystem: false };
		expect(PermissionListResponseSchema.parse({ items: [listItem], total: 1 })).toEqual({ items: [listItem], total: 1 });
		expect(PermissionGroupsResponseSchema.parse({ groups: ["User Management"] })).toEqual({ groups: ["User Management"] });
		expect(CheckPermissionResponseSchema.parse({ allowed: true, grants: [{ via: "role", detail: "Editor", internal: 1 }] })).toEqual({
			allowed: true,
			grants: [{ via: "role", detail: "Editor" }],
		});
	});

	it("drops the soft-delete fields an audit log entry does not expose", () => {
		const entry = {
			id: "a1",
			actor: { kind: "USER", userId: "u1", impersonatorId: null },
			targetUserId: null,
			targetRoleId: ROLE_ID,
			permissionId: null,
			action: "ROLE_CREATED",
			detail: null,
			createdAt: CREATED_AT_MS,
			updatedAt: UPDATED_AT_MS,
		};
		expect(AuditLogEntrySchema.parse({ ...entry, isDeleted: false, deletedAt: null })).toEqual(entry);
	});

	it("models the audit actor as a user or an allowlisted system operation — never a bare id", () => {
		const base = {
			id: "a2",
			targetUserId: "u2",
			targetRoleId: null,
			permissionId: "p1",
			action: "PERMISSION_EXPIRED",
			detail: null,
			createdAt: CREATED_AT_MS,
			updatedAt: UPDATED_AT_MS,
		};
		const system = { ...base, actor: { kind: "SYSTEM_OPERATION", operation: "maintenance.permission_expiry" } };
		const impersonated = { ...base, actor: { kind: "USER", userId: "u1", impersonatorId: "root" } };

		expect(AuditLogEntrySchema.parse(system)).toEqual(system);
		expect(AuditLogEntrySchema.parse(impersonated)).toEqual(impersonated);
		expect(AuditLogEntrySchema.safeParse({ ...base, actor: { kind: "SYSTEM_OPERATION", operation: "" } }).success).toBe(false);
		expect(AuditLogEntrySchema.safeParse({ ...base, actor: { kind: "USER", operation: "maintenance.permission_expiry" } }).success).toBe(false);
		expect(AuditLogEntrySchema.safeParse({ ...base, actorId: "u1" }).success).toBe(false);
	});

	it("parses the capability catalog", () => {
		const definition = {
			id: "c1",
			slug: "platform:user.read",
			scope: "PLATFORM",
			label: "Read users",
			description: null,
			groupName: null,
			sortOrder: CATALOG_SORT_ORDER,
			isSystem: true,
		};
		expect(CapabilityCatalogResponseSchema.parse([{ ...definition, createdAt: CREATED_AT_MS }])).toEqual([definition]);
	});

	it("parses the policy control-plane payloads", () => {
		expect(PolicyDraftCreatedResponseSchema.parse({ draftId: DRAFT_ID })).toEqual({ draftId: DRAFT_ID });
		expect(PolicyPublishResponseSchema.parse({ version: PUBLISHED_VERSION })).toEqual({ version: PUBLISHED_VERSION });
		const change = { organizationId: ROLE_ID, userId: PERMISSION_ID, membershipRole: "CASHIER", action: "rewardhub:manage_team", before: "Allow", after: "Deny" };
		const simulation = {
			simulationId: DRAFT_ID,
			passed: true,
			warnings: [],
			errors: [],
			evaluatedPrincipalCount: AFFECTED_PRINCIPALS,
			affectedPrincipalCount: AFFECTED_PRINCIPALS,
			wouldLockOutOwners: false,
			decisionChanges: [change],
			decisionChangesTruncated: false,
		};
		expect(PolicySimulationResultSchema.parse(simulation)).toEqual(simulation);
		expect(PolicySimulationResultSchema.safeParse({ ...simulation, decisionChanges: [{ ...change, after: "Maybe" }] }).success).toBe(false);
	});

	it("parses authorization decisions and an explanation, stripping unknown nested keys", () => {
		const check = { action: "READ", resource: "USER", allowed: false };
		expect(AuthorizationDecisionsResponseSchema.parse({ results: [{ ...check, attributes: { owner: "x" } }] })).toEqual({ results: [check] });
		const explained = AuthorizationResultSchema.parse({
			decision: "DENY",
			request: { subject: { userId: "u1", isSuperAdmin: false, sessionId: "internal" }, action: "READ", resource: "USER" },
			evaluation: [{ source: "default", effect: "DENY", reason: "No grant" }],
		});
		expect(explained.request.subject).toEqual({ userId: "u1", isSuperAdmin: false });
	});
});

describe("RBAC request schemas stay closed", () => {
	it("rejects unknown keys on role create / update bodies", () => {
		expect(CreateRoleExtendedSchema.safeParse({ name: "Editor", isSystem: true }).success).toBe(false);
		expect(UpdateRoleSchema.safeParse({ name: "Editor", parentId: ROLE_ID }).success).toBe(false);
	});

	it("never lets a client set the server-controlled isSystem flag on a permission", () => {
		expect(CreatePermissionExtendedSchema.safeParse({ action: "READ", resource: "USER", isSystem: true }).success).toBe(false);
		expect(PermissionUpdateSchema.safeParse({ description: "x", isSystem: true }).success).toBe(false);
		expect(CreatePermissionExtendedSchema.safeParse({ action: "READ", resource: "USER", group: "Users" }).success).toBe(true);
	});

	it("rejects unknown keys on a decision check while the answered check strips them", () => {
		const check = { action: "READ", resource: "USER", resourceAttributes: { ownerId: "u1" } };
		expect(AuthorizationCheckSchema.safeParse(check).success).toBe(false);
		expect(AuthorizationCheckResultSchema.parse({ ...check, allowed: true })).toEqual({ action: "READ", resource: "USER", allowed: true });
	});
});
