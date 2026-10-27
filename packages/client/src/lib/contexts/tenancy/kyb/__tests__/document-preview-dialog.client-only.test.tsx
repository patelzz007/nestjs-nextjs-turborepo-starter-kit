// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { UI_KIT_LABELS_EN } from "@workspace/ui/lib/labels/en";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import MerchantKybDocumentPreviewDialogClientOnly from "../document-preview-dialog.client-only";
import type { MerchantKybDocumentPreviewState } from "../document-preview-dialog";

// The preview dialog is a `next/dynamic` chunk. Its first load is Vite transforming that module tree on demand,
// which takes far longer on a busy machine than the 1 s an async query waits. Load it once up front so
// every render's lazy import resolves from the module cache and no assertion depends on machine speed.
beforeAll(async (): Promise<void> => {
	await import("../document-preview-dialog");
});

const PDF_PREVIEW: MerchantKybDocumentPreviewState = {
	fileName: "ssm-certificate.pdf",
	mimeType: "application/pdf",
	viewUrl: "https://files.example/ssm?disposition=inline",
	downloadUrl: "https://files.example/ssm?disposition=attachment",
};

beforeEach(() => {
	Object.defineProperty(navigator, "pdfViewerEnabled", { configurable: true, value: true });
});

afterEach(() => {
	cleanup();
});

describe("MerchantKybDocumentPreviewDialogClientOnly", () => {
	it("renders nothing while closed, on the server too", () => {
		expect(renderToString(<MerchantKybDocumentPreviewDialogClientOnly preview={null} onClose={vi.fn()} />)).toBe("");
	});

	it("loads the preview dialog once a document is opened", async () => {
		render(<MerchantKybDocumentPreviewDialogClientOnly preview={PDF_PREVIEW} onClose={vi.fn()} />, { wrapper: UiKitTestProviders });
		await waitFor(() => {
			expect(screen.getByTitle(UI_KIT_LABELS_EN.pdfViewer.frameTitle("ssm-certificate.pdf")).getAttribute("src")).toBe(PDF_PREVIEW.viewUrl);
		});
	});
});
