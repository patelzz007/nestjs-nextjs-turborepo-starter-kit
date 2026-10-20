import type { Prisma } from "@prisma/client";
import {
	epochMs,
	tenantMemberInviteListQuery,
	tenantMemberListQuery,
	type TenantMemberInviteListQuery,
	type TenantMemberInviteListSortField,
	type TenantMemberInviteResponse,
	type TenantMemberListQuery,
	type TenantMemberListSortField,
	type TenantMemberRosterResponse,
	type PaginatedServiceResult,
} from "@workspace/shared";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import type { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { TeamInvitePreviewView, TeamReadPort } from "../../application/ports/team-read.port";
import { mapMembershipToRosterResponse } from "./tenant-membership.mapper";
import { TENANT_INVITATION_RESOLVE_TOKEN_OPERATION } from "../../application/ports/tenants.tokens";

/** Allowlisted system operation that reads co-members' profiles into the team roster. */
export const TEAM_ROSTER_PROFILES_OPERATION = "tenant.membership.roster";

const TEAM_INVITE_INCLUDE = {
	tenant: { select: { id: true, slug: true, displayName: true } },
	locationScopes: { select: { locationId: true, location: { select: { id: true, name: true } } } },
	createdByAdmin: { select: { id: true, fullName: true } },
} satisfies Prisma.TenantInvitationInclude;

type TeamInviteRow = Prisma.TenantInvitationGetPayload<{ include: typeof TEAM_INVITE_INCLUDE }>;

function toInviteResponse(row: TeamInviteRow, tenantId: string): TenantMemberInviteResponse {
	return {
		id: row.id,
		tenantId,
		email: row.email,
		intendedRole: row.intendedRole,
		locationScopeType: row.locationScopeType,
		locationIds: row.locationScopes.map((scope) => scope.locationId),
		status: row.status,
		invitedByUserId: row.createdByAdmin.id,
		invitedByName: row.createdByAdmin.fullName,
		expiresAt: epochMs(Number(row.expiresAt)),
		createdAt: epochMs(Number(row.createdAt)),
	};
}

// ── Member roster (`GET /tenants/:tenantSlug/members`) ──

const MEMBER_LIST_INCLUDE = { locationScopes: { where: { isDeleted: false } } } satisfies Prisma.MembershipInclude;

type MemberListRow = Prisma.MembershipGetPayload<{ include: typeof MEMBER_LIST_INCLUDE }>;

const MEMBER_SORT_COLUMNS: SortColumns<TenantMemberListSortField, Prisma.MembershipOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	role: (direction) => ({ role: direction }),
};

/** Keyset for the default order (`createdAt asc, id asc` — the order members joined). */
const MEMBER_LIST_KEYSET: ListKeyset<MemberListRow, Prisma.MembershipWhereInput> = timestampIdKeyset(
	(row: MemberListRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.MembershipWhereInput => ({ OR: [{ createdAt: { gt: at } }, { createdAt: at, id: { gt: id } }] }),
);

/** The tenant's live memberships, narrowed by the list filter. The tenant is the scope, never a filter. */
export function buildMemberListWhere(tenantId: string, query: TenantMemberListQuery): Prisma.MembershipWhereInput {
	return {
		AND: [{ tenantId, isDeleted: false }, ...fieldWhere(toPrismaEqualityFilter(query.filter?.role), (role) => ({ role }))],
	};
}

export function buildMemberListOrder(query: TenantMemberListQuery): ListOrder<Prisma.MembershipOrderByWithRelationInput> {
	return buildListOrder(tenantMemberListQuery.resolveSort(query.sort), { columns: MEMBER_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}

// ── Pending invites (`GET /tenants/:tenantSlug/members/invites`) ──

const INVITE_SORT_COLUMNS: SortColumns<TenantMemberInviteListSortField, Prisma.TenantInvitationOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	expiresAt: (direction) => ({ expiresAt: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const INVITE_LIST_KEYSET: ListKeyset<TeamInviteRow, Prisma.TenantInvitationWhereInput> = timestampIdKeyset(
	(row: TeamInviteRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.TenantInvitationWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

export function buildInviteListOrder(query: TenantMemberInviteListQuery): ListOrder<Prisma.TenantInvitationOrderByWithRelationInput> {
	return buildListOrder(tenantMemberInviteListQuery.resolveSort(query.sort), { columns: INVITE_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}

export class PrismaTeamReadRepository implements TeamReadPort {
	public constructor(
		private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>,
		private readonly transactions: TenantTransactionService,
	) {}

	public async listMembers(actor: ActorContext, tenantId: string, query: TenantMemberListQuery): Promise<PaginatedServiceResult<TenantMemberRosterResponse>> {
		const page = await this.reads.read(actor, async (db) =>
			fetchListPage(query, {
				where: buildMemberListWhere(tenantId, query),
				order: buildMemberListOrder(query),
				keyset: MEMBER_LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.membership.count({ where }),
				findMany: (args): Promise<MemberListRow[]> => db.membership.findMany({ ...args, include: MEMBER_LIST_INCLUDE }),
			}),
		);
		const rows = page.items;
		// `User` RLS lets a session read only its own row, so the tenant read above cannot
		// join co-members' profiles. Read exactly this tenant's members' name + email
		// under an allowlisted system operation, AFTER the manage-team check passed; never
		// widen the `User` policy (it would expose whole user rows). One batched read.
		const userIds: string[] = rows.map((row) => row.userId);
		const profiles = await this.transactions.withSystemOperation(
			{
				operation: TEAM_ROSTER_PROFILES_OPERATION,
				reason: "Team roster: member names and emails for an authorized team manager",
				actorUserId: actingUserId(actor),
			},
			async (tx) => tx.user.findMany({ where: { id: { in: userIds }, isDeleted: false }, select: { id: true, email: true, fullName: true } }),
		);
		const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
		const items = rows.flatMap((row): TenantMemberRosterResponse[] => {
			const profile = profileById.get(row.userId);
			// A membership whose user row is gone is not a rosterable member.
			return profile === undefined ? [] : [mapMembershipToRosterResponse({ ...row, user: profile })];
		});
		return toPaginatedServiceResult({ ...page, items }, query);
	}

	public async listPendingInvites(actor: ActorContext, tenantId: string, query: TenantMemberInviteListQuery): Promise<PaginatedServiceResult<TenantMemberInviteResponse>> {
		return this.reads.read(actor, async (db) => {
			const page = await fetchListPage(query, {
				where: { tenantId, kind: "TEAM_MEMBER", status: "PENDING" },
				order: buildInviteListOrder(query),
				keyset: INVITE_LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.tenantInvitation.count({ where }),
				findMany: (args): Promise<TeamInviteRow[]> => db.tenantInvitation.findMany({ ...args, include: TEAM_INVITE_INCLUDE }),
			});
			return toPaginatedServiceResult(
				mapListResult(page, (row: TeamInviteRow): TenantMemberInviteResponse => toInviteResponse(row, tenantId)),
				query,
			);
		});
	}

	public async findPendingInvitePreview(tokenHash: string): Promise<TeamInvitePreviewView | null> {
		const row = await this.transactions.withSystemOperation(
			{ operation: TENANT_INVITATION_RESOLVE_TOKEN_OPERATION, reason: "Resolve team invite by token", actorUserId: null },
			async (tx) => tx.tenantInvitation.findFirst({ where: { tokenHash, kind: "TEAM_MEMBER", status: "PENDING" }, include: TEAM_INVITE_INCLUDE }),
		);
		if (row === null) {
			return null;
		}
		return {
			email: row.email,
			tenant: row.tenant === null ? null : { slug: row.tenant.slug, displayName: row.tenant.displayName },
			intendedRole: row.intendedRole,
			locationScopeType: row.locationScopeType,
			locations: row.locationScopes.map((scope) => ({ id: scope.location.id, name: scope.location.name })),
			expiresAt: epochMs(Number(row.expiresAt)),
		};
	}
}
