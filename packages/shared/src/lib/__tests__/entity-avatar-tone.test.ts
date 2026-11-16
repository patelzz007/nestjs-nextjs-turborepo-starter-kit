import { describe, expect, it } from "vitest";

import { ENTITY_AVATAR_TONES, getEntityAvatarTone } from "../entity-avatar-tone";

describe("getEntityAvatarTone", () => {
	it("gives a name the same saturated chart tint every time, ignoring case and surrounding space", () => {
		expect(getEntityAvatarTone("Acme Coffee")).toBe(getEntityAvatarTone("  acme coffee "));
		expect(ENTITY_AVATAR_TONES).toContain(getEntityAvatarTone("Bayview Books"));
	});

	it("spreads different names over the tints", () => {
		const tones = new Set(["Acme Coffee", "Bayview Books", "Corner Bakery", "Delta Fitness", "Echo Labs", "Fern Studio"].map(getEntityAvatarTone));
		expect(tones.size).toBeGreaterThan(1);
		expect(getEntityAvatarTone("")).toBe("chart-1");
	});
});
