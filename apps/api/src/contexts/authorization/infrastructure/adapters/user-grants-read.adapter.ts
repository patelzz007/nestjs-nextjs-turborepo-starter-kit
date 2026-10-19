import { Inject, Injectable } from "@nestjs/common";
import type { CapabilitySlug, UserPermissions } from "@workspace/shared";

import type { SlimRole, UserGrantsReadPort } from "../../../../platform/application/ports/authorization.port";
import { PrismaService } from "../../../../prisma/prisma.service";
import type { SubjectAuthorizationReadPort } from "../../application/ports/subject-authorization-read.port";
import { SUBJECT_AUTHORIZATION_READ } from "../../application/ports/authorization.tokens";

/** What a user holds, as identity's session payloads show it: the subject read port, and the live roles of a page of users in one read. */
@Injectable()
export class UserGrantsReadAdapter implements UserGrantsReadPort {
	public constructor(
		@Inject(SUBJECT_AUTHORIZATION_READ) private readonly subjects: SubjectAuthorizationReadPort,
		private readonly prisma: PrismaService,
	) {}

	public getUserPermissionDetails(userId: string): Promise<UserPermissions> {
		return this.subjects.getUserPermissionDetails(userId);
	}

	public getUserCapabilitySlugs(userId: string): Promise<readonly CapabilitySlug[]> {
		return this.subjects.getUserCapabilitySlugs(userId);
	}

	public getUserDirectPermissionIds(userId: string): Promise<readonly string[]> {
		return this.subjects.getUserDirectPermissionIds(userId);
	}

	/** One read for the whole page (no N+1). */
	public async listRolesOfUsers(userIds: readonly string[]): Promise<ReadonlyMap<string, readonly SlimRole[]>> {
		const rows = await this.prisma.userRole.findMany({
			where: { userId: { in: [...userIds] }, isDeleted: false, role: { isDeleted: false } },
			select: { userId: true, role: { select: { id: true, name: true, description: true } } },
		});
		const byUser = new Map<string, SlimRole[]>();
		for (const row of rows) {
			const roles: SlimRole[] = byUser.get(row.userId) ?? [];
			roles.push({ id: row.role.id, name: row.role.name, description: row.role.description });
			byUser.set(row.userId, roles);
		}
		return byUser;
	}
}
