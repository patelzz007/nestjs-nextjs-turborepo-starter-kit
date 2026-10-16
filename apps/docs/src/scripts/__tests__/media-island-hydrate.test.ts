// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { MediaIslandPayload } from "@/lib/media/props";
import { renderMediaIsland } from "@/lib/media/render";

import { hydrateMediaIslands } from "../media-island-hydrate";

/** Observers report nothing in jsdom (it has no layout); the column width is read from `clientWidth`. */
class NoopObserver {
	public observe(): void {
		return undefined;
	}
	public unobserve(): void {
		return undefined;
	}
	public disconnect(): void {
		return undefined;
	}
}

const CAROUSEL: MediaIslandPayload = {
	kind: "carousel",
	props: {
		images: [
			{ src: "/images/email/welcome.png", alt: "The welcome email" },
			{ src: "/images/email/verification.png", alt: "The verification email" },
		],
		ratio: 16 / 9,
	},
};
const RESIZER: MediaIslandPayload = {
	kind: "image-resize",
	props: { image: { src: "/images/email/welcome.png", alt: "The welcome email" }, width: 480, height: 360, aspectRatio: 4 / 3 },
};

function frame(): HTMLElement {
	const element = document.querySelector<HTMLElement>('[data-slot="image-resizer"]');
	if (element === null) {
		throw new Error("no resizable image on the page");
	}
	return element;
}

async function hydrate(): Promise<number> {
	let count = 0;
	await act(async () => {
		count = hydrateMediaIslands();
		await Promise.resolve();
	});
	return count;
}

describe("hydrateMediaIslands", () => {
	beforeAll(() => {
		vi.stubGlobal("ResizeObserver", NoopObserver);
		vi.stubGlobal("IntersectionObserver", NoopObserver);
		window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() });
		HTMLElement.prototype.setPointerCapture = vi.fn();
		// React's `act` environment flag, so state updates flush inside act().
		Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		document.body.innerHTML = "";
	});

	it("hydrates a carousel and a resizable image from the build-time markup without mismatches", async () => {
		document.body.innerHTML = renderMediaIsland(CAROUSEL) + renderMediaIsland(RESIZER);
		const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

		expect(await hydrate()).toBe(2);
		expect(errors).not.toHaveBeenCalled();
		expect(document.querySelectorAll("[data-hydrated=true]")).toHaveLength(2);
	});

	it("lets the reader resize the image, keeping its shape", async () => {
		document.body.innerHTML = renderMediaIsland(RESIZER);
		await hydrate();
		const corner = document.querySelector<HTMLElement>('[data-handle="bottom-right"]');
		if (corner === null) {
			throw new Error("no bottom-right handle");
		}

		await act(async () => {
			corner.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, button: 0, clientX: 0, clientY: 0 }));
			corner.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 1, clientX: 80, clientY: 0 }));
			corner.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1, clientX: 80, clientY: 0 }));
			await Promise.resolve();
		});
		expect(frame().style.width).toBe("560px");
		expect(frame().style.height).toBe("420px");
	});

	it("fits the image into a column narrower than it", async () => {
		document.body.innerHTML = `<div id="column">${renderMediaIsland(RESIZER)}</div>`;
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(320);
		await hydrate();

		expect(frame().style.width).toBe("320px");
		expect(frame().style.height).toBe("240px");
	});

	it("skips containers that are already hydrated or have no payload", async () => {
		document.body.innerHTML = `<div><div data-media-island-root></div></div><div><div data-media-island-root data-hydrated="true"></div><script type="application/json" data-media-island-payload>{}</script></div>`;
		expect(await hydrate()).toBe(0);
	});
});
