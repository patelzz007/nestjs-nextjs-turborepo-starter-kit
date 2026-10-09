import { Injectable } from "@nestjs/common";
import type { Prisma, SignupReferral, SignupReferralCode } from "@prisma/client";

import { signupReferralRefereeListQuery, SIGNUP_REFERRALS_SCREEN_PATH, type SignupReferralRefereeListQuery, type SignupReferralStatus } from "@workspace/shared";

import { fetchListPage } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import type { RepositoryListResult } from "../../../platform/persistence/types";
import { PrismaService } from "../../../prisma/prisma.service";
import { issueSignupReferralCode, type IssuedSignupReferralCode } from "./signup-referral-code.issuer";
import type { SignupReferralCodeForValidation } from "./signup-referral-code.validity";

type SignupReferralRefereeListSortField = "createdAt";

/** `reward_notifications.type` of the referrer's "your referral is successful" notice. */
export const SIGNUP_REFERRAL_SUCCESS_NOTIFICATION_TYPE = "signup_referral_redeemed";

/** `reward_audit_logs.action` the code job writes for every code it issues (ADR 035, "Authorization and audit"). */
export const SIGNUP_REFERRAL_CODE_ISSUED_AUDIT_ACTION = "signup_referral.code_issued";

/** Newest first, tie broken by id — the order every "latest code" read uses (ADR 035, "Boundaries"). */
const LATEST_CODE_ORDER: Prisma.SignupReferralCodeOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];

/** One row of the referrer's referee list. */
export interface SignupReferralRefereeListRow {
	readonly id: string;
	readonly refereeUserId: string;
	readonly createdAt: bigint;
	readonly successfulAt: bigint | null;
}

/** The referral facts the admin user list and profile show for one referee. */
export interface AdminSignupReferralSummary {
	readonly referrer: { readonly id: string; readonly fullName: string };
	readonly status: SignupReferralStatus;
}

/** A signup referral whose success notification is still owed, in delivery order. */
export interface PendingSignupReferralNotification {
	readonly id: string;
	readonly successfulAt: bigint;
}

/** What the success notification says, read at send time (ADR 035, "Notification"). */
export interface SignupReferralNotificationSubject {
	readonly referrerUserId: string;
	readonly refereeFullName: string;
}

/** The latest code and account state the code job re-reads under the owner's lock. */
export interface SignupReferralCodeMaintenanceState {
	readonly isDeleted: boolean;
	readonly latestExpiresAt: bigint | null;
}

const REFEREE_SORT_COLUMNS: SortColumns<SignupReferralRefereeListSortField, Prisma.SignupReferralOrderByWithRelationInput> = {
	createdAt: (direction) => ({ createdAt: direction }),
};

const REFEREE_LIST_KEYSET: ListKeyset<SignupReferralRefereeListRow, Prisma.SignupReferralWhereInput> = timestampIdKeyset(
	(row: SignupReferralRefereeListRow) => ({ at: Number(row.createdAt), id: row.id }),
	({ at, id }): Prisma.SignupReferralWhereInput => ({ OR: [{ createdAt: { lt: BigInt(at) } }, { createdAt: BigInt(at), id: { lt: id } }] }),
);

function statusOf(successfulAt: bigint | null): SignupReferralStatus {
	return successfulAt === null ? "not_redeemed" : "redeemed";
}

@Injectable()
export class SignupReferralRepository {
	public constructor(private readonly prisma: PrismaService) {}

	// ── Codes ───────────────────────────────────────────────────────────

	public async findLatestCodeForUser(userId: string): Promise<SignupReferralCode | null> {
		return this.prisma.signupReferralCode.findFirst({ where: { userId, isDeleted: false }, orderBy: LATEST_CODE_ORDER });
	}

	/**
	 * The code row matching `canonical` (unique index lookup, never a scan by
	 * owner), with its owner's account state and latest code id — everything the
	 * validity rule needs, in one read. `db` is the signup transaction when the
	 * read must see the state the insert commits against.
	 */
	public async findCodeForValidation(canonical: string, db: Prisma.TransactionClient = this.prisma): Promise<SignupReferralCodeForValidation | null> {
		const row = await db.signupReferralCode.findUnique({
			where: { code: canonical },
			select: {
				id: true,
				userId: true,
				expiresAt: true,
				isDeleted: true,
				user: {
					select: {
						isDeleted: true,
						isActive: true,
						signupReferralCodes: { where: { isDeleted: false }, orderBy: LATEST_CODE_ORDER, take: 1, select: { id: true } },
					},
				},
			},
		});
		if (row === null) {
			return null;
		}
		const [latest] = row.user.signupReferralCodes;
		return {
			id: row.id,
			userId: row.userId,
			expiresAt: row.expiresAt,
			isDeleted: row.isDeleted,
			owner: { isDeleted: row.user.isDeleted, isActive: row.user.isActive, latestCodeId: latest?.id ?? null },
		};
	}

	public async insertCodeInTx(tx: Prisma.TransactionClient, userId: string, now: number): Promise<IssuedSignupReferralCode> {
		return issueSignupReferralCode(tx, userId, now);
	}

	/**
	 * Row-lock the code owner for the rest of the signup transaction
	 * (`FOR SHARE`): a concurrent deactivation, deletion, or the code job's
	 * successor insert (which takes `FOR UPDATE` on the same row) waits until
	 * this signup commits, and this signup waits for theirs. Returns whether the
	 * owner row exists.
	 */
	public async lockCodeOwnerForSignupInTx(tx: Prisma.TransactionClient, ownerUserId: string): Promise<boolean> {
		return (await tx.$executeRaw`SELECT id FROM users WHERE id = ${ownerUserId} FOR SHARE`) === 1;
	}

	/**
	 * Row-lock a user for the code job (`FOR UPDATE`), so two job runs — one per
	 * API replica — serialize on the same user and the second re-reads the code
	 * the first inserted. Returns whether the user row exists.
	 */
	public async lockUserForCodeMaintenanceInTx(tx: Prisma.TransactionClient, userId: string): Promise<boolean> {
		return (await tx.$executeRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`) === 1;
	}

	/**
	 * Non-deleted users after `cursorId` (id order) who need a code: no live code
	 * at all, or none with `expiresAt > now`. Every code's `expiresAt` is its
	 * insert time plus the same TTL, so the latest code has the greatest
	 * `expiresAt` and "no code unexpired" is exactly "latest code missing or
	 * expired". Users with a valid code never reach the per-user transaction.
	 */
	public async listUserIdsNeedingCode(now: number, limit: number, cursorId: string | null): Promise<readonly string[]> {
		const rows = await this.prisma.user.findMany({
			where: {
				isDeleted: false,
				signupReferralCodes: { none: { isDeleted: false, expiresAt: { gt: BigInt(now) } } },
				...(cursorId === null ? {} : { id: { gt: cursorId } }),
			},
			orderBy: { id: "asc" },
			take: limit,
			select: { id: true },
		});
		return rows.map((row) => row.id);
	}

	/** The account state and latest code of one user, read on the job's transaction after the user lock. */
	public async findCodeMaintenanceStateInTx(tx: Prisma.TransactionClient, userId: string): Promise<SignupReferralCodeMaintenanceState | null> {
		const user = await tx.user.findUnique({
			where: { id: userId },
			select: { isDeleted: true, signupReferralCodes: { where: { isDeleted: false }, orderBy: LATEST_CODE_ORDER, take: 1, select: { expiresAt: true } } },
		});
		if (user === null) {
			return null;
		}
		const [latest] = user.signupReferralCodes;
		return { isDeleted: user.isDeleted, latestExpiresAt: latest?.expiresAt ?? null };
	}

	/**
	 * The system audit entry for a code the job issued: the owner and the new row
	 * id, never the code value (operators read that from the code row).
	 */
	public async appendCodeIssuedAuditInTx(
		tx: Prisma.TransactionClient,
		input: { readonly ownerUserId: string; readonly referralCodeId: string; readonly successor: boolean },
	): Promise<void> {
		await tx.rewardAuditLog.createMany({
			data: [
				{
					actorUserId: null,
					organizationId: null,
					action: SIGNUP_REFERRAL_CODE_ISSUED_AUDIT_ACTION,
					metadata: { actor: "system", ownerUserId: input.ownerUserId, referralCodeId: input.referralCodeId, successor: input.successor },
				},
			],
		});
	}

	// ── Signup referrals ────────────────────────────────────────────────

	public async insertSignupReferralInTx(
		tx: Prisma.TransactionClient,
		input: { readonly referrerUserId: string; readonly refereeUserId: string; readonly referralCodeId: string; readonly createdAt: number },
	): Promise<SignupReferral> {
		return tx.signupReferral.create({
			data: {
				referrerUserId: input.referrerUserId,
				refereeUserId: input.refereeUserId,
				referralCodeId: input.referralCodeId,
				createdAt: BigInt(input.createdAt),
			},
		});
	}

	public async listRefereesForReferrer(referrerUserId: string, query: SignupReferralRefereeListQuery): Promise<RepositoryListResult<SignupReferralRefereeListRow>> {
		return fetchListPage(query, {
			where: { referrerUserId, isDeleted: false },
			order: buildListOrder(signupReferralRefereeListQuery.resolveSort(query.sort), {
				columns: REFEREE_SORT_COLUMNS,
				tieBreaker: (direction) => ({ id: direction }),
			}),
			keyset: REFEREE_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.prisma.signupReferral.count({ where }),
			findMany: async (args): Promise<SignupReferralRefereeListRow[]> =>
				this.prisma.signupReferral.findMany({
					where: args.where,
					orderBy: args.orderBy,
					take: args.take,
					...(args.skip === undefined ? {} : { skip: args.skip }),
					select: { id: true, refereeUserId: true, createdAt: true, successfulAt: true },
				}),
		});
	}

	/** One batched read for a page of admin user rows: referee id → referrer and status. */
	public async findAdminSummariesForReferees(refereeUserIds: readonly string[]): Promise<ReadonlyMap<string, AdminSignupReferralSummary>> {
		if (refereeUserIds.length === 0) {
			return new Map();
		}
		const rows = await this.prisma.signupReferral.findMany({
			where: { refereeUserId: { in: [...refereeUserIds] }, isDeleted: false },
			select: { refereeUserId: true, successfulAt: true, referrerUser: { select: { id: true, fullName: true } } },
		});
		return new Map(
			rows.map((row): [string, AdminSignupReferralSummary] => [
				row.refereeUserId,
				{ referrer: { id: row.referrerUser.id, fullName: row.referrerUser.fullName }, status: statusOf(row.successfulAt) },
			]),
		);
	}

	public async findAdminSummaryForReferee(refereeUserId: string): Promise<AdminSignupReferralSummary | null> {
		return (await this.findAdminSummariesForReferees([refereeUserId])).get(refereeUserId) ?? null;
	}

	// ── Success and its notification ────────────────────────────────────

	/**
	 * Stamp the referee's signup referral successful on the checkout transaction
	 * (ADR 035, "Success"). The conditional update (`successfulAt` still null) is
	 * the race guard: of two concurrent checkouts only one matches, and the other
	 * continues the sale without a stamp. Returns the stamped referral's id, or
	 * null when there is nothing to stamp.
	 */
	public async markSuccessfulInTx(tx: Prisma.TransactionClient, refereeUserId: string, paidAt: number): Promise<string | null> {
		const referral = await tx.signupReferral.findFirst({ where: { refereeUserId, isDeleted: false, successfulAt: null }, select: { id: true } });
		if (referral === null) {
			return null;
		}
		const updated = await tx.signupReferral.updateMany({
			where: { id: referral.id, isDeleted: false, successfulAt: null },
			data: { successfulAt: BigInt(paidAt), updatedAt: BigInt(paidAt) },
		});
		return updated.count === 1 ? referral.id : null;
	}

	/**
	 * Owed notifications after `after` in (`successfulAt`, `id`) order. Keyset
	 * paging lets one run drain the whole backlog and step past a row that keeps
	 * failing instead of retrying it at the head of every batch.
	 */
	public async listPendingSuccessNotifications(limit: number, after: PendingSignupReferralNotification | null): Promise<readonly PendingSignupReferralNotification[]> {
		const owed: Prisma.SignupReferralWhereInput = { isDeleted: false, successfulAt: { not: null }, successNotifiedAt: null };
		const rows = await this.prisma.signupReferral.findMany({
			where: after === null ? owed : { AND: [owed, { OR: [{ successfulAt: { gt: after.successfulAt } }, { successfulAt: after.successfulAt, id: { gt: after.id } }] }] },
			orderBy: [{ successfulAt: "asc" }, { id: "asc" }],
			take: limit,
			select: { id: true, successfulAt: true },
		});
		return rows.flatMap((row): PendingSignupReferralNotification[] => (row.successfulAt === null ? [] : [{ id: row.id, successfulAt: row.successfulAt }]));
	}

	/**
	 * Claim the notification for `signupReferralId` on the delivery transaction:
	 * set `successNotifiedAt` only where the referral is successful and still
	 * owed. Exactly one concurrent deliverer wins; the losers see zero rows and
	 * write nothing. A failed insert after the claim rolls the claim back.
	 */
	public async claimSuccessNotificationInTx(tx: Prisma.TransactionClient, signupReferralId: string, notifiedAt: number): Promise<boolean> {
		const claimed = await tx.signupReferral.updateMany({
			where: { id: signupReferralId, isDeleted: false, successfulAt: { not: null }, successNotifiedAt: null },
			data: { successNotifiedAt: BigInt(notifiedAt), updatedAt: BigInt(notifiedAt) },
		});
		return claimed.count === 1;
	}

	public async findNotificationSubjectInTx(tx: Prisma.TransactionClient, signupReferralId: string): Promise<SignupReferralNotificationSubject | null> {
		const row = await tx.signupReferral.findUnique({
			where: { id: signupReferralId },
			select: { referrerUserId: true, refereeUser: { select: { fullName: true } } },
		});
		return row === null ? null : { referrerUserId: row.referrerUserId, refereeFullName: row.refereeUser.fullName };
	}

	public async insertSuccessNotificationInTx(tx: Prisma.TransactionClient, signupReferralId: string, subject: SignupReferralNotificationSubject): Promise<void> {
		await tx.rewardNotification.createMany({
			data: [
				{
					userId: subject.referrerUserId,
					type: SIGNUP_REFERRAL_SUCCESS_NOTIFICATION_TYPE,
					title: "Referral successful",
					body: `${subject.refereeFullName} redeemed a reward. Your referral is successful.`,
					metadata: { signupReferralId, href: SIGNUP_REFERRALS_SCREEN_PATH },
				},
			],
		});
	}
}
