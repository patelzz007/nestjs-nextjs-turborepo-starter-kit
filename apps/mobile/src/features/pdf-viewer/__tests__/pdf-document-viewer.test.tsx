import { buildTextPdf } from "@workspace/shared";
import { DEFAULT_PDF_VIEWER_LABELS } from "@workspace/ui-native/components/pdf-viewer";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as React from "react";

import { AppProviders, createTestRuntime } from "../../../../test/app-harness";
import { putFile } from "../../../../test/expo-file-system-fake";
import { failNextShare } from "../../../../test/expo-sharing-fake";
import { PDF_VIEWER_COPY, savedCopyMessage } from "../labels";
import { PdfDocumentViewer } from "../pdf-document-viewer";
import type { PdfEngine, PdfOpenResult, PdfSave, PdfSaveOutcome } from "../pdf-engine";
import type { PdfSource } from "../pdf-source";

const PICKED_URI = "file:///cache/DocumentPicker/statement.pdf";
const PICKED: PdfSource = { kind: "picked", uri: PICKED_URI, fileName: "statement.pdf" };
const LETTER = { width: 612, height: 792 };

function engineWithPages(save: PdfSave | null = null): PdfEngine {
	return {
		open: (): Promise<PdfOpenResult> => Promise.resolve({ ok: true, pages: [LETTER, LETTER] }),
		renderPage: (_uri: string, pageIndex: number): Promise<string> => Promise.resolve(`file:///cache/pdf-pages/${String(pageIndex)}.png`),
		search: null,
		save,
	};
}

function savingAs(outcome: PdfSaveOutcome): PdfSave {
	return (): Promise<PdfSaveOutcome> => Promise.resolve(outcome);
}

/** Opens the "More" menu and chooses Download. */
async function download(): Promise<void> {
	await waitFor((): void => {
		expect(screen.getByText("1 / 2")).toBeOnTheScreen();
	});
	await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.moreActions }));
	await fireEvent.press(await screen.findByText(DEFAULT_PDF_VIEWER_LABELS.download));
}

async function renderDocumentViewer(engine: PdfEngine | null, onClose: () => void = jest.fn<undefined, []>()): Promise<void> {
	await render(
		<AppProviders runtime={createTestRuntime()}>
			<PdfDocumentViewer source={PICKED} onClose={onClose} engine={engine} />
		</AppProviders>,
	);
}

beforeEach(() => {
	putFile(PICKED_URI, new TextEncoder().encode(buildTextPdf([{ title: "Statement", lines: ["Balance: 120.00"] }])));
});

describe("PdfDocumentViewer", () => {
	it("shows the pages the engine reads, under the document's name", async () => {
		await renderDocumentViewer(engineWithPages());

		await waitFor((): void => {
			expect(screen.getByText("1 / 2")).toBeOnTheScreen();
		});
		expect(screen.getByRole("header", { name: "statement.pdf" })).toBeOnTheScreen();
	});

	it("tells the person when no app took the document", async () => {
		failNextShare(new Error("no app"));
		await renderDocumentViewer(engineWithPages());
		await waitFor((): void => {
			expect(screen.getByText("1 / 2")).toBeOnTheScreen();
		});

		await fireEvent.press(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.openExternally }));
		expect(await screen.findByText(PDF_VIEWER_COPY.openExternallyFailed)).toBeOnTheScreen();
	});

	it("is closed by its close button", async () => {
		const onClose = jest.fn<undefined, []>();
		await renderDocumentViewer(null, onClose);
		await waitFor((): void => {
			expect(screen.getByText(DEFAULT_PDF_VIEWER_LABELS.externalTitle)).toBeOnTheScreen();
		});

		await fireEvent.press(screen.getByRole("button", { name: PDF_VIEWER_COPY.close }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});

describe("PdfDocumentViewer — download", () => {
	it("says where the copy went", async () => {
		await renderDocumentViewer(engineWithPages(savingAs({ kind: "saved", fileName: "statement (1).pdf" })));

		await download();

		expect(await screen.findByText(savedCopyMessage("ios", "statement (1).pdf"))).toBeOnTheScreen();
	});

	it("says when the copy could not be saved, and nothing when the person cancelled", async () => {
		await renderDocumentViewer(engineWithPages(savingAs({ kind: "failed" })));
		await download();
		expect(await screen.findByText(PDF_VIEWER_COPY.saveFailed)).toBeOnTheScreen();
		await screen.unmount();

		await renderDocumentViewer(engineWithPages(savingAs({ kind: "cancelled" })));
		await download();
		expect(screen.queryByText(PDF_VIEWER_COPY.saveFailed)).toBeNull();
	});

	it("keeps Share as its own button when the device cannot save", async () => {
		await renderDocumentViewer(engineWithPages());
		await waitFor((): void => {
			expect(screen.getByText("1 / 2")).toBeOnTheScreen();
		});

		expect(screen.getByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.openExternally })).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: DEFAULT_PDF_VIEWER_LABELS.moreActions })).toBeNull();
	});
});

describe("savedCopyMessage", () => {
	it("names Downloads on Android and only the file elsewhere", () => {
		expect(savedCopyMessage("android", "a.pdf")).toBe("Saved to Downloads as a.pdf");
		expect(savedCopyMessage("ios", "a.pdf")).toBe("Saved a.pdf");
	});
});
