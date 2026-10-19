import type { TransactionalEventCollector } from "../../../platform/application/events/transactional-event-collector";
import type { StoredFileRepository } from "../domain/repositories/stored-file.repository";
import type { FileReferenceChecks } from "./ports/file-reference.port";

/** Everything one files transaction can touch. Repositories and checks are bound to that transaction. */
export interface FilesScope {
	readonly storedFiles: StoredFileRepository;
	readonly references: FileReferenceChecks;
	readonly events: TransactionalEventCollector;
}
