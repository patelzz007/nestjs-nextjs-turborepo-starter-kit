// TEST-ONLY: stored-file rows in memory behind the real unit of work, dispatcher and repository semantics.
import type { FileVariant, StoredFile } from "@prisma/client";
import type { PlatformEventId, PlatformEventInput } from "@workspace/shared";

import { systemActor, type ActorContext } from "../../../../../platform/application/actor-context";
import { InTransactionEventRegistry } from "../../../../../platform/application/events/in-transaction-event-registry";
import { IntegrationEventMapperRegistry } from "../../../../../platform/application/events/integration-event-mapper";
import type { TransactionalEventCollector } from "../../../../../platform/application/events/transactional-event-collector";
import type { DomainEvent } from "../../../../../platform/domain/domain-event";
import type { RlsTransactionScope } from "../../../../../platform/infrastructure/unit-of-work/actor-to-rls-context";
import type { AfterCommitPublisher } from "../../../../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { PrismaUnitOfWork, type RlsTransactionRunner } from "../../../../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../../../../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import type { OutboxTransaction } from "../../../../../platform/infrastructure/outbox/platform-outbox.service";
import type { StoredFileAggregate } from "../../../domain/aggregates/stored-file.aggregate";
import type { StoredFileRepository, StoredFileSaveOutcome } from "../../../domain/repositories/stored-file.repository";
import type { FilesScope } from "../../../application/files-scope";
import type { StoredFileRowReader } from "../../adapters/file-processing.adapter";
import { toStoredFileAggregate } from "../../persistence/stored-file.mapper";
import { LIVE_ROW_FIELDS } from "../../../../../platform/infrastructure/persistence/__tests__/base-row-fields";

/** A transaction handle the real dispatcher accepts; nothing here writes an outbox row. */
export interface FakeTransaction extends OutboxTransaction {
	readonly id: number;
}

/** Rows plus renditions, with the Prisma repository's compare-and-set semantics. */
export class InMemoryStoredFileRows {
	public readonly rows = new Map<string, StoredFile>();
	public readonly variants: FileVariant[] = [];

	public constructor(...rows: StoredFile[]) {
		for (const row of rows) {
			this.rows.set(row.id, row);
		}
	}

	public row(fileId: string): StoredFile | undefined {
		return this.rows.get(fileId);
	}

	public add(): Promise<void> {
		return Promise.reject(new Error("not used by the pipeline"));
	}

	public lockForDeletion(fileId: string): Promise<StoredFileAggregate | null> {
		const row = this.rows.get(fileId);
		return Promise.resolve(
			row === undefined || row.isDeleted
				? null
				: toStoredFileAggregate(
						row,
						this.variants.filter((variant) => variant.fileId === fileId && !variant.isDeleted),
					),
		);
	}

	public save(file: StoredFileAggregate): Promise<StoredFileSaveOutcome> {
		const row = this.rows.get(file.id);
		const change = file.pendingChange;
		if (row === undefined || row.isDeleted || row.status !== file.concurrencyToken) {
			return Promise.resolve("lost-race");
		}
		if (change.kind === "verdict") {
			const { record } = change;
			this.rows.set(file.id, {
				...row,
				status: change.outcome,
				scanResult: record.scanResult,
				scanStatus: record.scanStatus ?? row.scanStatus,
				scannedAt: record.scannedAt === null ? row.scannedAt : BigInt(record.scannedAt),
				...(record.promoted === null
					? {}
					: {
							storagePath: record.promoted.storagePath,
							objectRevision: record.promoted.objectRevision,
							objectGeneration: record.promoted.objectRevision,
							publicPath: record.promoted.publicPath,
						}),
			});
			for (const rendition of record.renditions) {
				this.variants.push({
					...LIVE_ROW_FIELDS,
					id: `${file.id}-${rendition.kind}`,
					fileId: file.id,
					kind: rendition.kind,
					mimeType: rendition.mimeType,
					sizeBytes: rendition.sizeBytes,
					width: rendition.width,
					height: rendition.height,
					storageProvider: rendition.locator.provider,
					storageContainer: rendition.locator.container,
					storageBucket: rendition.locator.container,
					storagePath: rendition.locator.path,
					publicPath: rendition.publicPath,
					objectRevision: rendition.objectRevision,
					objectGeneration: rendition.objectRevision,
					isDeleted: false,
					deletedAt: null,
					deletedBy: null,
					createdAt: 0n,
					updatedAt: 0n,
				});
			}
			return Promise.resolve("applied");
		}
		if (change.kind === "deleted") {
			this.rows.set(file.id, { ...row, status: "DELETED", isDeleted: true, deletedBy: change.deletedBy });
			return Promise.resolve("applied");
		}
		return Promise.reject(new Error(`unexpected change ${change.kind}`));
	}

	/** Simulates a delete that commits while the scan is running. */
	public deleteBehindTheScan(fileId: string): void {
		const row = this.rows.get(fileId);
		if (row !== undefined) {
			this.rows.set(fileId, { ...row, status: "DELETED", isDeleted: true });
		}
	}

	public snapshot(): { readonly rows: Map<string, StoredFile>; readonly variants: FileVariant[] } {
		return { rows: new Map(this.rows), variants: [...this.variants] };
	}

	public restore(snapshot: { readonly rows: Map<string, StoredFile>; readonly variants: FileVariant[] }): void {
		this.rows.clear();
		for (const [id, row] of snapshot.rows) {
			this.rows.set(id, row);
		}
		this.variants.splice(0, this.variants.length, ...snapshot.variants);
	}
}

/** The pipeline reads rows and the unit of work reads aggregates from the same store. */
export function rowReader(rows: InMemoryStoredFileRows): StoredFileRowReader {
	return {
		findLive: (fileId: string): Promise<StoredFile | null> => {
			const row = rows.row(fileId);
			return Promise.resolve(row === undefined || row.isDeleted ? null : row);
		},
	};
}

function aggregateRepository(rows: InMemoryStoredFileRows): StoredFileRepository {
	return {
		add: (): Promise<void> => rows.add(),
		findLive: (fileId: string): Promise<StoredFileAggregate | null> => {
			const row = rows.row(fileId);
			return Promise.resolve(row === undefined || row.isDeleted ? null : toStoredFileAggregate(row));
		},
		lockForDeletion: (fileId: string): Promise<StoredFileAggregate | null> => rows.lockForDeletion(fileId),
		save: (file: StoredFileAggregate): Promise<StoredFileSaveOutcome> => rows.save(file),
	};
}

/** Runs each unit of work on a fresh fake transaction; a throw restores the rows (a rollback) and records the scope it ran as. */
class RollbackRunner implements RlsTransactionRunner<FakeTransaction> {
	public readonly scopes: RlsTransactionScope[] = [];
	public rolledBack = 0;
	private next = 0;

	public constructor(private readonly rows: InMemoryStoredFileRows) {}

	public async withRlsContext<TResult>(scope: RlsTransactionScope, handler: (db: FakeTransaction) => Promise<TResult>): Promise<TResult> {
		this.scopes.push(scope);
		const snapshot = this.rows.snapshot();
		this.next += 1;
		const db: FakeTransaction = { id: this.next, outboxEvent: { createMany: (): Promise<{ readonly count: number }> => Promise.resolve({ count: 1 }) } };
		try {
			return await handler(db);
		} catch (error) {
			this.rows.restore(snapshot);
			this.rolledBack += 1;
			throw error;
		}
	}
}

/** Records what is published after commit. */
class RecordingPublisher implements AfterCommitPublisher {
	public readonly published: DomainEvent[] = [];

	public publish(event: DomainEvent): Promise<void> {
		this.published.push(event);
		return Promise.resolve();
	}
}

/** The real PrismaUnitOfWork + TransactionalEventDispatcher over in-memory rows. Register in-transaction handlers on `handlers`. */
export class FilesUnitOfWorkHarness {
	public readonly handlers = new InTransactionEventRegistry<FakeTransaction>();
	public readonly runner: RollbackRunner;
	public readonly publisher = new RecordingPublisher();
	public readonly uow: PrismaUnitOfWork<FilesScope, FakeTransaction>;

	public constructor(rows: InMemoryStoredFileRows) {
		this.runner = new RollbackRunner(rows);
		const outbox = {
			enqueueInTransaction: (_tx: OutboxTransaction, _input: PlatformEventInput): Promise<PlatformEventId> => Promise.reject(new Error("files maps no integration events")),
		};
		const dispatcher = new TransactionalEventDispatcher<FakeTransaction>(this.handlers, new IntegrationEventMapperRegistry(), outbox);
		this.uow = new PrismaUnitOfWork<FilesScope, FakeTransaction>(
			this.runner,
			{
				create: (_db: FakeTransaction, events: TransactionalEventCollector): FilesScope => ({
					storedFiles: aggregateRepository(rows),
					references: { blockDelete: (): Promise<null> => Promise.resolve(null) },
					events,
				}),
			},
			dispatcher,
			this.publisher,
		);
	}
}

export function scanActor(): ActorContext {
	return systemActor("files.scan_verdict.apply", "job", null, "Malware-scan a file in a test", null);
}
