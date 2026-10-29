import { CaughtValueSchema } from "@workspace/shared";
import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { FileDeleted } from "../../../domain/events/file-deleted.event";
import type { FileObjectStoragePort } from "../../ports/file-object-storage.port";
import { FILE_OBJECT_STORAGE } from "../../ports/files.tokens";
import { StorageTaskDispatcher } from "../../ports/storage-task-dispatcher.port";
import { caughtErrorLogFields } from "../../../../../platform/application/errors/caught-error-log";

/**
 * After a deletion commits (mechanism 2): withdraws every published copy at
 * once (a deleted file is never served publicly, on any provider), hands one
 * CDN purge of all withdrawn keys to the dispatcher, and dispatches the delayed
 * physical delete of each stored copy. The job ids dedupe a repeated dispatch.
 *
 * Best effort by design (§5.6): a failure is logged and not rethrown — the
 * deletion already committed and the request is not failed after the fact.
 */
@EventsHandler(FileDeleted)
export class PurgeDeletedFileObjectsHandler implements IEventHandler<FileDeleted> {
	private readonly logger: Logger = new Logger(PurgeDeletedFileObjectsHandler.name);

	public constructor(
		@Inject(FILE_OBJECT_STORAGE) private readonly storage: FileObjectStoragePort,
		private readonly dispatcher: StorageTaskDispatcher,
	) {}

	public async handle(event: FileDeleted): Promise<void> {
		try {
			await this.purge(event);
		} catch (error) {
			this.logger.error({ event: "files.purge_after_delete_failed", fileId: event.fileId, ...caughtErrorLogFields(CaughtValueSchema.safeParse(error).data) });
		}
	}

	private async purge(event: FileDeleted): Promise<void> {
		const cachedKeys: string[] = [];
		for (const object of event.objects) {
			if (object.published) {
				cachedKeys.push(...(await this.storage.withdrawPublicCopy(event.fileId, object.locator)));
			}
		}
		if (cachedKeys.length > 0) {
			await this.dispatcher.dispatchCdnInvalidation({ fileId: event.fileId, objectKeys: cachedKeys });
		}
		for (const object of event.objects) {
			await this.dispatcher.dispatchPhysicalDelete(
				{ fileId: event.fileId, provider: object.locator.provider, container: object.locator.container, path: object.locator.path },
				object.slot,
			);
		}
	}
}
