import { describe, expect, it } from "vitest";

import {
	describeImageDimensionProblem,
	FILE_CATEGORY_POLICIES,
	type FileCategory,
	findImageDimensionProblem,
	type ImageRules,
	largestRenditionWidth,
	renditionsForWidth,
} from "../storage";

function rewardImageRules(): ImageRules {
	const rules = FILE_CATEGORY_POLICIES.REWARD_IMAGE.imageRules;
	if (rules === undefined) {
		throw new Error("REWARD_IMAGE must declare image rules");
	}
	return rules;
}

describe("reward image rules", () => {
	const rules = rewardImageRules();

	it("are 16:9 at Full HD or more, published in renditions from 640 up to 3840 wide", () => {
		expect(rules).toMatchObject({ aspectWidth: 16, aspectHeight: 9, minWidth: 1920, minHeight: 1080 });
		expect(rules.variants.map((variant) => variant.width)).toEqual([640, 1280, 1920, 2560, 3840]);
	});

	it("accept a Full HD or larger 16:9 image, absorbing a pixel of crop rounding", () => {
		expect(findImageDimensionProblem(1920, 1080, rules)).toBeNull();
		expect(findImageDimensionProblem(2560, 1440, rules)).toBeNull();
		expect(findImageDimensionProblem(3840, 2160, rules)).toBeNull();
		expect(findImageDimensionProblem(7680, 4320, rules)).toBeNull();
		expect(findImageDimensionProblem(3841, 2160, rules)).toBeNull();
	});

	it("reject any other shape before checking the size", () => {
		expect(findImageDimensionProblem(4032, 3024, rules)).toBe("aspect_ratio");
		expect(findImageDimensionProblem(2160, 3840, rules)).toBe("aspect_ratio");
		expect(findImageDimensionProblem(1000, 0, rules)).toBe("aspect_ratio");
	});

	it("reject a 16:9 image smaller than Full HD", () => {
		expect(findImageDimensionProblem(1280, 720, rules)).toBe("too_small");
		expect(findImageDimensionProblem(1904, 1071, rules)).toBe("too_small");
	});

	it("yield only the renditions an image is wide enough for, so none is upscaled", () => {
		const widths = (width: number): number[] => renditionsForWidth(width, rules).map((variant) => variant.width);
		expect(widths(1920)).toEqual([640, 1280, 1920]);
		expect(widths(3000)).toEqual([640, 1280, 1920, 2560]);
		expect(widths(3840)).toEqual([640, 1280, 1920, 2560, 3840]);
		expect(widths(7680)).toEqual([640, 1280, 1920, 2560, 3840]);
	});

	it("always yield at least one rendition for the smallest accepted image", () => {
		expect(renditionsForWidth(rules.minWidth, rules).length).toBeGreaterThan(0);
	});

	it("name the widest rendition, the most detail worth uploading", () => {
		expect(largestRenditionWidth(rules)).toBe(3840);
	});

	it("explain each problem in the uploader's terms", () => {
		expect(describeImageDimensionProblem("aspect_ratio", rules)).toBe("Images must be 16:9 (landscape).");
		expect(describeImageDimensionProblem("too_small", rules)).toBe("Images must be at least 1920 × 1080 pixels so they stay sharp on every screen.");
	});
});

describe("avatar and store logo rules", () => {
	it.each<Extract<FileCategory, "USER_AVATAR" | "STORE_LOGO">>(["USER_AVATAR", "STORE_LOGO"])("make a %s square, at least 256 × 256", (category) => {
		const rules = FILE_CATEGORY_POLICIES[category].imageRules;
		expect(rules).toMatchObject({ aspectWidth: 1, aspectHeight: 1, minWidth: 256, minHeight: 256 });
		expect(rules === undefined ? null : findImageDimensionProblem(512, 512, rules)).toBeNull();
		expect(rules === undefined ? null : findImageDimensionProblem(512, 300, rules)).toBe("aspect_ratio");
		expect(rules === undefined ? null : findImageDimensionProblem(200, 200, rules)).toBe("too_small");
	});

	it("publish an avatar up to 512 wide and a logo up to 1024", () => {
		const avatar = FILE_CATEGORY_POLICIES.USER_AVATAR.imageRules;
		const logo = FILE_CATEGORY_POLICIES.STORE_LOGO.imageRules;
		expect(avatar === undefined ? null : largestRenditionWidth(avatar)).toBe(512);
		expect(logo === undefined ? null : largestRenditionWidth(logo)).toBe(1024);
	});

	it("name a square shape as square in the uploader's words", () => {
		const rules = FILE_CATEGORY_POLICIES.USER_AVATAR.imageRules;
		expect(rules === undefined ? null : describeImageDimensionProblem("aspect_ratio", rules)).toBe("Images must be 1:1 (square).");
		expect(rules === undefined ? null : describeImageDimensionProblem("too_small", rules)).toBe(
			"Images must be at least 256 × 256 pixels so they stay sharp on every screen.",
		);
	});
});
