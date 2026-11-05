import type { Prisma } from "@prisma/client";
import { PaymentCurrencySchema, type PaginatedServiceResult, type PaymentIntentListQuery, type PaymentProviderName } from "@workspace/shared";

import { PaymentIntent, type PaymentIntentState } from "../../domain/aggregates/payment-intent.aggregate";
import type { NewPaymentEvent, OpenPaymentRef, PaymentIntentRepository } from "../../domain/repositories/payment-intent.repository";
import { listTenantPayments } from "./payment-intent-list.reader";

type PaymentIntentRow = Prisma.PaymentIntentGetPayload<Prisma.PaymentIntentDefaultArgs>;

const LIVE = { isDeleted: false } satisfies { isDeleted: boolean };

export function toPaymentIntent(row: PaymentIntentRow): PaymentIntent {
	const state: PaymentIntentState = {
		id: row.id,
		tenantId: row.tenantId,
		provider: row.provider,
		status: row.status,
		amountMinor: row.amountMinor,
		currency: PaymentCurrencySchema.parse(row.currency),
		description: row.description,
		payerName: row.payerName,
		payerEmail: row.payerEmail,
		idempotencyKey: row.idempotencyKey,
		providerPaymentId: row.providerPaymentId,
		checkoutUrl: row.checkoutUrl,
		paidAt: row.paidAt === null ? null : Number(row.paidAt),
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	};
	return PaymentIntent.restore(state);
}

/** `PaymentIntentRepository` on one transaction (ADR 020). Reads skip soft-deleted payments. */
export class PrismaPaymentIntentRepository implements PaymentIntentRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async findById(tenantId: string, id: string): Promise<PaymentIntent | null> {
		const row = await this.db.paymentIntent.findFirst({ where: { id, tenantId, ...LIVE } });
		return row === null ? null : toPaymentIntent(row);
	}

	public list(tenantId: string, query: PaymentIntentListQuery): Promise<PaginatedServiceResult<PaymentIntent>> {
		return listTenantPayments(this.db, tenantId, query);
	}

	public async findByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<PaymentIntent | null> {
		const row = await this.db.paymentIntent.findFirst({ where: { tenantId, idempotencyKey } });
		return row === null ? null : toPaymentIntent(row);
	}

	public async findByProviderPaymentId(provider: PaymentProviderName, providerPaymentId: string): Promise<PaymentIntent | null> {
		const row = await this.db.paymentIntent.findFirst({ where: { provider, providerPaymentId, ...LIVE } });
		return row === null ? null : toPaymentIntent(row);
	}

	public async insert(intent: PaymentIntent, actor: string): Promise<void> {
		const s = intent.snapshot;
		await this.db.paymentIntent.create({
			data: {
				id: s.id,
				tenantId: s.tenantId,
				provider: s.provider,
				status: s.status,
				amountMinor: s.amountMinor,
				currency: s.currency,
				description: s.description,
				payerName: s.payerName,
				payerEmail: s.payerEmail,
				idempotencyKey: s.idempotencyKey,
				providerPaymentId: s.providerPaymentId,
				checkoutUrl: s.checkoutUrl,
				paidAt: s.paidAt === null ? null : BigInt(s.paidAt),
				createdAt: BigInt(s.createdAt),
				createdBy: actor,
				updatedAt: BigInt(s.updatedAt),
				updatedBy: actor,
			},
		});
	}

	public async update(intent: PaymentIntent, actor: string): Promise<void> {
		const s = intent.snapshot;
		await this.db.paymentIntent.update({
			where: { id: s.id },
			data: {
				status: s.status,
				providerPaymentId: s.providerPaymentId,
				checkoutUrl: s.checkoutUrl,
				paidAt: s.paidAt === null ? null : BigInt(s.paidAt),
				updatedAt: BigInt(s.updatedAt),
				updatedBy: actor,
			},
		});
	}

	public async appendEvent(event: NewPaymentEvent): Promise<void> {
		await this.db.paymentEvent.create({
			data: {
				id: event.id,
				tenantId: event.tenantId,
				paymentIntentId: event.paymentIntentId,
				source: event.source,
				providerStatus: event.providerStatus,
				status: event.status,
				effect: event.effect,
				amountMinor: event.amountMinor,
				occurredAt: BigInt(event.occurredAt),
				createdAt: BigInt(event.occurredAt),
				createdBy: event.actor,
				updatedAt: BigInt(event.occurredAt),
				updatedBy: event.actor,
			},
		});
	}

	public async listOpenTouchedBetween(from: number, to: number, limit: number): Promise<readonly OpenPaymentRef[]> {
		const rows = await this.db.paymentIntent.findMany({
			where: { ...LIVE, status: { in: ["PENDING", "FAILED"] }, providerPaymentId: { not: null }, updatedAt: { gte: BigInt(from), lte: BigInt(to) } },
			orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
			take: limit,
			select: { id: true, provider: true, providerPaymentId: true },
		});
		return rows.flatMap((row): OpenPaymentRef[] => (row.providerPaymentId === null ? [] : [{ id: row.id, provider: row.provider, providerPaymentId: row.providerPaymentId }]));
	}
}
