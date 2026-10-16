import { DEFAULT_GALLERY_FAMILY, GALLERY_FAMILIES, nextGalleryFamily } from "../families";

describe("gallery families", () => {
	it("lists every family once, starting with the default", () => {
		const values = GALLERY_FAMILIES.map((family) => family.value);
		expect(new Set(values).size).toBe(values.length);
		expect(values).toContain(DEFAULT_GALLERY_FAMILY);
	});

	it("switches to a pressed family, and keeps the current one when none is reported", () => {
		expect(nextGalleryFamily("inputs", "media")).toBe("media");
		expect(nextGalleryFamily("dates", null)).toBe("dates");
	});
});
