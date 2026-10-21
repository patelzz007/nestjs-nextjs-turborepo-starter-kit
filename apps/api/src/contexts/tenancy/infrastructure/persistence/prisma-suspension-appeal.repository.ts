import type { Prisma } from "@prisma/client";
import { epochMs, newRowId } from "@workspace/shared";

import { SuspensionAppeal } from "../../domain/aggregates/suspension-appeal.aggregate";
import { TenantAppealNotPendingError, TenantAppealPendingError } from "../../domain/errors/tenants.errors";
import type { SuspensionAppealRepository } from "../../domain/repositories/suspension-appeal.repository";
import type { TenantsDb } from "./tenant-db";
import { withUniqueViolationAs } from "./unique-violation";

const APPEAL_SELECT = {
	id: true,
	tenantId: true,
	submittedByUserId: true,
	message: true,
	status: true,
	reviewedByUserId: true,
	reviewedAt: true,
	reviewNote: true,
} satisfies Prisma.TenantSuspensionAppealSelect;

export class PrismaSuspensionAppealRepository implements SuspensionAppealRepository {
	public constructor(private readonly db: TenantsDb) {}

	public nextId(): string {
		return newRowId();
	}

	public async add(appeal: SuspensionAppeal): Promise<void> {
		await withUniqueViolationAs(
			async () =>
				this.db.tenantSuspensionAppeal.create({
					data: { id: appeal.id, tenantId: appeal.tenantId, submittedByUserId: appeal.submittedByUserId, message: appeal.message, status: "PENDING" },
					select: { id: true },
				}),
			() => new TenantAppealPendingError(),
		);
	}

	public async findPendingForUpdate(tenantId: string): Promise<SuspensionAppeal | null> {
		await this.db.$queryRaw`SELECT id FROM "TenantSuspensionAppeal" WHERE "tenantId" = ${tenantId} AND status = 'PENDING' AND "isDeleted" = false FOR UPDATE`;
		return this.load({ tenantId, status: "PENDING", isDeleted: false });
	}

	public async findForUpdate(tenantId: string, appealId: string): Promise<SuspensionAppeal | null> {
		await this.db.$queryRaw`SELECT id FROM "TenantSuspensionAppeal" WHERE id = ${appealId} AND "tenantId" = ${tenantId} AND "isDeleted" = false FOR UPDATE`;
		return this.load({ id: appealId, tenantId, isDeleted: false });
	}

	public async save(appeal: SuspensionAppeal): Promise<void> {
		const review = appeal.review;
		if (review === null) {
			return;
		}
		const written = await this.db.tenantSuspensionAppeal.updateMany({
			where: { id: appeal.id, tenantId: appeal.tenantId, status: "PENDING", isDeleted: false },
			data: { status: review.status, reviewedByUserId: review.reviewedByUserId, reviewedAt: review.reviewedAt, reviewNote: review.reviewNote, updatedAt: review.reviewedAt },
		});
		if (written.count !== 1) {
			throw new TenantAppealNotPendingError();
		}
	}

	private async load(where: { readonly id?: string; readonly tenantId: string; readonly status?: "PENDING"; readonly isDeleted: false }): Promise<SuspensionAppeal | null> {
		const row = await this.db.tenantSuspensionAppeal.findFirst({ where: { ...where }, select: APPEAL_SELECT });
		return row === null ? null : SuspensionAppeal.rehydrate({ ...row, reviewedAt: row.reviewedAt === null ? null : epochMs(Number(row.reviewedAt)) });
	}
}
