import type { StoredFileAccess } from "../../../files/public-api";
import type { KanbanAttachmentFilesPort, KanbanFileDownloadLink } from "../../application/ports/kanban-attachment-files.port";

/**
 * The board's downloads and removals over the files context's published access.
 * Attachments are READY before they can be attached, so a file missing here means
 * it was deleted meanwhile, not that processing is pending.
 */
export class StoredFileKanbanAttachmentFiles implements KanbanAttachmentFilesPort {
	public constructor(private readonly files: StoredFileAccess) {}

	public async downloadLink(fileId: string): Promise<KanbanFileDownloadLink | null> {
		const file = await this.files.findFile(fileId);
		if (file === null) {
			return null;
		}
		const download = await this.files.createDownloadUrl(file, "attachment");
		if (download.downloadUrl === null || download.expiresAt === null) {
			return null;
		}
		return { url: download.downloadUrl, expiresAt: download.expiresAt };
	}

	public async deleteFile(fileId: string, actorUserId: string): Promise<boolean> {
		const file = await this.files.findFile(fileId);
		if (file === null) {
			return false;
		}
		await this.files.deleteStoredFile(file, actorUserId);
		return true;
	}
}
