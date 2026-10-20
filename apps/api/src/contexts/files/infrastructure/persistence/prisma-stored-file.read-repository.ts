import type { Prisma } from "@prisma/client";
import type { FileCategory, FileStatus } from "@workspace/shared";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import { FILES_AUTHORIZATION_OPERATION } from "../../../../platform/application/shared-system-operations";
import type { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { AWAITING_VERDICT_STATUSES } from "../../domain/aggregates/stored-file.aggregate";
import type { StoredFileReadPort, StoredFileView } from "../../application/ports/stored-file-read.port";
import { toStoredFileView } from "./stored-file.mapper";

/** Upper bound for one stale-file sweep page (the hourly sweep picks up the rest next time). */
const STALE_SWEEP_PAGE_SIZE = 100;

/** Stored-file reads under the actor's RLS session (`PrismaReadExecutor`): what the actor cannot see does not exist. */
export class PrismaStoredFileReadRepository implements StoredFileReadPort {
	public constructor(
		private readonly reads: PrismaReadExecutor<Prisma.TransactionClient>,
		private readonly publicBaseUrl: string,
	) {}

	public async findLive(actor: ActorContext, fileId: string): Promise<StoredFileView | null> {
		const row = await this.reads.read(actor, (db) => db.storedFile.findFirst({ where: { id: fileId, isDeleted: false } }));
		return row === null ? null : toStoredFileView(row, this.publicBaseUrl);
	}

	public async findOwnUpload(actor: ActorContext, fileId: string): Promise<StoredFileView | null> {
		const uploaderId = actingUserId(actor);
		if (uploaderId === null) {
			return null;
		}
		const row = await this.reads.readAsSystemOperation(FILES_AUTHORIZATION_OPERATION, actor, (db) =>
			db.storedFile.findFirst({ where: { id: fileId, uploadedById: uploaderId, isDeleted: false } }),
		);
		return row === null ? null : toStoredFileView(row, this.publicBaseUrl);
	}

	public async listStalePending(actor: ActorContext, olderThanMs: number): Promise<readonly StoredFileView[]> {
		return this.listOlderThan(actor, ["PENDING"], olderThanMs);
	}

	public async listStaleAwaitingVerdict(actor: ActorContext, olderThanMs: number): Promise<readonly StoredFileView[]> {
		return this.listOlderThan(actor, AWAITING_VERDICT_STATUSES, olderThanMs);
	}

	public async listExpiredStaging(actor: ActorContext, category: FileCategory, olderThanMs: number): Promise<readonly StoredFileView[]> {
		return this.listOlderThan(actor, ["READY"], olderThanMs, category);
	}

	private async listOlderThan(actor: ActorContext, statuses: readonly FileStatus[], olderThanMs: number, category?: FileCategory): Promise<readonly StoredFileView[]> {
		const cutoff = BigInt(Date.now() - olderThanMs);
		const rows = await this.reads.read(actor, (db) =>
			db.storedFile.findMany({
				where: { status: { in: [...statuses] }, isDeleted: false, updatedAt: { lt: cutoff }, ...(category === undefined ? {} : { category }) },
				orderBy: { updatedAt: "asc" },
				take: STALE_SWEEP_PAGE_SIZE,
			}),
		);
		return rows.map((row) => toStoredFileView(row, this.publicBaseUrl));
	}
}
