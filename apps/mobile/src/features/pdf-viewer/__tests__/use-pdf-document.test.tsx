import { buildTextPdf, PDF_MEDIA_TYPE } from "@workspace/shared";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { putFile, serveDownload } from "../../../../test/expo-file-system-fake";
import { failNextShare, shares } from "../../../../test/expo-sharing-fake";
import type { PdfEngine, PdfOpenResult } from "../pdf-engine";
import type { PdfSource } from "../pdf-source";
import { usePdfDocument, type PdfDocument } from "../use-pdf-document";

const PDF_BYTES = new TextEncoder().encode(buildTextPdf([{ title: "Statement", lines: ["Balance: 120.00"] }]));
const PICKED_URI = "file:///cache/DocumentPicker/statement.pdf";
const PICKED: PdfSource = { kind: "picked", uri: PICKED_URI, fileName: "statement.pdf" };
const REMOTE_URL = "https://storage.example.com/statement.pdf";
const REMOTE: PdfSource = { kind: "remote", url: REMOTE_URL, fileName: "Bank statement" };
const LETTER = { width: 612, height: 792 };

/** An engine that opens every file with `result` and renders pages to the cache — with its `open` to inspect. */
interface FakeEngine {
	readonly engine: PdfEngine;
	readonly open: jest.Mock<Promise<PdfOpenResult>, [string]>;
}

function fakeEngine(result: PdfOpenResult = { ok: true, pages: [LETTER] }): FakeEngine {
	const open = jest.fn<Promise<PdfOpenResult>, [string]>((): Promise<PdfOpenResult> => Promise.resolve(result));
	const renderPage = (_uri: string, pageIndex: number): Promise<string> => Promise.resolve(`file:///cache/pdf-pages/${String(pageIndex)}.png`);
	return { engine: { open, renderPage }, open };
}

interface HookProps {
	readonly source: PdfSource | null;
	readonly engine: PdfEngine | null;
}

async function renderDocument(initial: HookProps): Promise<{ readonly current: () => PdfDocument; readonly rerender: (props: HookProps) => Promise<void> }> {
	const hook = await renderHook(({ source, engine }: HookProps): PdfDocument => usePdfDocument(source, engine), { initialProps: initial });
	return {
		current: (): PdfDocument => hook.result.current,
		rerender: async (props: HookProps): Promise<void> => {
			await hook.rerender(props);
		},
	};
}

beforeEach(() => {
	putFile(PICKED_URI, PDF_BYTES);
});

describe("usePdfDocument", () => {
	it("opens a picked PDF with the engine and draws its pages from that file", async () => {
		const { engine, open } = fakeEngine();
		const document = await renderDocument({ source: PICKED, engine });

		await waitFor((): void => {
			expect(document.current().state).toEqual({ status: "ready", pages: [LETTER] });
		});
		expect(open).toHaveBeenCalledWith(PICKED_URI);
		await expect(document.current().renderPage(0, 720)).resolves.toBe("file:///cache/pdf-pages/0.png");
	});

	it("downloads a remote PDF first, under its name", async () => {
		serveDownload(REMOTE_URL, PDF_BYTES);
		const { engine, open } = fakeEngine();
		const document = await renderDocument({ source: REMOTE, engine });

		await waitFor((): void => {
			expect(document.current().state.status).toBe("ready");
		});
		expect(open).toHaveBeenCalledWith(expect.stringMatching(/\/Bank statement\.pdf$/));
	});

	it("is unavailable when the download fails, with nothing to hand to another app", async () => {
		const document = await renderDocument({ source: REMOTE, engine: fakeEngine().engine });

		await waitFor((): void => {
			expect(document.current().state).toEqual({ status: "failed", failure: "unavailable" });
		});
		expect(document.current().openExternally).toBeNull();
	});

	it("is unavailable when the picked file is gone", async () => {
		const document = await renderDocument({ source: { kind: "picked", uri: "file:///cache/gone.pdf", fileName: "gone.pdf" }, engine: fakeEngine().engine });

		await waitFor((): void => {
			expect(document.current().state).toEqual({ status: "failed", failure: "unavailable" });
		});
	});

	it("never hands a file that is no PDF to the engine", async () => {
		putFile("file:///cache/photo.pdf", new TextEncoder().encode("not a pdf"));
		const { engine, open } = fakeEngine();
		const document = await renderDocument({ source: { kind: "picked", uri: "file:///cache/photo.pdf", fileName: "photo.pdf" }, engine });

		await waitFor((): void => {
			expect(document.current().state).toEqual({ status: "failed", failure: "not_a_pdf" });
		});
		expect(open).not.toHaveBeenCalled();
	});

	it("reports what the engine could not open, and still offers another app", async () => {
		const document = await renderDocument({ source: PICKED, engine: fakeEngine({ ok: false, failure: "password_protected" }).engine });

		await waitFor((): void => {
			expect(document.current().state).toEqual({ status: "failed", failure: "password_protected" });
		});
		await act(async (): Promise<void> => {
			await document.current().openExternally?.();
		});
		const [shared] = shares();
		expect(shared?.url).toBe(PICKED_URI);
		expect(shared?.options).toMatchObject({ mimeType: PDF_MEDIA_TYPE, dialogTitle: "statement.pdf" });
	});

	it("offers another app where there is no engine (Expo Go), and draws no page", async () => {
		const document = await renderDocument({ source: PICKED, engine: null });

		await waitFor((): void => {
			expect(document.current().state).toEqual({ status: "external" });
		});
		expect(document.current().openExternally).not.toBeNull();
		await expect(document.current().renderPage(0, 720)).rejects.toThrow("No PDF is open");
	});

	it("passes on a share no app took", async () => {
		failNextShare(new Error("no app"));
		const document = await renderDocument({ source: PICKED, engine: null });
		await waitFor((): void => {
			expect(document.current().state.status).toBe("external");
		});

		await expect(document.current().openExternally?.()).rejects.toThrow("no app");
	});

	it("loads again on retry, and again for a new source", async () => {
		const { engine, open } = fakeEngine();
		const document = await renderDocument({ source: PICKED, engine });
		await waitFor((): void => {
			expect(document.current().state.status).toBe("ready");
		});

		await act((): void => {
			document.current().retry();
		});
		await waitFor((): void => {
			expect(open).toHaveBeenCalledTimes(2);
		});

		putFile("file:///cache/other.pdf", PDF_BYTES);
		await document.rerender({ source: { kind: "picked", uri: "file:///cache/other.pdf", fileName: "other.pdf" }, engine });
		await waitFor((): void => {
			expect(open).toHaveBeenLastCalledWith("file:///cache/other.pdf");
		});
	});

	it("waits with nothing open while there is no source", async () => {
		const { engine, open } = fakeEngine();
		const document = await renderDocument({ source: null, engine });

		expect(document.current().state).toEqual({ status: "loading" });
		expect(document.current().openExternally).toBeNull();
		expect(open).not.toHaveBeenCalled();
	});
});
