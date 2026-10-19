import type { FileCategory } from "@workspace/shared";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";

/** Why a file cannot be deleted yet. Owners report one; the files context answers with the matching documented error. */
export type FileReferenceBlock = "REWARD_IMAGE" | "KYB_EVIDENCE";

/**
 * Which RLS session a deletion of this category runs in. `actor` is the default:
 * the caller's own session, so RLS denies what the caller cannot see. An owner
 * whose binding rows are bypass-only under RLS (catalog's `ProductImage`) says
 * `system-operation`: the deletion then runs as the allowlisted `files.delete`
 * operation, after the files context already authorized the caller.
 */
export type FileDeletionScope = "actor" | "system-operation";

/** The file a guard is asked about. */
export interface FileReferenceSubject {
	readonly fileId: string;
	readonly category: FileCategory;
	readonly organizationId: string | null;
}

/**
 * "May this file be deleted?" — registered by the context that binds files of a
 * category (organizations, catalog, identity, rewards). It runs inside the
 * deletion transaction, after the file row is locked, through the owner's own
 * scope bound to the same transaction.
 */
export interface FileReferenceGuard<TScope> {
	readonly categories: readonly FileCategory[];
	readonly deletionScope: FileDeletionScope;
	blockDelete(subject: FileReferenceSubject, scope: TScope): Promise<FileReferenceBlock | null>;
}

/** A guard closed over its owner's scope factory, so files can run it on any transaction. */
export interface BoundFileReferenceGuard<TDb> {
	readonly categories: readonly FileCategory[];
	readonly deletionScope: FileDeletionScope;
	blockDelete(subject: FileReferenceSubject, db: TDb, events: TransactionalEventCollector): Promise<FileReferenceBlock | null>;
}

export function bindFileReferenceGuard<TScope, TDb>(guard: FileReferenceGuard<TScope>, scopeFactory: ScopeFactory<TScope, TDb>): BoundFileReferenceGuard<TDb> {
	return {
		categories: guard.categories,
		deletionScope: guard.deletionScope,
		async blockDelete(subject: FileReferenceSubject, db: TDb, events: TransactionalEventCollector): Promise<FileReferenceBlock | null> {
			return guard.blockDelete(subject, scopeFactory.create(db, events));
		},
	};
}

/** Which RLS session a deletion of a category runs in — the part of the registry that does not touch a transaction. */
export interface FileDeletionScopePolicy {
	deletionScopeFor(category: FileCategory): FileDeletionScope;
}

/**
 * Every owner's guard. Owners register in their module's `onModuleInit`; files never imports them.
 * `TDb` is the transaction client; infrastructure binds it (Prisma's transaction client).
 */
export class FileReferenceGuardRegistry<TDb> implements FileDeletionScopePolicy {
	private readonly guards: BoundFileReferenceGuard<TDb>[] = [];

	public register(guard: BoundFileReferenceGuard<TDb>): void {
		this.guards.push(guard);
	}

	/** `system-operation` when any guard of the category needs it; otherwise the caller's own session. */
	public deletionScopeFor(category: FileCategory): FileDeletionScope {
		return this.guardsFor(category).some((guard) => guard.deletionScope === "system-operation") ? "system-operation" : "actor";
	}

	/** The first block any guard of the category reports, or null when the file may go. */
	public async blockDelete(subject: FileReferenceSubject, db: TDb, events: TransactionalEventCollector): Promise<FileReferenceBlock | null> {
		for (const guard of this.guardsFor(subject.category)) {
			const block = await guard.blockDelete(subject, db, events);
			if (block !== null) {
				return block;
			}
		}
		return null;
	}

	private guardsFor(category: FileCategory): readonly BoundFileReferenceGuard<TDb>[] {
		return this.guards.filter((guard) => guard.categories.includes(category));
	}
}

/** The reference checks of one deletion transaction (built by the files scope factory over the registry). */
export interface FileReferenceChecks {
	blockDelete(subject: FileReferenceSubject): Promise<FileReferenceBlock | null>;
}
