import { FILE_CATEGORY_POLICIES } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { assertImageFileAllowed, ImageFileRejectedError, imageFileRules, type ImageFileRejection, requireImageRules } from "./image-file-rules";

const COVER_POLICY = FILE_CATEGORY_POLICIES.REWARD_IMAGE;

function rejection(file: File): ImageFileRejection | "accepted" | "unexpected" {
	try {
		assertImageFileAllowed(file, COVER_POLICY);
		return "accepted";
	} catch (error) {
		return error instanceof ImageFileRejectedError ? error.reason : "unexpected";
	}
}

function fileOf(sizeBytes: number, type: string): File {
	return new File([new Uint8Array(sizeBytes)], "cover", { type });
}

describe("image file rules", () => {
	it("describes the file input from the category policy", () => {
		expect(imageFileRules(COVER_POLICY)).toEqual({ accept: COVER_POLICY.allowedMimeTypes.join(","), maxMebibytes: 10 });
	});

	it("accepts an image of an allowed type within the size limit", () => {
		expect(rejection(fileOf(1024, "image/webp"))).toBe("accepted");
		expect(rejection(fileOf(COVER_POLICY.maxBytes, "image/jpeg"))).toBe("accepted");
	});

	it("rejects other types, empty files and files over the limit — before anything is uploaded", () => {
		expect(rejection(fileOf(1024, "application/pdf"))).toBe("unsupported_type");
		expect(rejection(fileOf(1024, "image/gif"))).toBe("unsupported_type");
		expect(rejection(fileOf(0, "image/png"))).toBe("empty");
		expect(rejection(fileOf(COVER_POLICY.maxBytes + 1, "image/png"))).toBe("too_large");
	});

	it("explains a size rejection with the limit in MB", () => {
		expect(() => {
			assertImageFileAllowed(fileOf(COVER_POLICY.maxBytes + 1, "image/png"), COVER_POLICY);
		}).toThrow("The image must be at most 10 MB.");
	});
});

describe("requireImageRules", () => {
	it("returns a category's pixel rules", () => {
		expect(requireImageRules(FILE_CATEGORY_POLICIES.STORE_LOGO)).toMatchObject({ aspectWidth: 1, aspectHeight: 1 });
	});

	it("refuses a category without pixel rules, naming it", () => {
		expect(() => requireImageRules(FILE_CATEGORY_POLICIES.MERCHANT_KYB)).toThrow("The MERCHANT_KYB policy must declare image rules");
	});
});
