import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { FilesScope } from "../../application/files-scope";
import type { FileReferenceGuardRegistry, FileReferenceSubject } from "../../application/ports/file-reference.port";
import { PrismaStoredFileRepository } from "./prisma-stored-file.repository";

/** Builds the files repositories and reference checks bound to the unit-of-work transaction. Never cached. */
export class FilesScopeFactory implements ScopeFactory<FilesScope, Prisma.TransactionClient> {
	public constructor(private readonly guards: FileReferenceGuardRegistry<Prisma.TransactionClient>) {}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): FilesScope {
		return {
			storedFiles: new PrismaStoredFileRepository(db),
			references: { blockDelete: (subject: FileReferenceSubject) => this.guards.blockDelete(subject, db, events) },
			events,
		};
	}
}
