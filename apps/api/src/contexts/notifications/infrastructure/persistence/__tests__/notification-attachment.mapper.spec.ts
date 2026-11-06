import type { NotificationAttachment } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { resolveStoredPublicUrl, type PublicUrlResolve } from "../../../../../config/public-url.resolver";
import { attachmentResponseOf, notificationAttachmentOf, parseStoredAttachment, type NotificationAttachmentFile } from "../notification-attachment.mapper";

const API = "http://192.168.1.5:8080";
const resolve: PublicUrlResolve = (stored) => resolveStoredPublicUrl(stored, API);

const PHOTO: NotificationAttachment = {
	name: "cake.webp",
	mimeType: "image/webp",
	sizeBytes: 1_048_576,
	width: 3840,
	height: 2160,
	path: "/api/v1/files/cake/local-public",
	previewPath: "/api/v1/files/cake-1280/local-public",
};

const FILE: NotificationAttachmentFile = {
	originalName: "cake.webp",
	mimeType: "image/webp",
	sizeBytes: 1_048_576,
	imageWidth: 3840,
	imageHeight: 2160,
	publicPath: "/api/v1/files/cake/local-public",
	variants: [
		{ width: 640, publicPath: "/api/v1/files/cake-640/local-public" },
		{ width: 1280, publicPath: "/api/v1/files/cake-1280/local-public" },
		{ width: 3840, publicPath: "/api/v1/files/cake-3840/local-public" },
	],
};

describe("notification attachments", () => {
	it("joins the stored paths to the API's address when read, so a changed address never strands one", () => {
		expect(attachmentResponseOf(PHOTO, resolve)).toStrictEqual({
			name: "cake.webp",
			mimeType: "image/webp",
			sizeBytes: 1_048_576,
			width: 3840,
			height: 2160,
			url: `${API}/api/v1/files/cake/local-public`,
			previewUrl: `${API}/api/v1/files/cake-1280/local-public`,
		});
	});

	it("keeps a file with no smaller copy, like a PDF, and has no attachment for none", () => {
		const pdf = { ...PHOTO, mimeType: "application/pdf", width: null, height: null, previewPath: null } satisfies NotificationAttachment;
		expect(attachmentResponseOf(pdf, resolve)).toMatchObject({ previewUrl: null, width: null });
		expect(attachmentResponseOf(null, resolve)).toBeNull();
	});

	it("treats a stored value that no longer parses as absent", () => {
		expect(parseStoredAttachment({ name: "cake.webp" })).toBeNull();
		expect(parseStoredAttachment(null)).toBeNull();
		expect(parseStoredAttachment({ ...PHOTO })).toStrictEqual(PHOTO);
	});

	it("takes the widest rendition a list can use as the preview, never the 4K one", () => {
		expect(notificationAttachmentOf(FILE)).toMatchObject({ path: FILE.publicPath, previewPath: "/api/v1/files/cake-1280/local-public", width: 3840 });
	});

	it("gives a file without renditions no preview", () => {
		expect(notificationAttachmentOf({ ...FILE, mimeType: "application/pdf", imageWidth: null, imageHeight: null, variants: [] })).toMatchObject({ previewPath: null });
	});

	it("refuses a file that is not public, or not a type a notification carries", () => {
		expect(notificationAttachmentOf({ ...FILE, publicPath: null })).toBeNull();
		expect(notificationAttachmentOf({ ...FILE, mimeType: "text/plain" })).toBeNull();
	});
});
