import { FILE_CATEGORY_POLICIES, type ImageRules } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { aspectOf, canReachMinimum, describeCropProblem, hasExactAspect, initialImageCrop, preparedImageSize } from "../image-preparation";

function rewardImageRules(): ImageRules {
	const rules = FILE_CATEGORY_POLICIES.REWARD_IMAGE.imageRules;
	if (rules === undefined) {
		throw new Error("REWARD_IMAGE must declare image rules");
	}
	return rules;
}

describe("image preparation", () => {
	const rules = rewardImageRules();

	it("reads the aspect ratio from the rules", () => {
		expect(aspectOf(rules)).toBeCloseTo(16 / 9);
	});

	it("accepts only photos that can give a Full HD image, at least zoomed out to show all of them", () => {
		expect(canReachMinimum(4032, 3024, rules)).toBe(true);
		expect(canReachMinimum(1920, 1080, rules)).toBe(true);
		expect(canReachMinimum(1600, 1200, rules)).toBe(true);
		expect(canReachMinimum(1080, 1920, rules)).toBe(true);
		expect(canReachMinimum(1280, 720, rules)).toBe(false);
		expect(canReachMinimum(800, 1000, rules)).toBe(false);
	});

	it("needs no crop step for a photo that is already 16:9, whatever its size", () => {
		expect(hasExactAspect(3840, 2160, rules)).toBe(true);
		expect(hasExactAspect(1920, 1080, rules)).toBe(true);
		expect(hasExactAspect(4032, 3024, rules)).toBe(false);
	});

	it("explains a crop that would not be sharp at Full HD, in the API's words", () => {
		expect(describeCropProblem({ x: 0, y: 0, width: 1920, height: 1080 }, rules)).toBeNull();
		expect(describeCropProblem({ x: 0, y: 0, width: 1280, height: 720 }, rules)).toBe("Images must be at least 1920 × 1080 pixels so they stay sharp on every screen.");
	});

	it("exports a crop at its own size, never upscaled, never past 4K, and exactly 16:9", () => {
		expect(preparedImageSize({ width: 1920 }, rules)).toEqual({ width: 1920, height: 1080 });
		expect(preparedImageSize({ width: 1921 }, rules)).toEqual({ width: 1920, height: 1080 });
		expect(preparedImageSize({ width: 2400 }, rules)).toEqual({ width: 2400, height: 1350 });
		expect(preparedImageSize({ width: 3840 }, rules)).toEqual({ width: 3840, height: 2160 });
		expect(preparedImageSize({ width: 5760 }, rules)).toEqual({ width: 3840, height: 2160 });
	});

	it("starts a large photo on the widest crop that fills the frame, centred", () => {
		expect(initialImageCrop({ width: 4032, height: 3024 }, rules)).toEqual({ x: 0, y: 378, width: 4032, height: 2268 });
	});

	it("starts a photo too small to fill the minimum frame at the minimum, the photo centred inside it", () => {
		expect(initialImageCrop({ width: 1600, height: 1200 }, rules)).toEqual({ x: -160, y: 60, width: 1920, height: 1080 });
	});

	it("starts a square shape on the photo's centre square", () => {
		const avatar = FILE_CATEGORY_POLICIES.USER_AVATAR.imageRules;
		expect(avatar === undefined ? null : initialImageCrop({ width: 1200, height: 800 }, avatar)).toEqual({ x: 200, y: 0, width: 800, height: 800 });
	});
});
