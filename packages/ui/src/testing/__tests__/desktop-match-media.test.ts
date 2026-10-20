import { afterEach, describe, expect, it } from "vitest";

import { desktopMediaQueryList, installDesktopMatchMedia } from "../desktop-match-media";

const original = globalThis.matchMedia;

afterEach(() => {
	globalThis.matchMedia = original;
});

describe("desktopMediaQueryList", () => {
	it("matches the desktop breakpoint only, never a max-width or reduced-motion query", () => {
		expect(desktopMediaQueryList("(min-width: 1024px)").matches).toBe(true);
		expect(desktopMediaQueryList("(min-width: 1024px) and (max-width: 1279px)").matches).toBe(false);
		expect(desktopMediaQueryList("(max-width: 767px)").matches).toBe(false);
		expect(desktopMediaQueryList("(prefers-reduced-motion: reduce)").matches).toBe(false);
		expect(desktopMediaQueryList("(min-width: 1024px)").media).toBe("(min-width: 1024px)");
	});

	it("installs itself as the global matchMedia", () => {
		installDesktopMatchMedia();

		expect(globalThis.matchMedia("(min-width: 1024px)").matches).toBe(true);
	});
});
