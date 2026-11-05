import { COVER_IMAGE_DEFAULT_RATIO } from "@workspace/ui/components/cover-image";
import type { Root, RootContent } from "mdast";
import { describe, expect, it } from "vitest";

import {
	CAROUSEL_FENCE_LANGUAGE,
	carouselPayload,
	IMAGE_RESIZE_FENCE_LANGUAGE,
	imageResizePayload,
	MediaEmbedSyntaxError,
	parseFenceImages,
	parseRatio,
	remarkMediaEmbeds,
} from "../media-embeds";

const TWO_IMAGES = "![The welcome email](images/email/welcome.png)\n\n  ![](https://cdn.example.com/b.png)  \n";
const ONE_IMAGE = "![The welcome email](./images/email/welcome.png)";

function rootOf(children: RootContent[]): Root {
	return { type: "root", children };
}

function htmlOf(node: RootContent | undefined): string {
	return node?.type === "html" ? node.value : "";
}

describe("parseFenceImages", () => {
	it("reads one image per non-blank line, rewriting repo-relative paths like prose images", () => {
		expect(parseFenceImages(CAROUSEL_FENCE_LANGUAGE, TWO_IMAGES)).toEqual([
			{ src: "/images/email/welcome.png", alt: "The welcome email" },
			{ src: "https://cdn.example.com/b.png", alt: "" },
		]);
	});

	it("rejects a line that is not an image, naming it", () => {
		expect(() => parseFenceImages(CAROUSEL_FENCE_LANGUAGE, "![a](/a.png)\njust text")).toThrow(MediaEmbedSyntaxError);
		expect(() => parseFenceImages(CAROUSEL_FENCE_LANGUAGE, "![a](/a.png)\njust text")).toThrow("```carousel fence: line 2 is not an image");
	});
});

describe("parseRatio", () => {
	it("reads width/height or a single number", () => {
		expect(parseRatio(CAROUSEL_FENCE_LANGUAGE, "16/9")).toBe(16 / 9);
		expect(parseRatio(CAROUSEL_FENCE_LANGUAGE, " 1.5 ")).toBe(1.5);
	});

	it("rejects anything else", () => {
		expect(() => parseRatio(CAROUSEL_FENCE_LANGUAGE, "wide")).toThrow('ratio="wide"');
		expect(() => parseRatio(CAROUSEL_FENCE_LANGUAGE, "16/0")).toThrow(MediaEmbedSyntaxError);
		expect(() => parseRatio(CAROUSEL_FENCE_LANGUAGE, "0")).toThrow(MediaEmbedSyntaxError);
	});
});

describe("carouselPayload", () => {
	it("takes the fence's ratio, or the cover default", () => {
		expect(carouselPayload(TWO_IMAGES, 'ratio="4/3"')).toEqual({ kind: "carousel", props: { images: parseFenceImages(CAROUSEL_FENCE_LANGUAGE, TWO_IMAGES), ratio: 4 / 3 } });
		expect(carouselPayload(TWO_IMAGES, "")).toMatchObject({ props: { ratio: COVER_IMAGE_DEFAULT_RATIO } });
	});

	it("needs two images or more, at site paths or https URLs", () => {
		expect(() => carouselPayload(ONE_IMAGE, "")).toThrow();
		expect(() => carouselPayload("![a](/a.png)\n![b](http://insecure.example.com/b.png)", "")).toThrow();
	});
});

describe("imageResizePayload", () => {
	it("starts at the fence's size and keeps that shape", () => {
		expect(imageResizePayload(ONE_IMAGE, 'width="480" height="360"')).toEqual({
			kind: "image-resize",
			props: { image: { src: "/images/email/welcome.png", alt: "The welcome email" }, width: 480, height: 360, aspectRatio: 4 / 3 },
		});
	});

	it('lets the sides change independently with aspect="free"', () => {
		expect(imageResizePayload(ONE_IMAGE, 'width="480" height="360" aspect="free"')).toMatchObject({ props: { aspectRatio: null } });
	});

	it("needs exactly one image and a whole-pixel width and height", () => {
		expect(() => imageResizePayload(TWO_IMAGES, 'width="480" height="360"')).toThrow("takes exactly one image");
		expect(() => imageResizePayload("", 'width="480" height="360"')).toThrow("takes exactly one image");
		expect(() => imageResizePayload(ONE_IMAGE, 'height="360"')).toThrow('width="…"');
		expect(() => imageResizePayload(ONE_IMAGE, 'width="48.5" height="360"')).toThrow('width="…"');
		expect(() => imageResizePayload(ONE_IMAGE, 'width="10" height="360"')).toThrow();
	});
});

describe("remarkMediaEmbeds", () => {
	it("replaces carousel and image-resize fences with islands, leaving other code alone", () => {
		const root = rootOf([
			{ type: "code", lang: CAROUSEL_FENCE_LANGUAGE, meta: null, value: TWO_IMAGES },
			{ type: "code", lang: "ts", meta: null, value: "const a = 1;" },
			{ type: "code", lang: IMAGE_RESIZE_FENCE_LANGUAGE, meta: 'width="480" height="360"', value: ONE_IMAGE },
		]);
		remarkMediaEmbeds()(root);

		const [carousel, code, resizer] = root.children;
		expect(carousel?.type).toBe("html");
		expect(code?.type).toBe("code");
		expect(resizer?.type).toBe("html");
		expect(htmlOf(carousel)).toContain('data-slot="image-carousel"');
		expect(htmlOf(resizer)).toContain('data-slot="image-resizer"');
	});

	it("fails the build on a malformed fence", () => {
		const root = rootOf([{ type: "code", lang: IMAGE_RESIZE_FENCE_LANGUAGE, meta: null, value: ONE_IMAGE }]);
		expect(() => {
			remarkMediaEmbeds()(root);
		}).toThrow(MediaEmbedSyntaxError);
	});

	it("names its error after the fence", () => {
		const error = new MediaEmbedSyntaxError("carousel", "bad");
		expect(error.name).toBe("MediaEmbedSyntaxError");
		expect(error.message).toBe("```carousel fence: bad");
	});
});
