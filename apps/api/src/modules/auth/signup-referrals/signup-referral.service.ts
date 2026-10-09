import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import {
	AuthClientTypeSchema,
	epochMs,
	type PaginatedServiceResult,
	type SignupReferralDashboard,
	type SignupReferralRefereeItem,
	type SignupReferralRefereeListQuery,
} from "@workspace/shared";

import { toPaginatedServiceResult, mapListResult } from "../../../platform/persistence/list-page";
import { PrismaService } from "../../../prisma/prisma.service";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";

import { normalizeSignupReferralCodeInput } from "./signup-referral-code.normalizer";
import { evaluateSignupReferralCode } from "./signup-referral-code.validity";
import { SignupReferralCodeError, SignupReferralCodeNotAcceptedError } from "./signup-referral.errors";
import { SignupReferralRepository } from "./signup-referral.repository";

/** Allowlisted system operation that reads referees' `fullName` for the referrer list. */
export const SIGNUP_REFERRAL_REFEREE_PROFILES_OPERATION = "auth.signup_referrals.list_referees";

/** Users the code job reads per page; it pages until no user needs a code. */
export const SIGNUP_REFERRAL_CODE_JOB_PAGE_SIZE = 200;

/** The client type whose signup form asks for a referral code (ADR 035, "Who receives a code"). */
const REFERRAL_CODE_CLIENT_TYPE = AuthClientTypeSchema.enum.web;

/** A referral code that passed validation before the signup transaction; re-checked inside it. */
export interface AcceptedSignupReferralCode {
	readonly canonical: string;
	readonly referrerUserId: string;
	readonly referralCodeId: string;
}

/** What one run of the code job did. */
export interface SignupReferralCodeJobResult {
	readonly firstCodes: number;
	readonly successors: number;
	readonly failed: number;
}

type CodeMaintenanceOutcome = "first" | "successor" | "skipped";

@Injectable()
export class SignupReferralService {
	private readonly logger: Logger = new Logger(SignupReferralService.name);

	public constructor(
		private readonly prisma: PrismaService,
		private readonly repository: SignupReferralRepository,
		private readonly tenantTx: TenantTransactionService,
	) {}

	/**
	 * Validate the submitted code before the taken-email check, so a bad code is
	 * never disguised as a successful registration (ADR 035, "Validity").
	 * `clientType` is the request's `X-Client-Type` (absent means web). Only
	 * consumer web signup may carry a code; any other client type that sends a
	 * non-empty one fails validation.
	 */
	public async acceptCodeForSignup(raw: string | null | undefined, clientType: string | undefined): Promise<AcceptedSignupReferralCode | null> {
		const normalized = normalizeSignupReferralCodeInput(raw);
		if (normalized.kind === "empty") {
			return null;
		}
		if (AuthClientTypeSchema.safeParse(clientType ?? REFERRAL_CODE_CLIENT_TYPE).data !== REFERRAL_CODE_CLIENT_TYPE) {
			throw new SignupReferralCodeNotAcceptedError();
		}
		if (normalized.kind === "invalid_shape") {
			throw new SignupReferralCodeError("unrecognized");
		}
		const validity = evaluateSignupReferralCode(await this.repository.findCodeForValidation(normalized.canonical), Date.now());
		if (validity.kind === "rejected") {
			throw new SignupReferralCodeError(validity.rejection);
		}
		return { canonical: normalized.canonical, referrerUserId: validity.referrerUserId, referralCodeId: validity.referralCodeId };
	}

	public async issueFirstCodeInTx(tx: Prisma.TransactionClient, userId: string, now: number): Promise<void> {
		await this.repository.insertCodeInTx(tx, userId, now);
	}

	/**
	 * Attach the signup referral on the signup transaction. The owner row is
	 * locked (`FOR SHARE`) and the code re-validated on `tx` at that instant: a
	 * deactivation, deletion or successor insert that committed after
	 * {@link acceptCodeForSignup} is seen here, and one that has not committed
	 * waits for this transaction. The referral is inserted only against a code
	 * that is valid inside this transaction; its `createdAt` is the referee
	 * account's creation time.
	 */
	public async attachSignupReferralInTx(
		tx: Prisma.TransactionClient,
		accepted: AcceptedSignupReferralCode,
		referee: { readonly id: string; readonly createdAt: number },
	): Promise<void> {
		if (accepted.referrerUserId === referee.id || !(await this.repository.lockCodeOwnerForSignupInTx(tx, accepted.referrerUserId))) {
			throw new SignupReferralCodeError("unavailable");
		}
		const validity = evaluateSignupReferralCode(await this.repository.findCodeForValidation(accepted.canonical, tx), Date.now());
		if (validity.kind === "rejected") {
			throw new SignupReferralCodeError(validity.rejection);
		}
		await this.repository.insertSignupReferralInTx(tx, {
			referrerUserId: validity.referrerUserId,
			refereeUserId: referee.id,
			referralCodeId: validity.referralCodeId,
			createdAt: referee.createdAt,
		});
	}

	/**
	 * The caller's latest code and its state. A read, never a write: an account
	 * the job has not backfilled yet gets `pending` (ADR 035, "Consumer read").
	 */
	public async getDashboard(userId: string): Promise<SignupReferralDashboard> {
		const [user, latest] = await Promise.all([
			this.prisma.user.findFirst({ where: { id: userId }, select: { isDeleted: true, isActive: true } }),
			this.repository.findLatestCodeForUser(userId),
		]);
		if (latest === null) {
			return { code: null, expiresAt: null, shareable: false, codeState: "pending" };
		}
		const expiresAt = epochMs(Number(latest.expiresAt));
		if (Date.now() >= Number(latest.expiresAt)) {
			return { code: latest.code, expiresAt, shareable: false, codeState: "expired" };
		}
		if (user === null || user.isDeleted || !user.isActive) {
			return { code: latest.code, expiresAt, shareable: false, codeState: "unavailable" };
		}
		return { code: latest.code, expiresAt, shareable: true, codeState: "active" };
	}

	public async listReferees(referrerUserId: string, query: SignupReferralRefereeListQuery): Promise<PaginatedServiceResult<SignupReferralRefereeItem>> {
		const result = await this.repository.listRefereesForReferrer(referrerUserId, query);
		const refereeUserIds: string[] = [...new Set(result.items.map((row) => row.refereeUserId))];
		const fullNameByUserId = await this.loadRefereeDisplayNames(referrerUserId, refereeUserIds);
		return toPaginatedServiceResult(
			mapListResult(result, (row) => ({
				fullName: fullNameByUserId.get(row.refereeUserId) ?? "",
				createdAt: epochMs(Number(row.createdAt)),
				status: row.successfulAt === null ? "not_redeemed" : "redeemed",
			})),
			query,
		);
	}

	/**
	 * The hourly code job (ADR 035, "Job"): a first code for every non-deleted
	 * user with none, and a successor for every user whose latest code expired.
	 * It pages through only the users that need a code, and handles each one in
	 * its own transaction under that user's row lock, so overlapping runs on
	 * several API replicas issue one code, not two. One user's failure is logged
	 * and does not stop the run. Must run under a bypass RLS context.
	 */
	public async maintainReferralCodes(): Promise<SignupReferralCodeJobResult> {
		let firstCodes = 0;
		let successors = 0;
		let failed = 0;
		let cursor: string | null = null;
		for (;;) {
			const userIds: readonly string[] = await this.repository.listUserIdsNeedingCode(Date.now(), SIGNUP_REFERRAL_CODE_JOB_PAGE_SIZE, cursor);
			const lastUserId = userIds.at(-1);
			if (lastUserId === undefined) {
				break;
			}
			cursor = lastUserId;
			for (const userId of userIds) {
				try {
					const outcome = await this.maintainCodeForUser(userId);
					firstCodes += outcome === "first" ? 1 : 0;
					successors += outcome === "successor" ? 1 : 0;
				} catch (error) {
					failed += 1;
					this.logger.error({ event: "signup_referral.code_issue_failed", userId, error: error instanceof Error ? error.message : String(error) });
				}
			}
		}
		return { firstCodes, successors, failed };
	}

	private async maintainCodeForUser(userId: string): Promise<CodeMaintenanceOutcome> {
		return this.prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<CodeMaintenanceOutcome> => {
			if (!(await this.repository.lockUserForCodeMaintenanceInTx(tx, userId))) {
				return "skipped";
			}
			const state = await this.repository.findCodeMaintenanceStateInTx(tx, userId);
			const now = Date.now();
			if (state === null || state.isDeleted || (state.latestExpiresAt !== null && now < Number(state.latestExpiresAt))) {
				return "skipped";
			}
			const successor = state.latestExpiresAt !== null;
			const issued = await this.repository.insertCodeInTx(tx, userId, now);
			await this.repository.appendCodeIssuedAuditInTx(tx, { ownerUserId: userId, referralCodeId: issued.id, successor });
			return successor ? "successor" : "first";
		});
	}

	private async loadRefereeDisplayNames(referrerUserId: string, refereeUserIds: readonly string[]): Promise<Map<string, string>> {
		if (refereeUserIds.length === 0) {
			return new Map();
		}
		const profiles = await this.tenantTx.withSystemOperation(
			{
				operation: SIGNUP_REFERRAL_REFEREE_PROFILES_OPERATION,
				reason: "Signup referral referee list: display names for the authenticated referrer",
				actorUserId: referrerUserId,
			},
			async (tx) =>
				tx.user.findMany({
					where: {
						id: { in: [...refereeUserIds] },
						signupReferralsAsReferee: { is: { referrerUserId, isDeleted: false } },
					},
					select: { id: true, fullName: true },
				}),
		);
		return new Map(profiles.map((profile) => [profile.id, profile.fullName]));
	}
}
