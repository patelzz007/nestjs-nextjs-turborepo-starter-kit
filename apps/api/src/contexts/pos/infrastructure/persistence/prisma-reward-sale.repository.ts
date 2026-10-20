import type { Prisma } from "@prisma/client";
import { epochMs, SaleCurrencySchema } from "@workspace/shared";

import { isUniqueViolationOf } from "../../../../platform/infrastructure/persistence/unique-violation";
import type { RewardSale, SaleLine } from "../../domain/aggregates/reward-sale.aggregate";
import { SaleIdempotencyKeyTakenError } from "../../domain/errors/pos.errors";
import type { RewardSaleRepository, StoredSale, StoredSaleLine } from "../../domain/repositories/pos.repositories";
import { minorUnitsToNumber } from "../../../../platform/infrastructure/persistence/minor-units";

/** The `("tenantId", "idempotencyKey")` unique index of `RewardSale`: a concurrent request with the same key inserted first. */
export const SALE_IDEMPOTENCY_KEY_INDEX = "RewardSale_tenantId_idempotencyKey_key";

const STORED_SALE_SELECT = {
	id: true,
	billTotalMinor: true,
	currency: true,
	paidAt: true,
	idempotencyKey: true,
	requestHash: true,
	redemptions: { where: { isDeleted: false }, orderBy: { id: "asc" }, select: { id: true, claimId: true, redemptionMethod: true } },
} satisfies Prisma.RewardSaleSelect;

type StoredSaleRow = Prisma.RewardSaleGetPayload<{ select: typeof STORED_SALE_SELECT }>;

function toStoredSale(row: StoredSaleRow): StoredSale {
	return {
		id: row.id,
		billTotalMinor: minorUnitsToNumber(row.billTotalMinor),
		currency: SaleCurrencySchema.parse(row.currency),
		paidAt: epochMs(Number(row.paidAt)),
		idempotencyKey: row.idempotencyKey,
		requestHash: row.requestHash,
		lines: row.redemptions.map((redemption): StoredSaleLine => ({ redemptionId: redemption.id, claimId: redemption.claimId, method: redemption.redemptionMethod })),
	};
}

/** Paid bills (`RewardSale`) and their redemption rows on one unit-of-work transaction. */
export class PrismaRewardSaleRepository implements RewardSaleRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async findByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<StoredSale | null> {
		const row = await this.db.rewardSale.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } }, select: STORED_SALE_SELECT });
		return row === null ? null : toStoredSale(row);
	}

	public async add(sale: RewardSale): Promise<StoredSale> {
		const state = sale.snapshot();
		try {
			await this.db.rewardSale.create({
				data: {
					id: state.id,
					tenantId: state.point.tenantId,
					locationId: state.point.locationId,
					userId: state.customerUserId,
					terminalId: state.point.terminalId,
					apiKeyId: state.point.apiKeyId,
					billTotalMinor: state.billTotalMinor,
					currency: state.currency,
					idempotencyKey: state.idempotencyKey,
					requestHash: state.requestHash,
					paidAt: state.paidAt,
				},
				select: { id: true },
			});
		} catch (error) {
			if (error instanceof Error && isUniqueViolationOf(error, SALE_IDEMPOTENCY_KEY_INDEX)) {
				throw new SaleIdempotencyKeyTakenError(state.idempotencyKey);
			}
			throw error;
		}
		await this.db.rewardRedemption.createMany({
			data: state.lines.map((line: SaleLine) => ({
				claimId: line.claimId,
				tenantId: state.point.tenantId,
				locationId: state.point.locationId,
				userId: state.customerUserId,
				terminalId: state.point.terminalId,
				redemptionMethod: line.method,
				saleId: state.id,
				redeemedAt: state.paidAt,
			})),
		});
		const stored = await this.db.rewardSale.findUniqueOrThrow({ where: { id: state.id }, select: STORED_SALE_SELECT });
		return toStoredSale(stored);
	}
}
