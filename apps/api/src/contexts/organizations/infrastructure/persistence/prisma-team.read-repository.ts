import type { Prisma } from "@prisma/client";
import {
	epochMs,
	organizationMemberInviteListQuery,
	organizationMemberListQuery,
	type OrganizationMemberInviteListQuery,
	type OrganizationMemberInviteListSortField,
	type OrganizationMemberInviteResponse,
	type OrganizationMemberListQuery,
	type OrganizationMemberListSortField,
	type OrganizationMemberRosterResponse,
	type PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../../platform/infrastructure/persistence/list-query/prisma-filter";
import type { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { TeamInvitePreviewView, TeamReadPort } from "../../application/ports/team-read.port";
import { mapMembershipToRosterResponse } from "./organization-membership.mapper";

/** Allowlisted system operation that reads co-members' profiles into the team roster. */
export const TEAM_ROSTER_PROFILES_OPERATION = "organization.membership.roster";

const TEAM_INVITE_INCLUDE = {
	organization: { select: { id: true, slug: true, displayName: true } },
	locationScopes: { select: { locationId: true, location: { select: { id: true, name: true } } } },
	createdByAdmin: { select: { id: true, fullName: true } },
} satisfies Prisma.OrganizationInvitationInclude;

type TeamInviteRow = Prisma.OrganizationInvitationGetPayload<{ include: typeof TEAM_INVITE_INCLUDE }>;

function toInviteResponse(row: TeamInviteRow, organizationId: string): OrganizationMemberInviteResponse {
	return {
		id: row.id,
		organizationId,
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

// ── Member roster (`GET /orgs/:orgSlug/members`) ──

const MEMBER_LIST_INCLUDE = { locationScopes: { where: { isDeleted: false } } } satisfies Prisma.OrganizationMembershipInclude;

type MemberListRow = Prisma.OrganizationMembershipGetPayload<{ include: typeof MEMBER_LIST_INCLUDE }>;

const MEMBER_SORT_COLUMNS: SortColumns<OrganizationMemberListSortField, Prisma.OrganizationMembershipOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	role: (direction) => ({ role: direction }),
};

/** Keyset for the default order (`createdAt asc, id asc` — the order members joined). */
const MEMBER_LIST_KEYSET: ListKeyset<MemberListRow, Prisma.OrganizationMembershipWhereInput> = timestampIdKeyset(
	(row: MemberListRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.OrganizationMembershipWhereInput => ({ OR: [{ createdAt: { gt: at } }, { createdAt: at, id: { gt: id } }] }),
);

/** The organization's live memberships, narrowed by the list filter. The organization is the scope, never a filter. */
export function buildMemberListWhere(organizationId: string, query: OrganizationMemberListQuery): Prisma.OrganizationMembershipWhereInput {
	return {
		AND: [{ organizationId, isDeleted: false }, ...fieldWhere(toPrismaEqualityFilter(query.filter?.role), (role) => ({ role }))],
	};
}

export function buildMemberListOrder(query: OrganizationMemberListQuery): ListOrder<Prisma.OrganizationMembershipOrderByWithRelationInput> {
	return buildListOrder(organizationMemberListQuery.resolveSort(query.sort), { columns: MEMBER_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}

// ── Pending invites (`GET /orgs/:orgSlug/members/invites`) ──

const INVITE_SORT_COLUMNS: SortColumns<OrganizationMemberInviteListSortField, Prisma.OrganizationInvitationOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
	expiresAt: (direction) => ({ expiresAt: direction }),
};

/** Keyset for the default order (`createdAt desc, id desc`). */
const INVITE_LIST_KEYSET: ListKeyset<TeamInviteRow, Prisma.OrganizationInvitationWhereInput> = timestampIdKeyset(
	(row: TeamInviteRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.OrganizationInvitationWhereInput => ({ OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] }),
);

export function buildInviteListOrder(query: OrganizationMemberInviteListQuery): ListOrder<Prisma.OrganizationInvitationOrderByWithRelationInput> {
	return buildListOrder(organizationMemberInviteListQuery.resolveSort(query.sort), { columns: INVITE_SORT_COLUMNS, tieBreaker: (direction) => ({ id: direction }) });
}

export class PrismaTeamReadRepository implements TeamReadPort {
	public constructor(
		private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>,
		private readonly transactions: TenantTransactionService,
	) {}

	public async listMembers(
		actor: ActorContext,
		organizationId: string,
		query: OrganizationMemberListQuery,
	): Promise<PaginatedServiceResult<OrganizationMemberRosterResponse>> {
		const page = await this.reads.read(actor, async (db) =>
			fetchListPage(query, {
				where: buildMemberListWhere(organizationId, query),
				order: buildMemberListOrder(query),
				keyset: MEMBER_LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.organizationMembership.count({ where }),
				findMany: (args): Promise<MemberListRow[]> => db.organizationMembership.findMany({ ...args, include: MEMBER_LIST_INCLUDE }),
			}),
		);
		const rows = page.items;
		// `User` RLS lets a session read only its own row, so the tenant read above cannot
		// join co-members' profiles. Read exactly this organization's members' name + email
		// under an allowlisted system operation, AFTER the manage-team check passed; never
		// widen the `User` policy (it would expose whole user rows). One batched read.
		const userIds: string[] = rows.map((row) => row.userId);
		const profiles = await this.transactions.withSystemOperation(
			{
				operation: TEAM_ROSTER_PROFILES_OPERATION,
				reason: "Team roster: member names and emails for an authorized team manager",
				actorUserId: actor.kind === "user" ? actor.userId : null,
			},
			async (tx) => tx.user.findMany({ where: { id: { in: userIds }, isDeleted: false }, select: { id: true, email: true, fullName: true } }),
		);
		const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
		const items = rows.flatMap((row): OrganizationMemberRosterResponse[] => {
			const profile = profileById.get(row.userId);
			// A membership whose user row is gone is not a rosterable member.
			return profile === undefined ? [] : [mapMembershipToRosterResponse({ ...row, user: profile })];
		});
		return toPaginatedServiceResult({ ...page, items }, query);
	}

	public async listPendingInvites(
		actor: ActorContext,
		organizationId: string,
		query: OrganizationMemberInviteListQuery,
	): Promise<PaginatedServiceResult<OrganizationMemberInviteResponse>> {
		return this.reads.read(actor, async (db) => {
			const page = await fetchListPage(query, {
				where: { organizationId, kind: "TEAM_MEMBER", status: "PENDING" },
				order: buildInviteListOrder(query),
				keyset: INVITE_LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.organizationInvitation.count({ where }),
				findMany: (args): Promise<TeamInviteRow[]> => db.organizationInvitation.findMany({ ...args, include: TEAM_INVITE_INCLUDE }),
			});
			return toPaginatedServiceResult(
				mapListResult(page, (row: TeamInviteRow): OrganizationMemberInviteResponse => toInviteResponse(row, organizationId)),
				query,
			);
		});
	}

	public async findPendingInvitePreview(tokenHash: string): Promise<TeamInvitePreviewView | null> {
		const row = await this.transactions.withSystemOperation(
			{ operation: "organization.invitation.resolve_token", reason: "Resolve team invite by token", actorUserId: null },
			async (tx) => tx.organizationInvitation.findFirst({ where: { tokenHash, kind: "TEAM_MEMBER", status: "PENDING" }, include: TEAM_INVITE_INCLUDE }),
		);
		if (row === null) {
			return null;
		}
		return {
			email: row.email,
			organization: row.organization === null ? null : { slug: row.organization.slug, displayName: row.organization.displayName },
			intendedRole: row.intendedRole,
			locationScopeType: row.locationScopeType,
			locations: row.locationScopes.map((scope) => ({ id: scope.location.id, name: scope.location.name })),
			expiresAt: epochMs(Number(row.expiresAt)),
		};
	}
}
