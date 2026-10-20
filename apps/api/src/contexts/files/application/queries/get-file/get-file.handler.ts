import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { FileDetailResponse } from "@workspace/shared";

import { fileNotFound } from "../../file-not-found";
import { FileCategoryAccessRegistry } from "../../ports/file-category-access.port";
import { STORED_FILE_READS } from "../../ports/files.tokens";
import type { StoredFileReadPort } from "../../ports/stored-file-read.port";
import { GetFileQuery } from "./get-file.query";

@QueryHandler(GetFileQuery)
export class GetFileHandler implements IQueryHandler<GetFileQuery, FileDetailResponse> {
	public constructor(
		@Inject(STORED_FILE_READS) private readonly reads: StoredFileReadPort,
		private readonly access: FileCategoryAccessRegistry,
	) {}

	public async execute(query: GetFileQuery): Promise<FileDetailResponse> {
		const file = await this.reads.findLive(query.actor, query.fileId);
		if (file === null) {
			throw fileNotFound();
		}
		await this.access.assertCanAct(query.actor, file, "read");
		return { file: file.record };
	}
}
