// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { triggerBrowserDownload } from "./browser-download";

describe("triggerBrowserDownload", () => {
	it("clicks a download link for the URL, named after the file, without leaving it in the page", () => {
		const anchor = document.createElement("a");
		const click = vi.spyOn(anchor, "click").mockImplementation((): void => undefined);
		const createElement = vi.spyOn(document, "createElement").mockReturnValue(anchor);

		triggerBrowserDownload("https://files.example.com/signed?token=abc", "teh-tarik.webp");

		expect(createElement).toHaveBeenCalledWith("a");
		expect(click).toHaveBeenCalledTimes(1);
		expect(anchor.href).toBe("https://files.example.com/signed?token=abc");
		expect(anchor.download).toBe("teh-tarik.webp");
		expect(anchor.rel).toBe("noopener noreferrer");
		expect(document.querySelector("a")).toBeNull();
		createElement.mockRestore();
	});
});
