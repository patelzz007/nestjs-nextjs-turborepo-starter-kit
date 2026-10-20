/** An upload through the file pipeline, as a comment picture needs it. */
export interface CommentPictureUpload {
	readonly id: string;
	readonly category: string;
	readonly uploadedById: string | null;
	readonly status: string;
	/** The file extension its MIME type is stored under (`png`, `jpg`, …). */
	readonly extension: string;
}

/** The caller's uploads of comment pictures, kept by the files context. */
export interface CommentPictureUploadsPort {
	find(fileId: string): Promise<CommentPictureUpload | null>;
	/** The stored bytes, at most `maxBytes`. */
	readBytes(fileId: string, maxBytes: number): Promise<Buffer>;
	/** Deletes the upload (soft delete through the files context). */
	discard(fileId: string, actorUserId: string): Promise<void>;
}
