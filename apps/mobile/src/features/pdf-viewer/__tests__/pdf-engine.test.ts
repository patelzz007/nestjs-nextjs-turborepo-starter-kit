import { createNativePdfEngine, deviceNativePdfEngine, pdfOpenFailureOfErrorCode } from "../pdf-engine";
import * as rendererModule from "../pdf-renderer-module";
import type { PdfRendererNativeModule } from "../pdf-renderer-module";

const FILE_URI = "file:///cache/pdf-documents/statement.pdf";
const LETTER = { width: 612, height: 792 };

/** An Expo native module's rejection: an Error with a code. */
function codedError(code: string): Error {
	return Object.assign(new Error(code), { code });
}

type DocumentInfo = Awaited<ReturnType<PdfRendererNativeModule["openDocument"]>>;
type SearchAnswer = Awaited<ReturnType<PdfRendererNativeModule["searchDocument"]>>;
type SaveAnswer = Awaited<ReturnType<PdfRendererNativeModule["saveDocument"]>>;

/** A native module, with its functions to inspect. */
interface FakeNativeModule {
	readonly module: PdfRendererNativeModule;
	readonly openDocument: jest.Mock<Promise<DocumentInfo>, [string]>;
	readonly renderPage: jest.Mock<Promise<string>, [string, number, number]>;
	readonly searchDocument: jest.Mock<Promise<SearchAnswer>, [string, string]>;
	readonly saveDocument: jest.Mock<Promise<SaveAnswer>, [string, string]>;
}

/** What a fake module can do, and how it answers search and save (a rejection when `error`). */
interface FakeAnswers {
	readonly info?: DocumentInfo;
	readonly error?: Error;
	readonly searchSupported?: boolean;
	readonly saveSupported?: boolean;
	readonly found?: SearchAnswer;
	readonly saved?: SaveAnswer | Error;
}

/** A native module that answers `openDocument` with `info` (or rejects with `error`) and renders pages to the cache. */
function nativeModule(answer: FakeAnswers): FakeNativeModule {
	const openDocument = jest.fn<Promise<DocumentInfo>, [string]>((): Promise<DocumentInfo> =>
		answer.error === undefined ? Promise.resolve(answer.info ?? { pageCount: 0, pages: [] }) : Promise.reject(answer.error),
	);
	const renderPage = jest.fn<Promise<string>, [string, number, number]>((_uri: string, pageIndex: number, widthPx: number): Promise<string> =>
		Promise.resolve(`file:///cache/pdf-pages/${String(pageIndex)}-${String(widthPx)}.png`),
	);
	const searchDocument = jest.fn<Promise<SearchAnswer>, [string, string]>((): Promise<SearchAnswer> => Promise.resolve(answer.found ?? []));
	const saveDocument = jest.fn<Promise<SaveAnswer>, [string, string]>((_uri: string, fileName: string): Promise<SaveAnswer> => {
		const saved = answer.saved ?? { saved: true, fileName };
		return saved instanceof Error ? Promise.reject(saved) : Promise.resolve(saved);
	});
	return {
		module: {
			searchSupported: answer.searchSupported ?? true,
			saveSupported: answer.saveSupported ?? true,
			openDocument,
			renderPage,
			searchDocument,
			saveDocument,
		},
		openDocument,
		renderPage,
		searchDocument,
		saveDocument,
	};
}

function nativeModuleOf(answer: FakeAnswers): PdfRendererNativeModule {
	return nativeModule(answer).module;
}

describe("pdfOpenFailureOfErrorCode", () => {
	it("names a password-protected PDF", () => {
		expect(pdfOpenFailureOfErrorCode("ERR_PDF_PASSWORD_PROTECTED")).toBe("password_protected");
	});

	it.each([["ERR_PDF_UNREADABLE"], ["ERR_PDF_INVALID_REQUEST"], ["ERR_PDF_RENDER_FAILED"], ["ERR_SOMETHING_ELSE"], [null]])(
		"treats %s as a document that could not be read",
		(code: string | null) => {
			expect(pdfOpenFailureOfErrorCode(code)).toBe("unreadable");
		},
	);
});

describe("createNativePdfEngine", () => {
	it("opens a document with every page's size", async () => {
		const { module, openDocument } = nativeModule({ info: { pageCount: 2, pages: [LETTER, { width: 842, height: 595 }] } });

		await expect(createNativePdfEngine(module).open(FILE_URI)).resolves.toEqual({ ok: true, pages: [LETTER, { width: 842, height: 595 }] });
		expect(openDocument).toHaveBeenCalledWith(FILE_URI);
	});

	it("does not trust an answer whose page list disagrees with its count, or a page without size", async () => {
		await expect(createNativePdfEngine(nativeModuleOf({ info: { pageCount: 3, pages: [LETTER] } })).open(FILE_URI)).resolves.toEqual({ ok: false, failure: "unreadable" });
		await expect(createNativePdfEngine(nativeModuleOf({ info: { pageCount: 1, pages: [{ width: 0, height: 792 }] } })).open(FILE_URI)).resolves.toEqual({
			ok: false,
			failure: "unreadable",
		});
	});

	it("turns the module's rejections into the shared failures", async () => {
		await expect(createNativePdfEngine(nativeModuleOf({ error: codedError("ERR_PDF_PASSWORD_PROTECTED") })).open(FILE_URI)).resolves.toEqual({
			ok: false,
			failure: "password_protected",
		});
		await expect(createNativePdfEngine(nativeModuleOf({ error: new Error("no code") })).open(FILE_URI)).resolves.toEqual({ ok: false, failure: "unreadable" });
	});

	it("renders a page to a file in the cache, and refuses any other address", async () => {
		const { module, renderPage } = nativeModule({});
		const engine = createNativePdfEngine(module);

		await expect(engine.renderPage(FILE_URI, 1, 1080)).resolves.toBe("file:///cache/pdf-pages/1-1080.png");
		expect(renderPage).toHaveBeenCalledWith(FILE_URI, 1, 1080);

		renderPage.mockResolvedValueOnce("https://example.com/page.png");
		await expect(engine.renderPage(FILE_URI, 0, 720)).rejects.toThrow();
	});

	it("passes a page that cannot be drawn on as a rejection", async () => {
		const { module, renderPage } = nativeModule({});
		renderPage.mockRejectedValueOnce(codedError("ERR_PDF_RENDER_FAILED"));

		await expect(createNativePdfEngine(module).renderPage(FILE_URI, 0, 720)).rejects.toThrow("ERR_PDF_RENDER_FAILED");
	});
});

describe("deviceNativePdfEngine", () => {
	it("is absent where the app runs without its native module (Expo Go, and Jest)", () => {
		expect(rendererModule.loadPdfRendererModule()).toBeNull();
		expect(deviceNativePdfEngine()).toBeNull();
	});

	it("draws with the native module when the build has it", async () => {
		const { module } = nativeModule({ info: { pageCount: 1, pages: [LETTER] } });
		jest.spyOn(rendererModule, "loadPdfRendererModule").mockReturnValue(module);

		await expect(deviceNativePdfEngine()?.open(FILE_URI)).resolves.toEqual({ ok: true, pages: [LETTER] });
	});
});

const MATCH = { pageIndex: 1, rects: [{ left: 0.1, top: 0.2, width: 0.3, height: 0.02 }] };

describe("pdfOpenFailureOfErrorCode — search and save codes", () => {
	it.each([["ERR_PDF_UNSUPPORTED"], ["ERR_PDF_SAVE_FAILED"]])("treats %s as unavailable", (code: string) => {
		expect(pdfOpenFailureOfErrorCode(code)).toBe("unavailable");
	});
});

describe("createNativePdfEngine — search", () => {
	it("searches the file and passes every match on, in page order", async () => {
		const { module, searchDocument } = nativeModule({ found: [MATCH] });

		const search = createNativePdfEngine(module).search;

		await expect(search?.(FILE_URI, "balance")).resolves.toEqual([MATCH]);
		expect(searchDocument).toHaveBeenCalledWith(FILE_URI, "balance");
	});

	it("offers no search where the device cannot search (Android before 15)", () => {
		expect(createNativePdfEngine(nativeModuleOf({ searchSupported: false })).search).toBeNull();
	});

	it("does not trust a match without a page or with a negative box", async () => {
		const badPage = createNativePdfEngine(nativeModuleOf({ found: [{ pageIndex: -1, rects: [] }] })).search;
		const badBox = createNativePdfEngine(nativeModuleOf({ found: [{ pageIndex: 0, rects: [{ left: 0, top: 0, width: -1, height: 0 }] }] })).search;

		await expect(badPage?.(FILE_URI, "x")).rejects.toThrow();
		await expect(badBox?.(FILE_URI, "x")).rejects.toThrow();
	});
});

describe("createNativePdfEngine — save", () => {
	it("reports the name the copy was saved under (a clash may rename it)", async () => {
		const { module, saveDocument } = nativeModule({ saved: { saved: true, fileName: "statement (1).pdf" } });

		await expect(createNativePdfEngine(module).save?.(FILE_URI, "statement.pdf")).resolves.toEqual({ kind: "saved", fileName: "statement (1).pdf" });
		expect(saveDocument).toHaveBeenCalledWith(FILE_URI, "statement.pdf");
	});

	it("reports a cancelled save dialog (iOS) as cancelled", async () => {
		const save = createNativePdfEngine(nativeModuleOf({ saved: { saved: false, fileName: "statement.pdf" } })).save;

		await expect(save?.(FILE_URI, "statement.pdf")).resolves.toEqual({ kind: "cancelled" });
	});

	it("turns a rejection or an answer it cannot read into a failure, never a throw", async () => {
		const rejected = createNativePdfEngine(nativeModuleOf({ saved: codedError("ERR_PDF_SAVE_FAILED") })).save;
		const garbled = createNativePdfEngine(nativeModuleOf({ saved: { saved: true, fileName: "" } })).save;

		await expect(rejected?.(FILE_URI, "statement.pdf")).resolves.toEqual({ kind: "failed" });
		await expect(garbled?.(FILE_URI, "statement.pdf")).resolves.toEqual({ kind: "failed" });
	});

	it("offers no save where the device cannot save", () => {
		expect(createNativePdfEngine(nativeModuleOf({ saveSupported: false })).save).toBeNull();
	});
});
