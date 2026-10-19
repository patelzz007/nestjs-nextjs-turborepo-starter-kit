import type { OrganizationAccessRequest } from "@prisma/client";
import { epochMs, newRowId } from "@workspace/shared";

import { AccessRequest, type AccessRequestState } from "../../domain/aggregates/access-request.aggregate";
import { AccessRequestAlreadyReviewedError, AccessRequestPendingError } from "../../domain/errors/organizations.errors";
import type { AccessRequestRepository } from "../../domain/repositories/access-request.repository";
import type { OrganizationsDb } from "./organization-db";
import { withUniqueViolationAs } from "./unique-violation";

function toState(row: OrganizationAccessRequest): AccessRequestState {
	return { id: row.id, organizationId: row.organizationId, userId: row.userId, status: row.status, message: row.message, createdAt: epochMs(Number(row.createdAt)) };
}

export class PrismaAccessRequestRepository implements AccessRequestRepository {
	public constructor(private readonly db: OrganizationsDb) {}

	public nextId(): string {
		return newRowId();
	}

	public async hasPending(organizationId: string, userId: string): Promise<boolean> {
		return (await this.db.organizationAccessRequest.findFirst({ where: { organizationId, userId, status: "PENDING" }, select: { id: true } })) !== null;
	}

	public async findInOrganization(organizationId: string, accessRequestId: string): Promise<AccessRequest | null> {
		const row = await this.db.organizationAccessRequest.findFirst({ where: { id: accessRequestId, organizationId } });
		return row === null ? null : AccessRequest.rehydrate(toState(row));
	}

	/** The partial unique index (one PENDING request per organization + user) turns a concurrent duplicate into 409. */
	public async add(request: AccessRequest): Promise<AccessRequestState> {
		const row = await withUniqueViolationAs(
			async () =>
				this.db.organizationAccessRequest.create({
					data: { id: request.id, organizationId: request.organizationId, userId: request.requesterUserId, message: request.message },
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
		const claimed = await this.db.organizationAccessRequest.updateMany({
			where: { id: request.id, organizationId: request.organizationId, status: "PENDING" },
			data: { status: request.currentStatus, reviewedById: review.reviewedByUserId, reviewedAt, updatedAt: reviewedAt },
		});
		if (claimed.count !== 1) {
			throw new AccessRequestAlreadyReviewedError();
		}
	}
}
