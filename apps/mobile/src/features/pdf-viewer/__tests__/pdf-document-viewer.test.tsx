import { buildTextPdf } from "@workspace/shared";
import { DEFAULT_PDF_VIEWER_LABELS } from "@workspace/ui-native/components/pdf-viewer";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as React from "react";

import { AppProviders, createTestRuntime } from "../../../../test/app-harness";
import { putFile } from "../../../../test/expo-file-system-fake";
import { failNextShare } from "../../../../test/expo-sharing-fake";
import { PDF_VIEWER_COPY } from "../labels";
import { PdfDocumentViewer } from "../pdf-document-viewer";
import type { PdfEngine, PdfOpenResult } from "../pdf-engine";
import type { PdfSource } from "../pdf-source";

const PICKED_URI = "file:///cache/DocumentPicker/statement.pdf";
const PICKED: PdfSource = { kind: "picked", uri: PICKED_URI, fileName: "statement.pdf" };
const LETTER = { width: 612, height: 792 };

function engineWithPages(): PdfEngine {
	return {
		open: (): Promise<PdfOpenResult> => Promise.resolve({ ok: true, pages: [LETTER, LETTER] }),
		renderPage: (_uri: string, pageIndex: number): Promise<string> => Promise.resolve(`file:///cache/pdf-pages/${String(pageIndex)}.png`),
	};
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
			expect(screen.getByText("Page 1 of 2")).toBeOnTheScreen();
		});
		expect(screen.getByRole("header", { name: "statement.pdf" })).toBeOnTheScreen();
	});

	it("tells the person when no app took the document", async () => {
		failNextShare(new Error("no app"));
		await renderDocumentViewer(engineWithPages());
		await waitFor((): void => {
			expect(screen.getByText("Page 1 of 2")).toBeOnTheScreen();
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
