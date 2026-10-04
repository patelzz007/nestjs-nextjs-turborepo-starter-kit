import { QueryClient } from "@tanstack/react-query";
import { epochMs, FILE_CATEGORY_POLICIES } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { envelopeFixture } from "../../../test/auth-fixtures";
import { apiRouter } from "../../api/endpoints";
import { AVATAR_ACCEPT, AvatarFileRejectedError, assertAvatarFileAllowed, refreshProfileAfterAvatarChange } from "./profile-avatar";

function fileOf(type: string, sizeBytes: number, name = "avatar.png"): File {
	return new File([new Uint8Array(sizeBytes)], name, { type });
}

function rejection(file: File): string | null {
	try {
		assertAvatarFileAllowed(file);
		return null;
	} catch (error) {
		return error instanceof AvatarFileRejectedError ? error.reason : "unexpected";
	}
}

describe("avatar file policy (from the shared USER_AVATAR contract)", () => {
	it("accepts exactly the contract's image types", () => {
		expect(AVATAR_ACCEPT.split(",")).toEqual(FILE_CATEGORY_POLICIES.USER_AVATAR.allowedMimeTypes);
	});

	it("accepts an allowed image within the size limit", () => {
		expect(rejection(fileOf("image/png", 1_024))).toBeNull();
		expect(rejection(fileOf("image/webp", FILE_CATEGORY_POLICIES.USER_AVATAR.maxBytes))).toBeNull();
	});

	it("rejects other types, empty files and oversized images before uploading", () => {
		expect(rejection(fileOf("application/pdf", 1_024, "cv.pdf"))).toBe("unsupported_type");
		expect(rejection(fileOf("image/gif", 1_024, "a.gif"))).toBe("unsupported_type");
		expect(rejection(fileOf("image/png", 0))).toBe("empty");
		expect(rejection(fileOf("image/png", FILE_CATEGORY_POLICIES.USER_AVATAR.maxBytes + 1))).toBe("too_large");
	});
});

describe("refreshProfileAfterAvatarChange", () => {
	it("reloads the profile, which reports the live avatar", async () => {
		const queryClient = new QueryClient();
		const key = apiRouter.auth.profile.queryKey(undefined);
		queryClient.setQueryData(
			key,
			envelopeFixture({
				id: "4f0b7c62-3f7a-4c0e-9d8e-2f6a1b3c5d7e",
				email: "user@example.com",
				fullName: "Regular User",
				avatar: null,
				version: 1,
				createdAt: epochMs(1_788_000_000_000),
				updatedAt: epochMs(1_788_000_000_000),
			}),
		);

		await refreshProfileAfterAvatarChange(queryClient);

		expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
		queryClient.clear();
	});
});
