// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PDF_FILE_EXTENSION, PDF_MEDIA_TYPE, PdfOpenFailureSchema } from "@workspace/shared";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UI_KIT_LABELS_EN } from "../../lib/labels/en";
import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import { PdfViewer, type PdfViewerProps, type PdfViewerSource } from "../pdf-viewer";

const LABELS = UI_KIT_LABELS_EN.pdfViewer;
const BLOB_URL = "blob:http://localhost/7a1e";
const SIGNED_SOURCE: PdfViewerSource = {
	kind: "url",
	url: "https://files.example/kyb/ssm?disposition=inline",
	downloadUrl: "https://files.example/kyb/ssm?disposition=attachment",
	fileName: "SSM certificate",
};

beforeEach(() => {
	URL.createObjectURL = vi.fn((): string => BLOB_URL);
	URL.revokeObjectURL = vi.fn((): void => undefined);
	Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
	stubPdfViewerEnabled(true);
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

function stubPdfViewerEnabled(enabled: boolean): void {
	Object.defineProperty(navigator, "pdfViewerEnabled", { configurable: true, value: enabled });
}

function renderViewer(props: PdfViewerProps): ReturnType<typeof render> {
	return render(<PdfViewer {...props} />, { wrapper: UiKitTestProviders });
}

function toolbar(): HTMLElement {
	return screen.getByRole("toolbar", { name: LABELS.toolbar });
}

describe("PdfViewer", () => {
	it("draws a signed URL in a titled frame, with new-tab, download and fullscreen in the toolbar", () => {
		renderViewer({ source: SIGNED_SOURCE });
		const frame = screen.getByTitle(LABELS.frameTitle("SSM certificate.pdf"));
		expect(frame.tagName).toBe("IFRAME");
		expect(frame.getAttribute("src")).toBe(SIGNED_SOURCE.url);
		expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
		expect(within(toolbar()).getByText("SSM certificate.pdf")).toBeDefined();
		const newTab = within(toolbar()).getByRole("link", { name: LABELS.openInNewTab });
		expect(newTab.getAttribute("href")).toBe(SIGNED_SOURCE.url);
		expect(newTab.getAttribute("rel")).toBe("noopener noreferrer");
		const download = within(toolbar()).getByRole("link", { name: LABELS.download });
		expect(download.getAttribute("href")).toBe("https://files.example/kyb/ssm?disposition=attachment");
		expect(download.getAttribute("download")).toBe("SSM certificate.pdf");
		expect(within(toolbar()).getByRole("button", { name: LABELS.enterFullscreen })).toBeDefined();
		expect(screen.getByRole("region", { name: "SSM certificate.pdf" }).dataset.status).toBe("ready");
	});

	it("offers no file picker unless the caller handles a picked file", () => {
		renderViewer({ source: SIGNED_SOURCE });
		expect(screen.queryByRole("button", { name: LABELS.openFile })).toBeNull();
		expect(document.querySelector('input[type="file"]')).toBeNull();
	});

	it("shows the empty state with an open button when nothing is open", () => {
		renderViewer({ source: null, onSourceChange: vi.fn() });
		expect(screen.getAllByText(LABELS.emptyTitle).length).toBeGreaterThan(0);
		expect(screen.getByText(LABELS.emptyDescription)).toBeDefined();
		expect(screen.getAllByRole("button", { name: LABELS.openFile })).toHaveLength(2);
		expect(screen.queryByRole("link", { name: LABELS.download })).toBeNull();
	});

	it("reports a picked file to the caller, which then shows it", async () => {
		function Harness(): React.JSX.Element {
			const [source, setSource] = React.useState<PdfViewerSource | null>(null);
			return <PdfViewer source={source} onSourceChange={setSource} />;
		}
		render(<Harness />, { wrapper: UiKitTestProviders });
		const input = document.querySelector<HTMLInputElement>('input[type="file"]');
		expect(input?.getAttribute("accept")).toBe(`${PDF_MEDIA_TYPE},${PDF_FILE_EXTENSION}`);
		const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation((): void => undefined);
		fireEvent.click(within(toolbar()).getByRole("button", { name: LABELS.openFile }));
		expect(clickSpy).toHaveBeenCalled();

		const file = new File(["%PDF-1.4\n%%EOF"], "menu.pdf", { type: PDF_MEDIA_TYPE });
		if (input === null) {
			throw new Error("file input missing");
		}
		fireEvent.change(input, { target: { files: [file] } });
		expect(screen.getByRole("status")).toBeDefined();
		await waitFor(() => {
			expect(screen.getByTitle(LABELS.frameTitle("menu.pdf")).getAttribute("src")).toBe(BLOB_URL);
		});
		expect(screen.getByRole("link", { name: LABELS.download }).getAttribute("download")).toBe("menu.pdf");
	});

	it("explains why a picked file cannot be opened and offers another", async () => {
		const source: PdfViewerSource = { kind: "file", file: new File(["GIF89a"], "photo.pdf", { type: PDF_MEDIA_TYPE }) };
		renderViewer({ source, onSourceChange: vi.fn() });
		const alert = await screen.findByRole("alert");
		expect(within(alert).getByText(LABELS.failureTitle)).toBeDefined();
		expect(within(alert).getByText(LABELS.failures.not_a_pdf)).toBeDefined();
		expect(within(alert).getByRole("button", { name: LABELS.openFile })).toBeDefined();
		expect(screen.queryByTitle(LABELS.frameTitle("photo.pdf"))).toBeNull();
	});

	it("has a reason for every shared failure", () => {
		for (const failure of PdfOpenFailureSchema.options) {
			expect(LABELS.failures[failure].length).toBeGreaterThan(0);
		}
	});

	it("offers the new tab and the download instead of a frame where the browser cannot show PDFs", () => {
		stubPdfViewerEnabled(false);
		renderViewer({ source: SIGNED_SOURCE });
		expect(screen.queryByTitle(LABELS.frameTitle("SSM certificate.pdf"))).toBeNull();
		expect(screen.getByText(LABELS.inlineUnsupportedTitle)).toBeDefined();
		expect(screen.getAllByRole("link", { name: LABELS.download })).toHaveLength(2);
		expect(screen.queryByRole("button", { name: LABELS.enterFullscreen })).toBeNull();
	});

	it("puts the whole viewer in fullscreen and forwards its ref", () => {
		const requestFullscreen = vi.fn((): Promise<void> => Promise.resolve());
		HTMLElement.prototype.requestFullscreen = requestFullscreen;
		const ref = React.createRef<HTMLElement>();
		render(<PdfViewer ref={ref} source={SIGNED_SOURCE} className="h-[80vh]" />, { wrapper: UiKitTestProviders });
		expect(ref.current?.dataset.slot).toBe("pdf-viewer");
		expect(ref.current?.className).toContain("h-[80vh]");
		fireEvent.click(screen.getByRole("button", { name: LABELS.enterFullscreen }));
		expect(requestFullscreen.mock.contexts).toEqual([ref.current]);
	});

	it("takes a per-usage label override", () => {
		renderViewer({ source: SIGNED_SOURCE, labels: { download: "Save copy" } });
		expect(screen.getByRole("link", { name: "Save copy" })).toBeDefined();
	});
});
