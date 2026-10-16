import { readPdfInlineSupport } from "@workspace/ui/lib/media/pdf-inline-support";

import { PDF_EMBED_ATTRIBUTE } from "@/lib/markdown/pdf-embed";

/**
 * Where the browser cannot show PDFs inline (Android Chrome), each ```pdf embed's frame
 * would download the file or stay blank: it is removed, and the embed's note pointing at
 * the new-tab and download links is shown instead.
 */
export function initPdfEmbeds(inlineSupported: () => boolean = readPdfInlineSupport): void {
	const embeds = document.querySelectorAll<HTMLElement>(`[${PDF_EMBED_ATTRIBUTE}]`);
	if (embeds.length === 0 || inlineSupported()) {
		return;
	}
	for (const embed of embeds) {
		embed.querySelector("iframe")?.remove();
		embed.querySelector<HTMLElement>(".pdf-embed-unsupported")?.removeAttribute("hidden");
	}
}
