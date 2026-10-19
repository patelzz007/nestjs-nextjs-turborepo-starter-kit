// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { UI_KIT_LABELS_EN } from "@workspace/ui/lib/labels/en";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MerchantKybDocumentPreviewDialog, type MerchantKybDocumentPreviewState } from "../document-preview-dialog";

const PDF_LABELS = UI_KIT_LABELS_EN.pdfViewer;

const PDF_PREVIEW: MerchantKybDocumentPreviewState = {
	fileName: "ssm-certificate.pdf",
	mimeType: "application/pdf",
	viewUrl: "https://files.example/ssm?disposition=inline",
	downloadUrl: "https://files.example/ssm?disposition=attachment",
};

const IMAGE_PREVIEW: MerchantKybDocumentPreviewState = {
	fileName: "shopfront.png",
	mimeType: "image/png",
	viewUrl: "https://files.example/shopfront?disposition=inline",
	downloadUrl: "https://files.example/shopfront?disposition=attachment",
};

beforeEach(() => {
	Object.defineProperty(navigator, "pdfViewerEnabled", { configurable: true, value: true });
});

afterEach(() => {
	cleanup();
});

describe("MerchantKybDocumentPreviewDialog", () => {
	it("shows a PDF in the kit's viewer, whose toolbar carries the new-tab and download actions", () => {
		render(<MerchantKybDocumentPreviewDialog preview={PDF_PREVIEW} onClose={vi.fn()} />, { wrapper: UiKitTestProviders });
		expect(screen.getByTitle(PDF_LABELS.frameTitle("ssm-certificate.pdf")).getAttribute("src")).toBe(PDF_PREVIEW.viewUrl);
		const toolbar = screen.getByRole("toolbar", { name: PDF_LABELS.toolbar });
		expect(within(toolbar).getByRole("link", { name: PDF_LABELS.download }).getAttribute("href")).toBe(PDF_PREVIEW.downloadUrl);
		expect(screen.queryByRole("button", { name: "View source" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Download" })).toBeNull();
	});

	it("shows an image with the footer's view-source and download actions", () => {
		render(<MerchantKybDocumentPreviewDialog preview={IMAGE_PREVIEW} onClose={vi.fn()} />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("img", { name: "shopfront.png" }).getAttribute("src")).toBe(IMAGE_PREVIEW.viewUrl);
		expect(screen.queryByRole("toolbar", { name: PDF_LABELS.toolbar })).toBeNull();
		expect(screen.getByRole("button", { name: "View source" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Download" })).toBeDefined();
	});

	it("closes from the footer", () => {
		const onClose = vi.fn();
		render(<MerchantKybDocumentPreviewDialog preview={PDF_PREVIEW} onClose={onClose} />, { wrapper: UiKitTestProviders });
		const [closeButton] = screen.getAllByRole("button", { name: "Close" }).filter((button: HTMLElement): boolean => button.textContent === "Close");
		if (closeButton === undefined) {
			throw new Error("footer close button missing");
		}
		fireEvent.click(closeButton);
		expect(onClose).toHaveBeenCalled();
	});

	it("renders nothing while there is no preview", () => {
		render(<MerchantKybDocumentPreviewDialog preview={null} onClose={vi.fn()} />, { wrapper: UiKitTestProviders });
		expect(screen.queryByRole("dialog")).toBeNull();
	});
});
