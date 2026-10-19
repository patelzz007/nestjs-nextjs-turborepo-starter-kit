import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { FileDownloadResponse } from "@workspace/shared";

import { fileNotFound } from "../../file-not-found";
import { FileCategoryAccessRegistry } from "../../ports/file-category-access.port";
import type { FileObjectStoragePort } from "../../ports/file-object-storage.port";
import { FILE_OBJECT_STORAGE, STORED_FILE_READS } from "../../ports/files.tokens";
import type { StoredFileReadPort } from "../../ports/stored-file-read.port";
import { GetFileDownloadUrlQuery } from "./get-file-download-url.query";

/** Signing a URL changes no state: it is a query. */
@QueryHandler(GetFileDownloadUrlQuery)
export class GetFileDownloadUrlHandler implements IQueryHandler<GetFileDownloadUrlQuery, FileDownloadResponse> {
	public constructor(
		@Inject(STORED_FILE_READS) private readonly reads: StoredFileReadPort,
		private readonly access: FileCategoryAccessRegistry,
		@Inject(FILE_OBJECT_STORAGE) private readonly storage: FileObjectStoragePort,
	) {}

	public async execute(query: GetFileDownloadUrlQuery): Promise<FileDownloadResponse> {
		const file = await this.reads.findLive(query.actor, query.fileId);
		if (file === null) {
			throw fileNotFound();
		}
		await this.access.assertCanAct(query.actor, file, "read");
		return this.storage.createDownloadUrl(file, "inline");
	}
}
