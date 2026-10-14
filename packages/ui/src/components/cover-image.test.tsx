// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { COVER_IMAGE_DEFAULT_RATIO, CoverImage } from "./cover-image";

const COVER_URL = "https://cdn.example.com/stores/org-1/reward-covers/file-1.webp";
const OTHER_COVER_URL = "https://cdn.example.com/stores/org-1/reward-covers/file-2.webp";

/** The detached images the cover loads through (useImageLoadingStatus), so a test can finish a load. */
const loaders: HTMLImageElement[] = [];
const NativeImage = window.Image;

beforeEach((): void => {
	loaders.length = 0;
	window.Image = class extends NativeImage {
		public constructor() {
			super();
			loaders.push(this);
		}
	};
});

afterEach((): void => {
	cleanup();
	window.Image = NativeImage;
});

/** Finishes loading (or failing) the latest image the cover asked for. */
function finishLoad(event: "load" | "error"): void {
	const loader = loaders.at(-1);
	if (loader === undefined) {
		throw new Error("the cover started no load");
	}
	act((): void => {
		loader.dispatchEvent(new Event(event));
	});
}

function frame(): HTMLElement {
	const element = document.querySelector<HTMLElement>('[data-slot="cover-image"]');
	if (element === null) {
		throw new Error("cover-image frame not rendered");
	}
	return element;
}

function image(): HTMLImageElement {
	const element = frame().querySelector("img");
	if (element === null) {
		throw new Error("cover image not rendered");
	}
	return element;
}

describe("CoverImage", () => {
	it("crops the image into a 16:9 frame, loads it lazily and keeps it decorative by default", (): void => {
		render(<CoverImage src={COVER_URL} />);

		expect(image().getAttribute("src")).toBe(COVER_URL);
		expect(image().getAttribute("loading")).toBe("lazy");
		expect(image().getAttribute("alt")).toBe("");
		expect(image().className).toContain("object-cover");
		expect(frame().style.getPropertyValue("--ratio")).toBe(String(COVER_IMAGE_DEFAULT_RATIO));
		expect(screen.queryByRole("img")).toBeNull();
	});

	it("loads eagerly when it is the priority cover, and takes a described alt when the caller gives one", (): void => {
		render(<CoverImage src={COVER_URL} priority alt="Nyonya kuih platter" />);

		expect(image().getAttribute("loading")).toBe("eager");
		expect(screen.getByRole("img", { name: "Nyonya kuih platter" })).toBeDefined();
	});

	it("fades the image in only once it has loaded, and starts over for a new image", (): void => {
		const { rerender } = render(<CoverImage src={COVER_URL} />);
		expect(frame().dataset.state).toBe("loading");
		expect(image().className).toContain("opacity-0");

		finishLoad("load");
		expect(frame().dataset.state).toBe("loaded");
		expect(image().className).toContain("opacity-100");

		rerender(<CoverImage src={OTHER_COVER_URL} />);
		expect(frame().dataset.state).toBe("loading");
	});

	it("shows the fallback, never a broken image, when there is no image or it fails to load", (): void => {
		const { rerender } = render(<CoverImage src={COVER_URL} fallback={<span>No cover</span>} />);
		finishLoad("error");

		expect(frame().dataset.state).toBe("fallback");
		expect(frame().querySelector("img")).toBeNull();
		expect(screen.getByText("No cover")).toBeDefined();

		rerender(<CoverImage src={null} />);
		expect(frame().dataset.state).toBe("fallback");
		expect(frame().querySelector("svg")).not.toBeNull();
	});

	it("still names a described cover when it falls back", (): void => {
		render(<CoverImage src={null} alt="Nyonya kuih platter" />);

		expect(screen.getByText("Nyonya kuih platter").className).toContain("sr-only");
	});

	it("forwards its ref to the frame", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<CoverImage ref={ref} src={COVER_URL} />);

		expect(ref.current).toBe(frame());
	});
});

describe("CoverImage renditions", () => {
	it("offers every rendition as srcset, smallest first, sized to the frame", (): void => {
		render(
			<CoverImage
				src="https://cdn.example.com/a/uhd.webp"
				sources={[
					{ width: 3840, url: "https://cdn.example.com/a/uhd.webp" },
					{ width: 640, url: "https://cdn.example.com/a/thumbnail.webp" },
				]}
				sizes="(min-width: 1024px) 33vw, 100vw"
			/>,
		);

		expect(image().getAttribute("srcset")).toBe("https://cdn.example.com/a/thumbnail.webp 640w, https://cdn.example.com/a/uhd.webp 3840w");
		expect(image().getAttribute("sizes")).toBe("(min-width: 1024px) 33vw, 100vw");
	});

	it("falls back to the full viewport width, and sends no srcset without renditions", (): void => {
		const { rerender } = render(<CoverImage src="https://cdn.example.com/a/uhd.webp" sources={[{ width: 640, url: "https://cdn.example.com/a/thumbnail.webp" }]} />);
		expect(image().getAttribute("sizes")).toBe("100vw");

		rerender(<CoverImage src="https://cdn.example.com/a/uhd.webp" />);
		expect(image().hasAttribute("srcset")).toBe(false);
		expect(image().hasAttribute("sizes")).toBe(false);
	});
});
