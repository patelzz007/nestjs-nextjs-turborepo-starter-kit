import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { CapabilitySlug, UserPermissions } from "@workspace/shared";

import type { SlimRole, UserGrantsReadPort } from "../../../../platform/application/ports/authorization.port";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { SubjectAuthorizationReadPort } from "../../application/ports/subject-authorization-read.port";
import { SUBJECT_AUTHORIZATION_READ } from "../../application/ports/authorization.tokens";
import { PRINCIPAL_LOOKUP_OPERATION } from "../../../../platform/application/shared-system-operations";

/** Role lists for a page of accounts, before those rows are visible under the caller's own RLS session. */
interface PrincipalRoleLookup {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/** What a user holds, as identity's session payloads show it: the subject read port, and the live roles of a page of users in one read. */
@Injectable()
export class UserGrantsReadAdapter implements UserGrantsReadPort {
	public constructor(
		@Inject(SUBJECT_AUTHORIZATION_READ) private readonly subjects: SubjectAuthorizationReadPort,
		@Inject(TenantTransactionService) private readonly transactions: PrincipalRoleLookup,
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
		if (userIds.length === 0) {
			return new Map();
		}
		return this.transactions.withSystemOperation(
			{ operation: PRINCIPAL_LOOKUP_OPERATION, reason: "Read live roles for a page of accounts", actorUserId: null },
			async (tx): Promise<ReadonlyMap<string, readonly SlimRole[]>> => {
				const rows = await tx.userRole.findMany({
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
			},
		);
	}
}
