import { describe, expect, it } from "vitest";

import { GalleryFamilyIdSchema } from "@/components/component-gallery/gallery-catalog";
import { GALLERY_FAMILY_META } from "@/components/component-gallery/gallery-family-meta";

describe("GALLERY_FAMILY_META", () => {
	it("gives every family an icon, a tone and a summary", () => {
		for (const familyId of GalleryFamilyIdSchema.options) {
			const meta = GALLERY_FAMILY_META[familyId];
			expect(meta.icon, familyId).toBeDefined();
			expect(meta.summary.length, familyId).toBeGreaterThan(0);
		}
	});

	it("gives each family its own tone, so the overview tells them apart", () => {
		const tones = GalleryFamilyIdSchema.options.map((familyId) => GALLERY_FAMILY_META[familyId].tone);
		expect(new Set(tones).size).toBe(tones.length);
	});
});
