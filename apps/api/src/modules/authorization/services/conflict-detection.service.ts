import { Injectable, Logger, ConflictException } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Defines a conflict between two roles.
 *
 * When a user has both conflicting roles, the system warns or rejects.
 */
export interface RoleConflict {
	/** The first conflicting role name. */
	readonly roleA: string;
	/** The second conflicting role name. */
	readonly roleB: string;
	/** Why the conflict exists. */
	readonly reason: string;
}

/**
 * Manages role conflict rules and detects conflicts when assigning roles.
 *
 * ## Usage
 *
 * ```ts
 * // Register a conflict rule
 * conflictDetection.register({ roleA: "admin", roleB: "readonly", reason: "Admins have full access; readonly is contradictory" });
 *
 * // Check before assigning
 * const conflicts = await conflictDetection.detectConflicts(userId, ["admin", "readonly"]);
 * if (conflicts.length > 0) throw new ConflictException(conflicts[0].reason);
 * ```
 */
@Injectable()
export class ConflictDetectionService {
	private readonly logger: Logger = new Logger(ConflictDetectionService.name);

	public constructor(private readonly prisma: PrismaService) {}

	/** Registered conflict rules. */
	private readonly conflicts: RoleConflict[] = [];

	/**
	 * Register a role conflict rule.
	 */
	public register(conflict: RoleConflict): void {
		this.conflicts.push(conflict);
		this.logger.debug(`Registered conflict: ${conflict.roleA} ↔ ${conflict.roleB}`);
	}

	/**
	 * Detect conflicts if a user were assigned the given role IDs.
	 *
	 * Returns an empty array if no conflicts.
	 */
	public async detectConflicts(userId: string, newRoleIds: readonly string[]): Promise<RoleConflict[]> {
		// Fetch the names of the new role IDs
		const newRoles = await this.prisma.role.findMany({
			where: { id: { in: [...newRoleIds] }, isDeleted: false },
			select: { name: true },
		});

		const newRoleNames: string[] = newRoles.map((r) => r.name);

		// Fetch the user's existing role names
		const existingUserRoles = await this.prisma.userRole.findMany({
			where: { userId, isDeleted: false, role: { isDeleted: false, isActive: true } },
			include: { role: { select: { name: true } } },
		});

		const existingRoleNames: string[] = existingUserRoles.map((ur) => ur.role.name);

		// Combine existing + new roles (sync replaces, but we check the final set)
		const allRoleNames: string[] = [...new Set([...existingRoleNames, ...newRoleNames])];

		// Check each conflict rule
		const detected: RoleConflict[] = [];
		for (const conflict of this.conflicts) {
			if (allRoleNames.includes(conflict.roleA) && allRoleNames.includes(conflict.roleB)) {
				detected.push(conflict);
			}
		}

		return detected;
	}

	/**
	 * Validate that a role assignment doesn't violate any conflict rules.
	 *
	 * @throws ConflictException if conflicts are detected.
	 */
	public async validate(userId: string, roleIds: readonly string[]): Promise<void> {
		const conflicts: RoleConflict[] = await this.detectConflicts(userId, roleIds);
		if (conflicts.length > 0) {
			const messages: string[] = conflicts.map((c) => `"${c.roleA}" conflicts with "${c.roleB}": ${c.reason}`);
			throw new ConflictException(`Role assignment rejected: ${messages.join("; ")}`);
		}
	}
}
