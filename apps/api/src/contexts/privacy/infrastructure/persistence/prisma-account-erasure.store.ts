import { Prisma, type AccountErasure } from "@prisma/client";
import { z } from "zod";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import { ACCOUNT_ERASE_OPERATION, ACCOUNT_ERASURE_REQUEST_OPERATION } from "../../../../platform/application/personal-data/personal-data-erasure.registry";
import { readAsPerson, type PersonTransactions } from "../../../../platform/infrastructure/personal-data/read-as-person";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import type { AccountErasureRecord, AccountErasureStore, NewAccountErasure } from "../../application/ports/account-erasure.store";

const REQUEST_OPERATION = ACCOUNT_ERASURE_REQUEST_OPERATION;
const ERASE_OPERATION = ACCOUNT_ERASE_OPERATION;
const MaskRowSchema = z.object({ masked: z.bigint() });

/** The transaction methods the store needs. */
export interface ErasureTransactions extends PersonTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, handler: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

function toRecord(row: AccountErasure): AccountErasureRecord {
	return {
		id: row.id,
		userId: row.userId,
		status: row.status,
		requestedByUserId: row.requestedByUserId,
		reason: row.reason,
		requestedAt: Number(row.requestedAt),
		scheduledFor: Number(row.scheduledFor),
		cancelledAt: row.cancelledAt === null ? null : Number(row.cancelledAt),
		cancelledByUserId: row.cancelledByUserId,
		completedAt: row.completedAt === null ? null : Number(row.completedAt),
	};
}

/** `AccountErasure` and the masking function, over Prisma (ADR 077). */
export class PrismaAccountErasureStore implements AccountErasureStore {
	public constructor(private readonly transactions: ErasureTransactions) {}

	public latestOwn(person: ActorContext, userId: string): Promise<AccountErasureRecord | null> {
		return readAsPerson(this.transactions, person, async (tx) => {
			const row =
				(await tx.accountErasure.findFirst({ where: { userId, status: "PENDING", isDeleted: false } })) ??
				(await tx.accountErasure.findFirst({ where: { userId, isDeleted: false }, orderBy: { requestedAt: "desc" } }));
			return row === null ? null : toRecord(row);
		});
	}

	public latestOf(actor: ActorContext, userId: string): Promise<AccountErasureRecord | null> {
		return this.run(actor, REQUEST_OPERATION, "Erasure: support reads an account's request", async (tx) => {
			const row =
				(await tx.accountErasure.findFirst({ where: { userId, status: "PENDING", isDeleted: false } })) ??
				(await tx.accountErasure.findFirst({ where: { userId, isDeleted: false }, orderBy: { requestedAt: "desc" } }));
			return row === null ? null : toRecord(row);
		});
	}

	public findOpen(actor: ActorContext, userId: string): Promise<AccountErasureRecord | null> {
		return this.run(actor, REQUEST_OPERATION, "Erasure: look for an open request", async (tx) => {
			const row = await tx.accountErasure.findFirst({ where: { userId, status: "PENDING", isDeleted: false } });
			return row === null ? null : toRecord(row);
		});
	}

	public create(actor: ActorContext, request: NewAccountErasure): Promise<AccountErasureRecord> {
		return this.run(actor, REQUEST_OPERATION, "Erasure: record the request", async (tx) =>
			toRecord(
				await tx.accountErasure.create({
					data: { ...request, requestedAt: BigInt(request.requestedAt), scheduledFor: BigInt(request.scheduledFor), status: "PENDING" },
				}),
			),
		);
	}

	public cancel(actor: ActorContext, id: string, cancelledByUserId: string, at: number): Promise<AccountErasureRecord> {
		return this.run(actor, REQUEST_OPERATION, "Erasure: cancel the request", async (tx) =>
			toRecord(await tx.accountErasure.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: BigInt(at), cancelledByUserId } })),
		);
	}

	public due(actor: ActorContext, now: number, limit: number): Promise<readonly AccountErasureRecord[]> {
		return this.run(actor, ERASE_OPERATION, "Erasure: find requests past their grace period", async (tx) =>
			(
				await tx.accountErasure.findMany({ where: { status: "PENDING", isDeleted: false, scheduledFor: { lte: BigInt(now) } }, orderBy: { scheduledFor: "asc" }, take: limit })
			).map(toRecord),
		);
	}

	public maskInKeptRecords(actor: ActorContext, userId: string, email: string): Promise<number> {
		return this.run(actor, ERASE_OPERATION, "Erasure: mask the person in kept audit and security records", async (tx) => {
			const rows = await tx.$queryRaw(Prisma.sql`SELECT public.app_mask_erased_person(${userId}, ${email}) AS masked`);
			const [row] = z.array(MaskRowSchema).length(1).parse(rows);
			return Number(MaskRowSchema.parse(row).masked);
		});
	}

	public complete(actor: ActorContext, id: string, at: number): Promise<AccountErasureRecord> {
		return this.run(actor, ERASE_OPERATION, "Erasure: mark the request completed", async (tx) =>
			toRecord(await tx.accountErasure.update({ where: { id }, data: { status: "COMPLETED", completedAt: BigInt(at) } })),
		);
	}

	private run<TResult>(actor: ActorContext, operation: SystemOperationName, reason: string, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		return this.transactions.withSystemOperation({ operation, reason, actorUserId: actingUserId(actor) }, work);
	}
}
