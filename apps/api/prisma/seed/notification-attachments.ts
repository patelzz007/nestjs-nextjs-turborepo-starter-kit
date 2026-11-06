// ============================================
// prisma/seed/notification-attachments.ts — notices with a 4K photo or a PDF attached
// ============================================
// The photos are the seeded 4K reward covers (public, with renditions, credited in assets/reward-images/CREDITS.md);
// the PDF is a `NOTIFICATION_DOCUMENT`. Each notice lands in a person's inbox the way the fan-out leaves it.

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { NotificationSurface } from "@prisma/client";
import type { NotificationAttachment } from "@workspace/shared";

import { SHOWCASE_MESSAGES, SHOWCASE_PHOTO_COUNT, SHOWCASE_PHOTO_MIN_WIDTH } from "../../src/contexts/notifications/application/services/demo-notifications";
import { SHOWCASE_NOTIFICATION } from "../../src/contexts/notifications/domain/catalog/types/platform.types";
import { NOTIFICATION_ATTACHMENT_FILE_SELECT, notificationAttachmentOf } from "../../src/contexts/notifications/infrastructure/persistence/notification-attachment.mapper";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { seedInboxNotification } from "./inbox-notifications";
import { createSeedFileWriter } from "./stored-file-seed-writer";

const STATEMENT_ID: string = deterministicUuid("notification-attachments", "october-statement");
const STATEMENT = join(dirname(fileURLToPath(import.meta.url)), "assets", "notification-attachments", "october-statement.pdf");
const UPLOADED_DAYS_AGO = 2;
const HOUR_MS = 3_600_000;

/** Who gets the notices: the phone app's person on the customer surface, staff in the admin panel. */
export interface AttachmentNoticeRecipient {
	readonly userId: string;
	readonly surface: NotificationSurface;
}

async function seedStatement(uploadedById: string): Promise<NotificationAttachment> {
	const { seedReadyFile } = createSeedFileWriter();
	await seedReadyFile({
		id: STATEMENT_ID,
		category: "NOTIFICATION_DOCUMENT",
		ownerId: uploadedById,
		fileName: "october-statement.pdf",
		mimeType: "application/pdf",
		bytes: await readFile(STATEMENT),
		uploadedById,
		tenantId: null,
		uploadedDaysAgo: UPLOADED_DAYS_AGO,
	});
	const file = await prisma.storedFile.findUniqueOrThrow({ where: { id: STATEMENT_ID }, select: NOTIFICATION_ATTACHMENT_FILE_SELECT });
	const attachment = notificationAttachmentOf(file);
	if (attachment === null) {
		throw new Error("Seed: the statement is not a public PDF");
	}
	return attachment;
}

async function seededPhotos(): Promise<readonly NotificationAttachment[]> {
	const files = await prisma.storedFile.findMany({
		where: { category: "REWARD_IMAGE", status: "READY", isDeleted: false, imageWidth: { gte: SHOWCASE_PHOTO_MIN_WIDTH } },
		orderBy: { id: "asc" },
		take: SHOWCASE_PHOTO_COUNT,
		select: NOTIFICATION_ATTACHMENT_FILE_SELECT,
	});
	return files.flatMap((file): NotificationAttachment[] => {
		const attachment = notificationAttachmentOf(file);
		return attachment === null ? [] : [attachment];
	});
}

/** Three photo notices and a PDF for each recipient, an hour apart, the oldest already read. Returns how many were written. */
export async function seedAttachmentNotices(recipients: readonly AttachmentNoticeRecipient[], uploadedById: string, now: number): Promise<number> {
	const statement = await seedStatement(uploadedById);
	const attachments = [...(await seededPhotos()), statement];
	const notices = SHOWCASE_MESSAGES.flatMap((message, position) => {
		const attachment = attachments.at(position);
		return attachment === undefined ? [] : [{ message, attachment, position }];
	});
	for (const recipient of recipients) {
		for (const { message, attachment, position } of notices) {
			const createdAt = BigInt(now - (position + 1) * HOUR_MS);
			await seedInboxNotification({
				type: SHOWCASE_NOTIFICATION,
				userId: recipient.userId,
				surface: recipient.surface,
				payload: message,
				dedupeKey: `seed:attachment:${recipient.surface}:${String(position)}`,
				tenantId: null,
				createdAt,
				readAt: position === notices.length - 1 ? createdAt : null,
				attachment,
			});
		}
	}
	return recipients.length * notices.length;
}
