import type { DocumentMimeType, KanbanAttachmentKind } from "@workspace/shared";

/** What a card counts a file as: a PDF is a document, an image an attachment. Decided from the stored type, never from the client. */
export function kanbanAttachmentKindFor(mimeType: DocumentMimeType): KanbanAttachmentKind {
	return mimeType === "application/pdf" ? "DOCUMENT" : "ATTACHMENT";
}
