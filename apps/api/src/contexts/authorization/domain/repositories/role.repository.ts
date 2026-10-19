import type { RoleAggregate, RoleState } from "../aggregates/role.aggregate";

/** Roles, bound to one RBAC transaction. Writes only ever run under the RBAC advisory lock. */
export interface RoleRepository {
	/** A live (not soft-deleted) role, or `null`. */
	findLive(roleId: string): Promise<RoleAggregate | null>;
	/** The role whatever its deleted / active state (restore). */
	findIncludingDeleted(roleId: string): Promise<RoleAggregate | null>;
	/** A live role by its unique name. */
	findLiveByName(name: string): Promise<RoleAggregate | null>;
	/** `Role.name` is unique across soft-deleted rows too. */
	isNameTaken(name: string): Promise<boolean>;
	/** Writes the aggregate's pending changes and returns the stored row. */
	save(role: RoleAggregate): Promise<RoleState>;
}
