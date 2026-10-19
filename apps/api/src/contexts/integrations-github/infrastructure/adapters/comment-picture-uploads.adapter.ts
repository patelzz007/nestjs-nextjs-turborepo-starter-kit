// Comment-picture uploads kept by the files context (`GITHUB_COMMENT_IMAGE`).
// The files context's public API does not yet export its file service, so this
// adapter is the one place integrations-github reaches it (reported as a
// follow-up for the files migration).

import { Injectable } from "@nestjs/common";
import type { StoredFile } from "@prisma/client";

import { extensionForMimeType } from "../../../../platform/infrastructure/storage/utils/file-path.util";
import { StoredFileAccess } from "../../../files/public-api";
import { githubPictureNotFound } from "../../application/errors/github.errors";
import type { CommentPictureUpload, CommentPictureUploadsPort } from "../../application/ports/comment-picture-uploads.port";

@Injectable()
export class CommentPictureUploadsAdapter implements CommentPictureUploadsPort {
	public constructor(private readonly files: StoredFileAccess) {}

	public async find(fileId: string): Promise<CommentPictureUpload | null> {
		const upload = await this.files.findFile(fileId);
		return upload === null
			? null
			: { id: upload.id, category: upload.category, uploadedById: upload.uploadedById, status: upload.status, extension: extensionForMimeType(upload.mimeType) };
	}

	public async readBytes(fileId: string, maxBytes: number): Promise<Buffer> {
		return this.files.readStoredBytes(await this.require(fileId), maxBytes);
	}

	public async discard(fileId: string, actorUserId: string): Promise<void> {
		await this.files.deleteStoredFile(await this.require(fileId), actorUserId);
	}

	private async require(fileId: string): Promise<StoredFile> {
		const upload = await this.files.findFile(fileId);
		if (upload === null) {
			throw githubPictureNotFound();
		}
		return upload;
	}
}
