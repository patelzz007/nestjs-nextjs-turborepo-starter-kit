import type { Prisma } from "@prisma/client";
import { epochMs, type NotificationAttachment } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { FixedClock } from "../../../../../platform/application/__tests__/fixed-clock";
import { TransactionalEventCollector } from "../../../../../platform/application/events/transactional-event-collector";
import { NotifyRequestError, type NotifyRequest } from "../../../application/ports/notify.port";
import { SHOWCASE_NOTIFICATION, type ShowcasePayload } from "../../../domain/catalog/types/platform.types";
import { PHONE_CODE_NOTIFICATION } from "../../../domain/catalog/types/security.types";
import { TransactionalNotify, type NotifyDatabase } from "../transactional-notify.adapter";

const USER_ID = "0b6a3c55-2f1d-4e8a-a7b9-5c4d3e2f1a10";
const ATTACHMENT: NotificationAttachment = {
	name: "cake.webp",
	mimeType: "image/webp",
	sizeBytes: 1_048_576,
	width: 3840,
	height: 2160,
	path: "/api/v1/files/cake/local-public",
	previewPath: "/api/v1/files/cake-1280/local-public",
};

/** The one call notify() makes, kept so a test can read what was written. */
function recordingDatabase(): { readonly db: NotifyDatabase; readonly rows: Prisma.NotificationCreateManyInput[] } {
	const rows: Prisma.NotificationCreateManyInput[] = [];
	const notification = {
		createMany: ({ data }: Prisma.NotificationCreateManyArgs): Promise<{ readonly count: number }> => {
			rows.push(...[data].flat());
			return Promise.resolve({ count: rows.length });
		},
	};
	return { db: { notification }, rows };
}

function notifier(db: NotifyDatabase): TransactionalNotify {
	return new TransactionalNotify(db, new TransactionalEventCollector(), new FixedClock(epochMs(1_800_000_000_000)));
}

const SHOWCASE: NotifyRequest<ShowcasePayload> = {
	type: SHOWCASE_NOTIFICATION,
	recipient: { kind: "user", userId: USER_ID },
	payload: { title: "Fresh from the kitchen", body: "A first look." },
	dedupeKey: "demo:1",
	tenantId: null,
};

describe("TransactionalNotify attachments", () => {
	it("keeps the attachment on the notification row", async () => {
		const { db, rows } = recordingDatabase();
		await notifier(db).notify({ ...SHOWCASE, attachment: ATTACHMENT });
		expect(rows.at(0)?.attachment).toStrictEqual(ATTACHMENT);
	});

	it("writes no attachment when there is none: it is optional", async () => {
		const { db, rows } = recordingDatabase();
		await notifier(db).notify(SHOWCASE);
		expect(rows.at(0)).not.toHaveProperty("attachment");
	});

	it("refuses one on a sensitive type, whose content must not be kept", async () => {
		const { db, rows } = recordingDatabase();
		const refused = notifier(db).notify({
			type: PHONE_CODE_NOTIFICATION,
			recipient: { kind: "contact-point", channel: "SMS", address: "+60123456789" },
			payload: PHONE_CODE_NOTIFICATION.declaration.samplePayload,
			dedupeKey: "code:1",
			tenantId: null,
			attachment: ATTACHMENT,
		});
		await expect(refused).rejects.toBeInstanceOf(NotifyRequestError);
		expect(rows).toHaveLength(0);
	});
});
