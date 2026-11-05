import { describe, expect, it } from "vitest";

import { DocsImageUrlSchema, MAX_CAROUSEL_IMAGES, parseMediaIslandPayload, serializeMediaIslandPayload, type DocsImage, type MediaIslandPayload } from "../props";

const IMAGE: DocsImage = { src: "/images/email/welcome.png", alt: "The welcome email" };

const CAROUSEL: MediaIslandPayload = { kind: "carousel", props: { images: [IMAGE, { src: "https://cdn.example.com/b.png", alt: "" }], ratio: 16 / 9 } };
const RESIZER: MediaIslandPayload = { kind: "image-resize", props: { image: IMAGE, width: 480, height: 360, aspectRatio: 4 / 3 } };

describe("DocsImageUrlSchema", () => {
	it("takes site paths and https URLs only", () => {
		expect(DocsImageUrlSchema.safeParse("/images/a.png").success).toBe(true);
		expect(DocsImageUrlSchema.safeParse("https://cdn.example.com/a.png").success).toBe(true);
		expect(DocsImageUrlSchema.safeParse("//evil.example.com/a.png").success).toBe(false);
		expect(DocsImageUrlSchema.safeParse("http://cdn.example.com/a.png").success).toBe(false);
		expect(DocsImageUrlSchema.safeParse("javascript:alert(1)").success).toBe(false);
	});
});

describe("media island payloads", () => {
	it("round-trip through the page", () => {
		expect(parseMediaIslandPayload(serializeMediaIslandPayload(CAROUSEL))).toEqual(CAROUSEL);
		expect(parseMediaIslandPayload(serializeMediaIslandPayload(RESIZER))).toEqual(RESIZER);
	});

	it("escape `<` so a payload can never close its script tag", () => {
		const payload: MediaIslandPayload = { kind: "image-resize", props: { ...RESIZER.props, image: { src: "/a.png", alt: "</script><b>" } } };
		const json = serializeMediaIslandPayload(payload);
		expect(json).not.toContain("<");
		expect(parseMediaIslandPayload(json)).toEqual(payload);
	});

	it("reject what the build would never produce", () => {
		expect(() => parseMediaIslandPayload(JSON.stringify({ kind: "carousel", props: { images: [IMAGE], ratio: 1 } }))).toThrow();
		const tooMany = Array.from({ length: MAX_CAROUSEL_IMAGES + 1 }, (): DocsImage => IMAGE);
		expect(() => parseMediaIslandPayload(JSON.stringify({ kind: "carousel", props: { images: tooMany, ratio: 1 } }))).toThrow();
		expect(() => parseMediaIslandPayload(JSON.stringify({ kind: "image-resize", props: { ...RESIZER.props, width: 10 } }))).toThrow();
		expect(() => parseMediaIslandPayload(JSON.stringify({ kind: "video", props: {} }))).toThrow();
		expect(() => parseMediaIslandPayload(JSON.stringify({ ...RESIZER, extra: true }))).toThrow();
	});
});
