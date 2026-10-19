import { JsonValueSchema, PermissionActionSchema, PermissionResourceSchema, PermissionScopeSchema, type EpochMs } from "@workspace/shared";
import { z } from "zod";

import { CorruptAuthorizationStateError, DeletedPermissionNotFoundError, SystemPermissionImmutableError } from "../errors/authorization.errors";
import { permissionKeyOf } from "../rbac-catalog";

/** `Permission.group` column width. */
export const PERMISSION_GROUP_MAX_LENGTH = 100;

const PermissionStateSchema = z.object({
	id: z.string().min(1),
	action: PermissionActionSchema,
	resource: PermissionResourceSchema,
	scope: PermissionScopeSchema,
	description: z.string().nullable(),
	group: z.string().max(PERMISSION_GROUP_MAX_LENGTH).nullable(),
	isSystem: z.boolean(),
	/** ABAC conditions (policy DSL); edited only through the policy workflow, never by the catalog API. */
	conditions: JsonValueSchema.nullable(),
	isDeleted: z.boolean(),
	deletedAt: z.number().int().nonnegative().nullable(),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
});

export type PermissionState = z.output<typeof PermissionStateSchema>;

/** Metadata an API caller may change on a non-system permission. `undefined` leaves a field as it is. */
export interface PermissionRevision {
	readonly description?: string | undefined;
	readonly group?: string | undefined;
}

/** What a new catalog permission is created with. It is never a system permission and is always GLOBAL. */
export interface NewPermission {
	readonly id: string;
	readonly action: z.output<typeof PermissionActionSchema>;
	readonly resource: z.output<typeof PermissionResourceSchema>;
	readonly description: string | null;
	readonly group: string | null;
}

export type PermissionChange =
	{ readonly kind: "created" } | { readonly kind: "revised"; readonly revision: PermissionRevision } | { readonly kind: "removed" } | { readonly kind: "restored" };

/**
 * One catalog permission. System permissions (`isSystem`) are synced from the code registry
 * (`SyncPermissionRegistry`): they cannot be edited or deleted through the API, and no caller creates one.
 */
export class PermissionAggregate {
	private readonly changes: PermissionChange[] = [];

	private constructor(private state: PermissionState) {}

	public static create(permission: NewPermission, now: EpochMs): PermissionAggregate {
		const aggregate = new PermissionAggregate(
			PermissionStateSchema.parse({
				id: permission.id,
				action: permission.action,
				resource: permission.resource,
				scope: "GLOBAL",
				description: permission.description,
				group: permission.group,
				isSystem: false,
				conditions: null,
				isDeleted: false,
				deletedAt: null,
				createdAt: now,
				updatedAt: now,
			}),
		);
		aggregate.changes.push({ kind: "created" });
		return aggregate;
	}

	public static rehydrate(state: PermissionState): PermissionAggregate {
		const parsed = PermissionStateSchema.safeParse(state);
		if (!parsed.success) {
			throw new CorruptAuthorizationStateError("Permission", state.id);
		}
		return new PermissionAggregate(parsed.data);
	}

	public get id(): string {
		return this.state.id;
	}

	public get isDeleted(): boolean {
		return this.state.isDeleted;
	}

	/** `ACTION:RESOURCE` of this permission. */
	public get key(): string {
		return permissionKeyOf(this.state);
	}

	/** The pair the escalation subset rule compares. */
	public get pair(): { readonly action: string; readonly resource: string } {
		return { action: this.state.action, resource: this.state.resource };
	}

	public snapshot(): PermissionState {
		return { ...this.state };
	}

	/** @throws SystemPermissionImmutableError for a registry-synced permission. */
	public assertMutable(): void {
		if (this.state.isSystem) {
			throw new SystemPermissionImmutableError(this.key);
		}
	}

	/** Metadata only: it never changes anyone's access. */
	public revise(revision: PermissionRevision, now: EpochMs): void {
		this.assertMutable();
		this.state = PermissionStateSchema.parse({
			...this.state,
			...(revision.description === undefined ? {} : { description: revision.description }),
			...(revision.group === undefined ? {} : { group: revision.group }),
			updatedAt: now,
		});
		this.changes.push({ kind: "revised", revision });
	}

	public remove(now: EpochMs): void {
		this.assertMutable();
		this.state = { ...this.state, isDeleted: true, deletedAt: now, updatedAt: now };
		this.changes.push({ kind: "removed" });
	}

	/** @throws DeletedPermissionNotFoundError when the permission is not deleted. */
	public restore(now: EpochMs): void {
		if (!this.state.isDeleted) {
			throw new DeletedPermissionNotFoundError(this.state.id);
		}
		this.state = { ...this.state, isDeleted: false, deletedAt: null, updatedAt: now };
		this.changes.push({ kind: "restored" });
	}

	public pullChanges(): readonly PermissionChange[] {
		return this.changes.splice(0, this.changes.length);
	}
}
