/** The board's attachment rows (`KanbanTaskAttachment`), bound to one files transaction. */
export interface KanbanAttachmentBindings {
	/** Soft-deletes every live attachment row of a deleted file. */
	releaseFile(fileId: string, deletedBy: string, deletedAt: number): Promise<void>;
}

/** What the board's file reactions can touch inside the files transaction. */
export interface KanbanAttachmentFileScope {
	readonly attachmentBindings: KanbanAttachmentBindings;
}
