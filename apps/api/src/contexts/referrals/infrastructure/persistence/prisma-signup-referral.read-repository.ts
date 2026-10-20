import type { Prisma } from "@prisma/client";
import {
	epochMs,
	signupReferralRefereeListQuery,
	type PaginatedServiceResult,
	type SignupReferralRefereeItem,
	type SignupReferralRefereeListQuery,
	type SignupReferralStatus,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../../platform/infrastructure/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../../platform/infrastructure/persistence/list-query/keyset-cursor";
import { buildListOrder, type SortColumns } from "../../../../platform/infrastructure/persistence/list-query/list-order";
import type { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { SignupReferralSummary } from "../../application/ports/signup-referral.port";
import type { SignupReferralDashboardFacts, SignupReferralReadPort } from "../../application/ports/signup-referral-read.port";
import type { SignupReferralCodeForValidation } from "../../domain/policies/signup-referral-code-validity.policy";
import { findCodeForValidation, LATEST_CODE_ORDER } from "./signup-referral.queries";

/** Read a code and its owner before signup accepts it. */
const VALIDATE_CODE_OPERATION: SystemOperationName = "auth.signup_referrals.validate_code";
/** Allowlisted system operation that reads referees' `fullName` for the referrer list (users cannot read other users under RLS). */
const REFEREE_PROFILES_OPERATION: SystemOperationName = "auth.signup_referrals.list_referees";
/** Referral status shown beside each account on the admin user list. */
const ADMIN_REFERRAL_SUMMARY_OPERATION: SystemOperationName = "auth.signup_referrals.admin_summary";

type SignupReferralRefereeListSortField = "createdAt";

/** One row of the referrer's referee list. */
interface RefereeListRow {
	readonly id: string;
	readonly refereeUserId: string;
	readonly createdAt: bigint;
	readonly successfulAt: bigint | null;
}

const REFEREE_SORT_COLUMNS: SortColumns<SignupReferralRefereeListSortField, Prisma.SignupReferralOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
};

const REFEREE_LIST_KEYSET: ListKeyset<RefereeListRow, Prisma.SignupReferralWhereInput> = timestampIdKeyset(
	(row: RefereeListRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.SignupReferralWhereInput => ({ OR: [{ createdAt: { lt: BigInt(at) } }, { createdAt: BigInt(at), id: { lt: id } }] }),
);

function statusOf(successfulAt: bigint | null): SignupReferralStatus {
	return successfulAt === null ? "not_redeemed" : "redeemed";
}

/** {@link SignupReferralReadPort} over Prisma: the caller's own rows under the caller's RLS session. */
export class PrismaSignupReferralReadRepository implements SignupReferralReadPort {
	public constructor(
		private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>,
		private readonly transactions: TenantTransactionService,
	) {}

	public dashboardFacts(actor: ActorContext, userId: string): Promise<SignupReferralDashboardFacts> {
		return this.reads.read(actor, async (db): Promise<SignupReferralDashboardFacts> => {
			const [account, latest] = await Promise.all([
				db.user.findFirst({ where: { id: userId }, select: { isDeleted: true, isActive: true } }),
				db.signupReferralCode.findFirst({ where: { userId, isDeleted: false }, orderBy: LATEST_CODE_ORDER, select: { code: true, expiresAt: true } }),
			]);
			return { account, latestCode: latest === null ? null : { code: latest.code, expiresAt: epochMs(Number(latest.expiresAt)) } };
		});
	}

	public async listReferees(actor: ActorContext, referrerUserId: string, query: SignupReferralRefereeListQuery): Promise<PaginatedServiceResult<SignupReferralRefereeItem>> {
		const result = await this.reads.read(actor, (db) =>
			fetchListPage(query, {
				where: { referrerUserId, isDeleted: false },
				order: buildListOrder(signupReferralRefereeListQuery.resolveSort(query.sort), {
					columns: REFEREE_SORT_COLUMNS,
					tieBreaker: (direction) => ({ id: direction }),
				}),
				keyset: REFEREE_LIST_KEYSET,
				and: (left, right) => ({ AND: [left, right] }),
				count: (where) => db.signupReferral.count({ where }),
				findMany: async (args): Promise<RefereeListRow[]> =>
					db.signupReferral.findMany({
						where: args.where,
						orderBy: args.orderBy,
						take: args.take,
						...(args.skip === undefined ? {} : { skip: args.skip }),
						select: { id: true, refereeUserId: true, createdAt: true, successfulAt: true },
					}),
			}),
		);
		const fullNameByUserId = await this.refereeDisplayNames(referrerUserId, [...new Set(result.items.map((row) => row.refereeUserId))]);
		return toPaginatedServiceResult(
			mapListResult(result, (row) => ({
				fullName: fullNameByUserId.get(row.refereeUserId) ?? "",
				createdAt: epochMs(Number(row.createdAt)),
				status: statusOf(row.successfulAt),
			})),
			query,
		);
	}

	public findCodeForValidation(canonical: string): Promise<SignupReferralCodeForValidation | null> {
		return this.transactions.withSystemOperation(
			{ operation: VALIDATE_CODE_OPERATION, reason: "Read a signup referral code and its owner before signup", actorUserId: null },
			(tx) => findCodeForValidation(tx, canonical),
		);
	}

	public async summariesForReferees(refereeUserIds: readonly string[]): Promise<ReadonlyMap<string, SignupReferralSummary>> {
		if (refereeUserIds.length === 0) {
			return new Map();
		}
		const rows = await this.transactions.withSystemOperation(
			{ operation: ADMIN_REFERRAL_SUMMARY_OPERATION, reason: "Read referral status for a page of admin accounts", actorUserId: null },
			(tx) =>
				tx.signupReferral.findMany({
					where: { refereeUserId: { in: [...refereeUserIds] }, isDeleted: false },
					select: { refereeUserId: true, successfulAt: true, referrerUser: { select: { id: true, fullName: true } } },
				}),
		);
		return new Map(
			rows.map((row): [string, SignupReferralSummary] => [
				row.refereeUserId,
				{ referrer: { id: row.referrerUser.id, fullName: row.referrerUser.fullName }, status: statusOf(row.successfulAt) },
			]),
		);
	}

	/** One batched read for the page; only users who registered with this referrer's codes are visible. */
	private async refereeDisplayNames(referrerUserId: string, refereeUserIds: readonly string[]): Promise<Map<string, string>> {
		if (refereeUserIds.length === 0) {
			return new Map();
		}
		const profiles = await this.transactions.withSystemOperation(
			{ operation: REFEREE_PROFILES_OPERATION, reason: "Signup referral referee list: display names for the authenticated referrer", actorUserId: referrerUserId },
			async (tx) =>
				tx.user.findMany({
					where: { id: { in: [...refereeUserIds] }, signupReferralsAsReferee: { is: { referrerUserId, isDeleted: false } } },
					select: { id: true, fullName: true },
				}),
		);
		return new Map(profiles.map((profile) => [profile.id, profile.fullName]));
	}
}
