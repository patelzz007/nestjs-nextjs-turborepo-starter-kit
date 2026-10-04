import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MfaRecoveryRequestStatus, type Prisma } from "@prisma/client";
import {
	assertNever,
	epochMs,
	adminMfaRecoveryListQuery,
	type AdminMfaRecoveryListQuery,
	type AdminMfaRecoveryListSortField,
	type AdminMfaRecoveryRequest,
	type AdminReviewMfaRecoveryInput,
	type InitiateMfaRecoveryInput,
	type MfaRecoveryStatusResponse,
	type PaginatedServiceResult,
} from "@workspace/shared";

import { fetchListPage, mapListResult, toPaginatedServiceResult } from "../../../platform/persistence/list-page";
import { timestampIdKeyset, type ListKeyset } from "../../../platform/persistence/list-query/keyset-cursor";
import { buildListOrder, type ListOrder, type SortColumns } from "../../../platform/persistence/list-query/list-order";
import { fieldWhere, toPrismaEqualityFilter } from "../../../platform/persistence/list-query/prisma-filter";

import { TypedConfigService } from "../../../config/typed-config.service";
import { LogService } from "../../../modules/logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { MfaRecoveryRepository, type ReviewDecision, type ReviewRecoveryResult } from "../repositories/mfa-recovery.repository";
import { AuthorizationInvalidationService } from "../../authorization/cache/authorization-invalidation.service";
import { EmailService } from "./email.service";

const MFA_RECOVERY_ADMIN_INCLUDE = {
	user: { select: { email: true, fullName: true } },
} satisfies Prisma.MfaRecoveryRequestInclude;

type MfaRecoveryAdminRow = Prisma.MfaRecoveryRequestGetPayload<{ include: typeof MFA_RECOVERY_ADMIN_INCLUDE }>;

// ── List query → Prisma (explicit field → column mapping; see docs/technical/api/list-queries.md) ──

const MFA_RECOVERY_SORT_COLUMNS: SortColumns<AdminMfaRecoveryListSortField, Prisma.MfaRecoveryRequestOrderByWithRelationInput> = {
	requestedAt: (direction) => ({ requestedAt: direction }),
	createdAt: (direction) => ({ createdAt: direction }),
};

/** Keyset for the default order (`requestedAt desc, id desc`). */
const MFA_RECOVERY_LIST_KEYSET: ListKeyset<MfaRecoveryAdminRow, Prisma.MfaRecoveryRequestWhereInput> = timestampIdKeyset(
	(row: MfaRecoveryAdminRow) => ({ at: Number(row.requestedAt), id: row.id }),
	({ at, id }): Prisma.MfaRecoveryRequestWhereInput => ({ OR: [{ requestedAt: { lt: at } }, { requestedAt: at, id: { lt: id } }] }),
);

export function buildMfaRecoveryListWhere(query: AdminMfaRecoveryListQuery): Prisma.MfaRecoveryRequestWhereInput {
	const filter = query.filter;
	return {
		AND: [...fieldWhere(toPrismaEqualityFilter(filter?.status), (status) => ({ status })), ...fieldWhere(toPrismaEqualityFilter(filter?.userId), (userId) => ({ userId }))],
	};
}

export function buildMfaRecoveryListOrder(query: AdminMfaRecoveryListQuery): ListOrder<Prisma.MfaRecoveryRequestOrderByWithRelationInput> {
	return buildListOrder(adminMfaRecoveryListQuery.resolveSort(query.sort), {
		columns: MFA_RECOVERY_SORT_COLUMNS,
		tieBreaker: (direction) => ({ id: direction }),
	});
}

/** Milliseconds per hour — renders the recovery delay in the approval email. */
const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Admin-reviewed MFA recovery. State changes go through
 * {@link MfaRecoveryRepository}: compare-and-set on `status`, audit row in the
 * same transaction, and a reviewer who is an active SuperAdmin other than the
 * requester. Reads use the request-scoped client.
 */
@Injectable()
export class MfaRecoveryService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly recoveries: MfaRecoveryRepository,
		private readonly config: TypedConfigService,
		private readonly emailService: EmailService,
		private readonly authorizationInvalidation: AuthorizationInvalidationService,
		private readonly logService: LogService,
	) {}

	public async initiateRecovery(userId: string, dto: InitiateMfaRecoveryInput): Promise<MfaRecoveryStatusResponse> {
		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { email: true, fullName: true, twoFactorEnabled: true },
		});

		if (user === null) {
			throw new NotFoundException("User not found");
		}

		if (!user.twoFactorEnabled) {
			throw new BadRequestException("Two-factor authentication is not enabled on this account");
		}

		const notes = dto.reason ?? null;
		const opened = await this.recoveries.openRequest(userId, notes, Date.now());
		if (opened.kind === "already_open") {
			throw new BadRequestException("An MFA recovery request is already in progress");
		}
		const request = opened.request;

		const userMessage = "We received your MFA recovery request. A super administrator will review it shortly. You will be notified once a decision is made.";
		await this.emailService.sendMfaRecoveryUserNotification(user.email, "MFA Recovery Request Submitted", userMessage);

		const adminMessage = [
			`User ${user.fullName} (${user.email}) submitted an MFA recovery request.`,
			`Request ID: ${request.id}`,
			notes !== null ? `Reason: ${notes}` : "No reason provided.",
			"",
			"Please review this request in the admin panel.",
		].join("\n");

		await this.notifySuperAdmins("MFA Recovery Review Required", adminMessage);

		this.logService.info("MFA recovery request initiated", {
			userId,
			context: "MfaRecoveryService",
			metadata: { requestId: request.id, hasReason: notes !== null },
		});

		return {
			status: "PENDING",
			message: "MFA recovery request submitted. An administrator will review it shortly.",
		};
	}

	public async getRecoveryStatus(userId: string): Promise<MfaRecoveryStatusResponse> {
		const request = await this.prisma.mfaRecoveryRequest.findFirst({
			where: { userId },
			orderBy: { requestedAt: "desc" },
		});

		if (request === null) {
			return {
				status: "NONE",
				message: "No MFA recovery request found",
			};
		}

		return this.toStatusResponse(request);
	}

	public async listAdminRecoveryRequests(query: AdminMfaRecoveryListQuery): Promise<PaginatedServiceResult<AdminMfaRecoveryRequest>> {
		const result = await fetchListPage(query, {
			where: buildMfaRecoveryListWhere(query),
			order: buildMfaRecoveryListOrder(query),
			keyset: MFA_RECOVERY_LIST_KEYSET,
			and: (left, right) => ({ AND: [left, right] }),
			count: (where) => this.prisma.mfaRecoveryRequest.count({ where }),
			findMany: (args): Promise<MfaRecoveryAdminRow[]> => this.prisma.mfaRecoveryRequest.findMany({ ...args, include: MFA_RECOVERY_ADMIN_INCLUDE }),
		});
		return toPaginatedServiceResult(
			mapListResult(result, (request: MfaRecoveryAdminRow) => this.toAdminRequest(request)),
			query,
		);
	}

	public async adminApprove(adminUserId: string, dto: AdminReviewMfaRecoveryInput): Promise<MfaRecoveryStatusResponse> {
		const reviewedAt = Date.now();
		const scheduledUnlockAt = reviewedAt + this.config.mfaRecoveryDelayMs;
		const updated = await this.review(adminUserId, dto, MfaRecoveryRequestStatus.APPROVED, reviewedAt, scheduledUnlockAt);

		const user = await this.prisma.user.findUnique({
			where: { id: updated.userId },
			select: { email: true },
		});

		if (user !== null) {
			const delayHours = Math.round(this.config.mfaRecoveryDelayMs / MS_PER_HOUR);
			await this.emailService.sendMfaRecoveryUserNotification(
				user.email,
				"MFA Recovery Approved",
				`Your MFA recovery request was approved. MFA will be disabled after a ${String(delayHours)}-hour security delay.`,
			);
		}

		this.logService.info("MFA recovery request approved", {
			userId: updated.userId,
			context: "MfaRecoveryService",
			metadata: { requestId: updated.id, reviewedBy: adminUserId, scheduledUnlockAt },
		});

		return this.toStatusResponse(updated);
	}

	public async adminDeny(adminUserId: string, dto: AdminReviewMfaRecoveryInput): Promise<MfaRecoveryStatusResponse> {
		const updated = await this.review(adminUserId, dto, MfaRecoveryRequestStatus.DENIED, Date.now(), null);

		const user = await this.prisma.user.findUnique({
			where: { id: updated.userId },
			select: { email: true },
		});

		if (user !== null) {
			await this.emailService.sendMfaRecoveryUserNotification(
				user.email,
				"MFA Recovery Denied",
				"Your MFA recovery request was denied. If you still need help, please contact support.",
			);
		}

		this.logService.info("MFA recovery request denied", {
			userId: updated.userId,
			context: "MfaRecoveryService",
			metadata: { requestId: updated.id, reviewedBy: adminUserId },
		});

		return this.toStatusResponse(updated);
	}

	public async processScheduledUnlocks(): Promise<void> {
		const dueRequests = await this.recoveries.findDueApproved(Date.now());

		for (const request of dueRequests) {
			await this.completeApprovedRecovery(request.id);
		}
	}

	private async completeApprovedRecovery(requestId: string): Promise<void> {
		const completed = await this.recoveries.complete(requestId, Date.now());
		if (completed.kind === "not_due") {
			// Another worker already completed this request (or it is no longer due).
			return;
		}

		// `tokenVersion` was bumped in the committed completion transaction: drop the
		// cached token/authorization state on EVERY API instance.
		await this.authorizationInvalidation.invalidateUsers([completed.userId], { accessTokenState: true, trigger: "mfa_recovery_completed" });

		const user = await this.prisma.user.findUnique({
			where: { id: completed.userId },
			select: { email: true },
		});

		if (user !== null) {
			await this.emailService.sendTwoFactorDisabledEmail(user.email);
		}

		this.logService.info("MFA recovery completed — MFA cleared after scheduled unlock", {
			userId: completed.userId,
			context: "MfaRecoveryService",
			metadata: { requestId, approvedBy: completed.reviewerId },
		});
	}

	/** Runs one review through the repository and maps every refusal to its HTTP error. */
	private async review(
		reviewerId: string,
		dto: AdminReviewMfaRecoveryInput,
		decision: ReviewDecision,
		reviewedAt: number,
		scheduledUnlockAt: number | null,
	): Promise<{ readonly id: string; readonly userId: string; readonly status: MfaRecoveryRequestStatus; readonly scheduledUnlockAt: bigint | null }> {
		const result: ReviewRecoveryResult = await this.recoveries.review({
			requestId: dto.requestId,
			reviewerId,
			decision,
			reviewedAt,
			scheduledUnlockAt,
			notes: dto.notes,
		});

		switch (result.kind) {
			case "reviewed":
				return result.request;
			case "not_found":
				throw new NotFoundException("MFA recovery request not found");
			case "not_pending":
				throw new BadRequestException("Only pending MFA recovery requests can be reviewed");
			case "self_review":
				throw new ForbiddenException({
					message: "You cannot review your own MFA recovery request — another super administrator must review it",
					error: "MFA_RECOVERY_SELF_REVIEW",
				});
			case "reviewer_not_eligible":
				throw new ForbiddenException({
					message: "Only an active super administrator can review MFA recovery requests",
					error: "MFA_RECOVERY_REVIEWER_NOT_ELIGIBLE",
				});
			default:
				return assertNever(result, "MFA recovery review result");
		}
	}

	private async notifySuperAdmins(title: string, message: string): Promise<void> {
		const admins = await this.prisma.user.findMany({
			where: { isSuperAdmin: true, isActive: true, isDeleted: false },
			select: { email: true },
		});

		for (const admin of admins) {
			await this.emailService.sendMfaRecoveryAdminNotification(admin.email, title, message);
		}
	}

	private toAdminRequest(request: {
		readonly id: string;
		readonly userId: string;
		readonly status: MfaRecoveryRequestStatus;
		readonly requestedAt: bigint;
		readonly reviewedBy: string | null;
		readonly reviewedAt: bigint | null;
		readonly scheduledUnlockAt: bigint | null;
		readonly completedAt: bigint | null;
		readonly notes: string | null;
		readonly user: {
			readonly email: string;
			readonly fullName: string;
		};
	}): AdminMfaRecoveryRequest {
		return {
			id: request.id,
			userId: request.userId,
			userEmail: request.user.email,
			userFullName: request.user.fullName,
			status: request.status,
			requestedAt: epochMs(Number(request.requestedAt)),
			reviewedBy: request.reviewedBy,
			reviewedAt: request.reviewedAt !== null ? epochMs(Number(request.reviewedAt)) : null,
			scheduledUnlockAt: request.scheduledUnlockAt !== null ? epochMs(Number(request.scheduledUnlockAt)) : null,
			completedAt: request.completedAt !== null ? epochMs(Number(request.completedAt)) : null,
			notes: request.notes,
		};
	}

	private toStatusResponse(request: { readonly status: MfaRecoveryRequestStatus; readonly scheduledUnlockAt: bigint | null }): MfaRecoveryStatusResponse {
		const statusMap: Record<MfaRecoveryRequestStatus, MfaRecoveryStatusResponse["status"]> = {
			[MfaRecoveryRequestStatus.PENDING]: "PENDING",
			[MfaRecoveryRequestStatus.APPROVED]: "APPROVED",
			[MfaRecoveryRequestStatus.DENIED]: "DENIED",
			[MfaRecoveryRequestStatus.COMPLETED]: "COMPLETED",
		};

		const messageMap: Record<MfaRecoveryRequestStatus, string> = {
			[MfaRecoveryRequestStatus.PENDING]: "Your MFA recovery request is pending administrator review.",
			[MfaRecoveryRequestStatus.APPROVED]: "Your MFA recovery request was approved. MFA will be disabled after the security delay.",
			[MfaRecoveryRequestStatus.DENIED]: "Your MFA recovery request was denied.",
			[MfaRecoveryRequestStatus.COMPLETED]: "MFA recovery is complete. Two-factor authentication has been disabled.",
		};

		const response: MfaRecoveryStatusResponse = {
			status: statusMap[request.status],
			message: messageMap[request.status],
		};

		if (request.scheduledUnlockAt !== null && request.status === MfaRecoveryRequestStatus.APPROVED) {
			return {
				...response,
				scheduledUnlockAt: epochMs(Number(request.scheduledUnlockAt)),
			};
		}

		return response;
	}
}
