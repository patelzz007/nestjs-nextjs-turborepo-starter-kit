import type { EpochMs } from "@workspace/shared";
import { z } from "zod";

import { DeletedRoleNotFoundError, SystemRoleImmutableError } from "../errors/authorization.errors";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

/** `Role.name` column width. */
export const ROLE_NAME_MAX_LENGTH = 100;

const RoleStateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(ROLE_NAME_MAX_LENGTH),
	description: z.string().nullable(),
	isActive: z.boolean(),
	isSystem: z.boolean(),
	isDeleted: z.boolean(),
	deletedAt: z.number().int().nonnegative().nullable(),
	createdAt: z.number().int().nonnegative(),
	updatedAt: z.number().int().nonnegative(),
});

/** One persisted role, as the mapper hands it to {@link RoleAggregate.rehydrate}. */
export type RoleState = z.output<typeof RoleStateSchema>;

/** Fields an API caller may change on a non-system role. `undefined` leaves a field as it is. */
export interface RoleRevision {
	readonly name?: string | undefined;
	readonly description?: string | undefined;
	readonly isActive?: boolean | undefined;
}

/** What a new (never system) role is created with. */
export interface NewRole {
	readonly id: string;
	readonly name: string;
	readonly description: string | null;
}

/** One change the repository writes on save, in order. */
export type RoleChange =
	| { readonly kind: "created" }
	| { readonly kind: "revised"; readonly revision: RoleRevision }
	| { readonly kind: "removed" }
	| { readonly kind: "restored" }
	| { readonly kind: "permissions_synced"; readonly permissionIds: readonly string[]; readonly assignedBy: string };

/**
 * A role: its catalog row and its permission set. Roles are flat: no role inherits another's permissions.
 *
 * System roles (`isSystem`) are server-controlled: their name, state and permission set never
 * change through the API, and they are never deleted. Every write is a soft delete or an update.
 */
export class RoleAggregate {
	private readonly changes: RoleChange[] = [];

	private constructor(private state: RoleState) {}

	public static create(role: NewRole, now: EpochMs): RoleAggregate {
		const aggregate = new RoleAggregate(
			RoleStateSchema.parse({
				id: role.id,
				name: role.name,
				description: role.description,
				isActive: true,
				isSystem: false,
				isDeleted: false,
				deletedAt: null,
				createdAt: now,
				updatedAt: now,
			}),
		);
		aggregate.changes.push({ kind: "created" });
		return aggregate;
	}

	/** Mapper-only. A stored row that breaks an invariant is refused, never loaded silently. */
	public static rehydrate(state: RoleState): RoleAggregate {
		const parsed = RoleStateSchema.safeParse(state);
		if (!parsed.success) {
			throw new CorruptAggregateStateError("Role", state.id);
		}
		return new RoleAggregate(parsed.data);
	}

	public get id(): string {
		return this.state.id;
	}

	public get name(): string {
		return this.state.name;
	}

	public get isSystem(): boolean {
		return this.state.isSystem;
	}

	public get isDeleted(): boolean {
		return this.state.isDeleted;
	}

	/** A copy of the current state (responses, persistence). */
	public snapshot(): RoleState {
		return { ...this.state };
	}

	/** @throws SystemRoleImmutableError for a system role. Called before any escalation check, as the API always did. */
	public assertMutable(): void {
		if (this.state.isSystem) {
			throw new SystemRoleImmutableError(this.state.name);
		}
	}

	/** Whether `name` would rename the role (a rename must not collide with any role, deleted ones included). */
	public isRenamedBy(revision: RoleRevision): boolean {
		return revision.name !== undefined && revision.name !== this.state.name;
	}

	public revise(revision: RoleRevision, now: EpochMs): void {
		this.assertMutable();
		this.state = RoleStateSchema.parse({
			...this.state,
			...(revision.name === undefined ? {} : { name: revision.name }),
			...(revision.description === undefined ? {} : { description: revision.description }),
			...(revision.isActive === undefined ? {} : { isActive: revision.isActive }),
			updatedAt: now,
		});
		this.changes.push({ kind: "revised", revision });
	}

	public remove(now: EpochMs): void {
		this.assertMutable();
		this.state = { ...this.state, isDeleted: true, deletedAt: now, updatedAt: now };
		this.changes.push({ kind: "removed" });
	}

	/** A restore brings the role back live and active. @throws DeletedRoleNotFoundError when the role is not deleted. */
	public restore(now: EpochMs): void {
		if (!this.state.isDeleted) {
			throw new DeletedRoleNotFoundError(this.state.id);
		}
		this.state = { ...this.state, isDeleted: false, deletedAt: null, isActive: true, updatedAt: now };
		this.changes.push({ kind: "restored" });
	}

	/** Replace the role's permission set (the caller has verified every id names a live permission). */
	public syncPermissions(permissionIds: readonly string[], assignedBy: string, now: EpochMs): void {
		this.assertMutable();
		this.state = { ...this.state, updatedAt: now };
		this.changes.push({ kind: "permissions_synced", permissionIds: [...new Set<string>(permissionIds)], assignedBy });
	}

	/** Returns and clears the pending changes. Called once by the repository on save. */
	public pullChanges(): readonly RoleChange[] {
		return this.changes.splice(0, this.changes.length);
	}
}
