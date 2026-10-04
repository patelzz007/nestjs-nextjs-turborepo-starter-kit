import { DEFAULT_SALE_CURRENCY } from "@workspace/shared";

import { sha256Hex } from "../../src/common/crypto/sha256";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";

export interface SeedCheckoutInput {
	/** Stable key → deterministic sale / redemption / audit ids and idempotency key. */
	readonly key: string;
	readonly organizationId: string;
	readonly locationId: string;
	readonly terminalId: string;
	readonly apiKeyId: string;
	readonly userId: string;
	readonly claimId: string;
	readonly billTotalMinor: number;
	readonly paidAt: number;
}

/**
 * One paid POS bill redeeming one claim — the rows `POST /redemptions/checkout`
 * writes: the sale (idempotency key + request hash), its redemption (every
 * redemption belongs to a sale) and the `merchant.checkout` audit row. The
 * audit row has a deterministic id and is upserted, so re-seeding never
 * duplicates or deletes audit history.
 */
export async function seedCheckout(input: SeedCheckoutInput): Promise<string> {
	const saleId = deterministicUuid("reward-seed-sale", input.key);
	const sale = await prisma.rewardSale.create({
		data: {
			id: saleId,
			organizationId: input.organizationId,
			locationId: input.locationId,
			userId: input.userId,
			terminalId: input.terminalId,
			apiKeyId: input.apiKeyId,
			billTotalMinor: input.billTotalMinor,
			currency: DEFAULT_SALE_CURRENCY,
			idempotencyKey: deterministicUuid("reward-seed-checkout-key", input.key),
			requestHash: sha256Hex(`seed-checkout:${input.key}`),
			paidAt: input.paidAt,
		},
	});
	await prisma.rewardRedemption.create({
		data: {
			id: deterministicUuid("reward-seed-redemption", input.key),
			claimId: input.claimId,
			organizationId: input.organizationId,
			locationId: input.locationId,
			userId: input.userId,
			terminalId: input.terminalId,
			redemptionMethod: "SCAN",
			saleId: sale.id,
			redeemedAt: input.paidAt,
		},
	});
	const metadata = {
		saleId,
		claimIds: [input.claimId],
		terminalId: input.terminalId,
		apiKeyId: input.apiKeyId,
		locationId: input.locationId,
		billTotalMinor: input.billTotalMinor,
		currency: DEFAULT_SALE_CURRENCY,
	};
	const auditId = deterministicUuid("reward-seed-audit-checkout", input.key);
	await prisma.rewardAuditLog.upsert({
		where: { id: auditId },
		create: { id: auditId, organizationId: input.organizationId, action: "merchant.checkout", metadata, createdAt: input.paidAt },
		update: { metadata },
	});
	return saleId;
}
