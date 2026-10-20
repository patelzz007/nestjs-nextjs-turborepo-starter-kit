import { ConcurrentModificationError } from "../../../../platform/infrastructure/persistence/persistence.errors";
import { MerchantVerification } from "../../domain/aggregates/merchant-verification.aggregate";
import type { MerchantVerificationRepository } from "../../domain/repositories/merchant-verification.repository";
import type { TenantsDb } from "./tenant-db";
import { newRowId } from "@workspace/shared";

export class PrismaMerchantVerificationRepository implements MerchantVerificationRepository {
	public constructor(private readonly db: TenantsDb) {}

	public async getForUpdate(tenantId: string): Promise<MerchantVerification | null> {
		// Row lock first: a submission, a scan verdict and an admin decision on one review serialize.
		await this.db.$queryRaw`SELECT 1 FROM "TenantMerchantProfile" WHERE "tenantId" = ${tenantId} FOR UPDATE`;
		const profile = await this.db.tenantMerchantProfile.findFirst({
			where: { tenantId, tenant: { isDeleted: false } },
			select: { tenantId: true, kybStatus: true },
		});
		return profile === null ? null : MerchantVerification.rehydrate(profile);
	}

	public async activeEvidenceFileIds(tenantId: string): Promise<readonly string[]> {
		const rows = await this.db.tenantKybFile.findMany({
			where: { tenantId, isActive: true, isDeleted: false },
			select: { fileId: true },
			orderBy: { createdAt: "asc" },
		});
		return rows.map((row) => row.fileId);
	}

	public async save(verification: MerchantVerification): Promise<void> {
		const application = verification.pendingApplication;
		const decisionFields = verification.pendingDecisionKybFields;
		const statusChanged = verification.currentStatus !== verification.concurrencyToken;
		const now = BigInt(Date.now());

		if (statusChanged || application !== null || decisionFields !== null) {
			const kybFields = application?.kybFields ?? decisionFields;
			const updated = await this.db.tenantMerchantProfile.updateMany({
				where: { tenantId: verification.tenantId, kybStatus: verification.concurrencyToken },
				data: {
					kybStatus: verification.currentStatus,
					...(application === null
						? {}
						: {
								legalName: application.legalName,
								addressText: application.addressText,
								contactPhone: application.contactPhone,
								...(application.category === null ? {} : { category: application.category }),
							}),
					...(kybFields === null ? {} : { kybFields: { ...kybFields } }),
					updatedAt: now,
				},
			});
			if (updated.count !== 1) {
				throw new ConcurrentModificationError(verification.tenantId);
			}
		}

		const evidence = verification.pendingEvidenceFileIds;
		if (evidence !== null) {
			// Previous evidence links are retired (kept as review history), never deleted.
			await this.db.tenantKybFile.updateMany({
				where: { tenantId: verification.tenantId, isActive: true, isDeleted: false },
				data: { isActive: false, updatedAt: now },
			});
			const submissionId = newRowId();
			for (const fileId of evidence) {
				await this.db.tenantKybFile.create({ data: { id: newRowId(), tenantId: verification.tenantId, fileId, submissionId, isActive: true } });
			}
		}
	}
}
