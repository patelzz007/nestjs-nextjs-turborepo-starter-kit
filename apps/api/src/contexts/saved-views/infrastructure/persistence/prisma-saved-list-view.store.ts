import { Prisma, type SavedListView as SavedListViewRow } from "@prisma/client";
import { epochMs, SavedListKeySchema, type SavedListKey } from "@workspace/shared";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import { readAsPerson, type PersonTransactions } from "../../../../platform/infrastructure/personal-data/read-as-person";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import type { NewSavedListView, SavedListViewRecord, SavedListViewStore, SaveViewOutcome } from "../../application/ports/saved-list-view.store";

const SHARED_READ_OPERATION: SystemOperationName = "saved_views.shared.read";
/** Postgres' unique_violation: the partial unique on (userId, listKey, name) caught a race the check didn't. */
const UNIQUE_VIOLATION = "P2002";

export interface SavedViewTransactions extends PersonTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, handler: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

function toRecord(row: SavedListViewRow, ownerName: string | null): SavedListViewRecord {
	return {
		id: row.id,
		userId: row.userId,
		listKey: SavedListKeySchema.parse(row.listKey),
		name: row.name,
		query: row.query,
		shared: row.shared,
		ownerName,
		createdAt: epochMs(Number(row.createdAt)),
	};
}

function ownerIdOf(actor: ActorContext): string {
	const id = actingUserId(actor);
	if (id === null) {
		throw new Error("Saved views belong to a signed-in person");
	}
	return id;
}

/** `SavedListView` over Prisma (enhancement 5.10). */
export class PrismaSavedListViewStore implements SavedListViewStore {
	public constructor(private readonly transactions: SavedViewTransactions) {}

	public own(actor: ActorContext, listKey: SavedListKey): Promise<readonly SavedListViewRecord[]> {
		return readAsPerson(this.transactions, actor, async (tx) =>
			(await tx.savedListView.findMany({ where: { userId: ownerIdOf(actor), listKey, isDeleted: false } })).map((row) => toRecord(row, null)),
		);
	}

	public sharedByOthers(actor: ActorContext, listKey: SavedListKey): Promise<readonly SavedListViewRecord[]> {
		const userId = ownerIdOf(actor);
		return this.transactions.withSystemOperation(
			{ operation: SHARED_READ_OPERATION, reason: "Saved views other staff shared on this list", actorUserId: userId },
			async (tx) => {
				const rows = await tx.savedListView.findMany({ where: { listKey, shared: true, isDeleted: false, NOT: { userId } } });
				const owners = await tx.user.findMany({ where: { id: { in: [...new Set(rows.map((row) => row.userId))] } }, select: { id: true, fullName: true } });
				const names = new Map(owners.map((owner): [string, string] => [owner.id, owner.fullName]));
				return rows.map((row) => toRecord(row, names.get(row.userId) ?? null));
			},
		);
	}

	public async save(actor: ActorContext, view: NewSavedListView, limit: number): Promise<SaveViewOutcome> {
		const userId = ownerIdOf(actor);
		try {
			return await readAsPerson(this.transactions, actor, async (tx): Promise<SaveViewOutcome> => {
				const mine = { userId, listKey: view.listKey, isDeleted: false };
				if ((await tx.savedListView.count({ where: { ...mine, name: view.name } })) > 0) {
					return { kind: "name-taken" };
				}
				if ((await tx.savedListView.count({ where: mine })) >= limit) {
					return { kind: "full" };
				}
				const row = await tx.savedListView.create({
					data: { userId, listKey: view.listKey, name: view.name, query: view.query, shared: view.shared, createdBy: userId, updatedBy: userId },
				});
				return { kind: "saved", view: toRecord(row, null) };
			});
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
				return { kind: "name-taken" };
			}
			throw error;
		}
	}

	public remove(actor: ActorContext, viewId: string, at: number): Promise<boolean> {
		const userId = ownerIdOf(actor);
		return readAsPerson(this.transactions, actor, async (tx) => {
			const removed = await tx.savedListView.updateMany({
				where: { id: viewId, userId, isDeleted: false },
				data: { isDeleted: true, deletedAt: BigInt(at), deletedBy: userId, updatedAt: BigInt(at), updatedBy: userId },
			});
			return removed.count === 1;
		});
	}
}
