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

/** A native module, with its two functions to inspect. */
interface FakeNativeModule {
	readonly module: PdfRendererNativeModule;
	readonly openDocument: jest.Mock<Promise<DocumentInfo>, [string]>;
	readonly renderPage: jest.Mock<Promise<string>, [string, number, number]>;
}

/** A native module that answers `openDocument` with `info` (or rejects with `error`) and renders pages to the cache. */
function nativeModule(answer: { info?: DocumentInfo; error?: Error }): FakeNativeModule {
	const openDocument = jest.fn<Promise<DocumentInfo>, [string]>((): Promise<DocumentInfo> =>
		answer.error === undefined ? Promise.resolve(answer.info ?? { pageCount: 0, pages: [] }) : Promise.reject(answer.error),
	);
	const renderPage = jest.fn<Promise<string>, [string, number, number]>((_uri: string, pageIndex: number, widthPx: number): Promise<string> =>
		Promise.resolve(`file:///cache/pdf-pages/${String(pageIndex)}-${String(widthPx)}.png`),
	);
	return { module: { openDocument, renderPage }, openDocument, renderPage };
}

function nativeModuleOf(answer: { info?: DocumentInfo; error?: Error }): PdfRendererNativeModule {
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
