import type { TenantAccessRequest } from "@prisma/client";
import { epochMs, newRowId } from "@workspace/shared";

import { AccessRequest, type AccessRequestState } from "../../domain/aggregates/access-request.aggregate";
import { AccessRequestAlreadyReviewedError, AccessRequestPendingError } from "../../domain/errors/tenants.errors";
import type { AccessRequestRepository } from "../../domain/repositories/access-request.repository";
import type { TenantsDb } from "./tenant-db";
import { withUniqueViolationAs } from "./unique-violation";

function toState(row: TenantAccessRequest): AccessRequestState {
	return { id: row.id, tenantId: row.tenantId, userId: row.userId, status: row.status, message: row.message, createdAt: epochMs(Number(row.createdAt)) };
}

export class PrismaAccessRequestRepository implements AccessRequestRepository {
	public constructor(private readonly db: TenantsDb) {}

	public nextId(): string {
		return newRowId();
	}

	public async hasPending(tenantId: string, userId: string): Promise<boolean> {
		return (await this.db.tenantAccessRequest.findFirst({ where: { tenantId, userId, status: "PENDING" }, select: { id: true } })) !== null;
	}

	public async findInTenant(tenantId: string, accessRequestId: string): Promise<AccessRequest | null> {
		const row = await this.db.tenantAccessRequest.findFirst({ where: { id: accessRequestId, tenantId } });
		return row === null ? null : AccessRequest.rehydrate(toState(row));
	}

	/** The partial unique index (one PENDING request per tenant + user) turns a concurrent duplicate into 409. */
	public async add(request: AccessRequest): Promise<AccessRequestState> {
		const row = await withUniqueViolationAs(
			async () =>
				this.db.tenantAccessRequest.create({
					data: { id: request.id, tenantId: request.tenantId, userId: request.requesterUserId, message: request.message },
				}),
			() => new AccessRequestPendingError(),
		);
		return toState(row);
	}

	public async save(request: AccessRequest): Promise<void> {
		const review = request.reviewStamp;
		if (review === null) {
			return;
		}
		const reviewedAt = BigInt(review.reviewedAt);
		const claimed = await this.db.tenantAccessRequest.updateMany({
			where: { id: request.id, tenantId: request.tenantId, status: "PENDING" },
			data: { status: request.currentStatus, reviewedById: review.reviewedByUserId, reviewedAt, updatedAt: reviewedAt },
		});
		if (claimed.count !== 1) {
			throw new AccessRequestAlreadyReviewedError();
		}
	}
}
