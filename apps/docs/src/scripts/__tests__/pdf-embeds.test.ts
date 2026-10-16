// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { pdfEmbedHtml } from "@/lib/markdown/pdf-embed";

import { initPdfEmbeds } from "../pdf-embeds";

afterEach(() => {
	document.body.innerHTML = "";
});

function mountEmbed(): HTMLElement {
	document.body.innerHTML = pdfEmbedHtml("/files/pdf-viewer-sample.pdf", null);
	const embed = document.querySelector<HTMLElement>(".pdf-embed");
	if (embed === null) {
		throw new Error("embed missing");
	}
	return embed;
}

describe("initPdfEmbeds", () => {
	it("keeps the frame where the browser shows PDFs inline", () => {
		const embed = mountEmbed();
		initPdfEmbeds(() => true);
		expect(embed.querySelector("iframe")).not.toBeNull();
		expect(embed.querySelector(".pdf-embed-unsupported")?.hasAttribute("hidden")).toBe(true);
	});

	it("swaps the frame for the note where it cannot", () => {
		const embed = mountEmbed();
		initPdfEmbeds(() => false);
		expect(embed.querySelector("iframe")).toBeNull();
		expect(embed.querySelector(".pdf-embed-unsupported")?.hasAttribute("hidden")).toBe(false);
	});

	it("does not ask the browser on a page without embeds", () => {
		let asked = false;
		initPdfEmbeds(() => {
			asked = true;
			return false;
		});
		expect(asked).toBe(false);
	});
});
