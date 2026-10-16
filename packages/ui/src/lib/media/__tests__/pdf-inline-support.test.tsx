// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePdfInlineSupport } from "../../../hooks/use-pdf-inline-support";
import { readPdfInlineSupport } from "../pdf-inline-support";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

function stubNavigator(pdfViewerEnabled: boolean | undefined): void {
	Object.defineProperty(navigator, "pdfViewerEnabled", { configurable: true, value: pdfViewerEnabled });
}

describe("readPdfInlineSupport", () => {
	it("follows navigator.pdfViewerEnabled", () => {
		stubNavigator(false);
		expect(readPdfInlineSupport()).toBe(false);
		stubNavigator(true);
		expect(readPdfInlineSupport()).toBe(true);
	});

	it("assumes support when the browser does not report it, or there is no navigator", () => {
		stubNavigator(undefined);
		expect(readPdfInlineSupport()).toBe(true);
		vi.stubGlobal("navigator", undefined);
		expect(readPdfInlineSupport()).toBe(true);
	});
});

describe("usePdfInlineSupport", () => {
	it("reports the browser's answer once on the client", () => {
		stubNavigator(false);
		const { result } = renderHook(() => usePdfInlineSupport());
		expect(result.current).toBe(false);
	});
});
