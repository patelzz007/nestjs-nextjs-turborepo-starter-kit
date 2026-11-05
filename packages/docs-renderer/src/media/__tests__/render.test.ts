import { describe, expect, it } from "vitest";

import { parseMediaIslandPayload, type MediaIslandPayload } from "../props";
import { MEDIA_ISLAND_PAYLOAD_ATTRIBUTE, MEDIA_ISLAND_ROOT_ATTRIBUTE, renderMediaIsland } from "../render";

const CAROUSEL: MediaIslandPayload = {
	kind: "carousel",
	props: {
		images: [
			{ src: "/images/email/welcome.png", alt: "The welcome email" },
			{ src: "/images/email/verification.png", alt: "The verification email" },
		],
		ratio: 4 / 3,
	},
};
const RESIZER: MediaIslandPayload = {
	kind: "image-resize",
	props: { image: { src: "/images/email/welcome.png", alt: "The welcome email" }, width: 480, height: 360, aspectRatio: null },
};

function payloadOf(html: string): MediaIslandPayload {
	const match = new RegExp(`<script type="application/json" ${MEDIA_ISLAND_PAYLOAD_ATTRIBUTE}>(?<json>.*)</script>`).exec(html);
	return parseMediaIslandPayload(match?.groups?.json ?? "");
}

describe("renderMediaIsland", () => {
	it("renders a carousel's slides at build time, with its payload for hydration", () => {
		const html = renderMediaIsland(CAROUSEL);

		expect(html.startsWith('<div class="media-island media-island-carousel">')).toBe(true);
		expect(html).toContain(MEDIA_ISLAND_ROOT_ATTRIBUTE);
		expect(html).toContain('data-slot="image-carousel"');
		expect(html).toContain('aria-label="Image 2 of 2"');
		expect(html).toContain('<span class="sr-only">Next slide</span>');
		expect(payloadOf(html)).toEqual(CAROUSEL);
	});

	it("renders a resizable image at its starting size, with a named handle per side and corner", () => {
		const html = renderMediaIsland(RESIZER);

		expect(html).toContain('class="media-island media-island-image-resize"');
		expect(html).toContain('data-slot="image-resizer"');
		expect(html).toContain("width:480px;height:360px");
		expect(html).toContain('alt="The welcome email"');
		expect(html.match(/data-slot="image-resizer-handle"/g)).toHaveLength(8);
		expect(html).toContain('aria-label="Resize from the bottom-right corner"');
		expect(payloadOf(html)).toEqual(RESIZER);
	});
});
