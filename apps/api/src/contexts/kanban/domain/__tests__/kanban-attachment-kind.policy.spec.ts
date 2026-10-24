import type { DocumentMimeType } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { kanbanAttachmentKindFor } from "../policies/kanban-attachment-kind.policy";

describe("kanbanAttachmentKindFor", () => {
	it("counts a PDF as a document", () => {
		expect(kanbanAttachmentKindFor("application/pdf")).toBe("DOCUMENT");
	});

	it.each<DocumentMimeType>(["image/jpeg", "image/png", "image/webp", "image/avif"])("counts %s as an attachment", (mimeType) => {
		expect(kanbanAttachmentKindFor(mimeType)).toBe("ATTACHMENT");
	});
});
