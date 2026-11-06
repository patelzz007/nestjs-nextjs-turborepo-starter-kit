import type { Prisma } from "@prisma/client";
import { NotificationAttachmentMimeTypeSchema, NotificationAttachmentSchema, type NotificationAttachment, type NotificationAttachmentResponse } from "@workspace/shared";

import type { PublicUrlResolve } from "../../../../config/public-url.resolver";

/** The widest copy a list, an email or a push shows: sharp on a phone, and well under FCM's 1 MB picture limit. */
const PREVIEW_MAX_WIDTH = 1280;

/** What an attachment needs of a stored file, with its live renditions, smallest first. */
export const NOTIFICATION_ATTACHMENT_FILE_SELECT = {
	originalName: true,
	mimeType: true,
	sizeBytes: true,
	imageWidth: true,
	imageHeight: true,
	publicPath: true,
	variants: { where: { isDeleted: false }, orderBy: { width: "asc" }, select: { width: true, publicPath: true } },
} satisfies Prisma.StoredFileSelect;

export type NotificationAttachmentFile = Prisma.StoredFileGetPayload<{ select: typeof NOTIFICATION_ATTACHMENT_FILE_SELECT }>;

/** A stored attachment; a value that no longer parses is treated as absent, like a corrupt rich body. */
export function parseStoredAttachment(value: Prisma.JsonValue | null): NotificationAttachment | null {
	const parsed = NotificationAttachmentSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

/** A stored attachment as a client opens it: its paths joined to the API's address now. */
export function attachmentResponseOf(stored: NotificationAttachment | null, resolve: PublicUrlResolve): NotificationAttachmentResponse | null {
	if (stored === null) {
		return null;
	}
	const url = resolve(stored.path);
	if (url === null) {
		return null;
	}
	return {
		name: stored.name,
		mimeType: stored.mimeType,
		sizeBytes: stored.sizeBytes,
		width: stored.width,
		height: stored.height,
		url,
		previewUrl: resolve(stored.previewPath),
	};
}

/** A public file as a notification's attachment; null when it is not public or not a type a notification carries. */
export function notificationAttachmentOf(file: NotificationAttachmentFile): NotificationAttachment | null {
	const mimeType = NotificationAttachmentMimeTypeSchema.safeParse(file.mimeType);
	if (file.publicPath === null || !mimeType.success) {
		return null;
	}
	const preview = file.variants.filter((variant) => variant.publicPath !== null && variant.width !== null && variant.width <= PREVIEW_MAX_WIDTH).at(-1);
	return {
		name: file.originalName,
		mimeType: mimeType.data,
		sizeBytes: file.sizeBytes,
		width: file.imageWidth,
		height: file.imageHeight,
		path: file.publicPath,
		previewPath: preview?.publicPath ?? null,
	};
}
