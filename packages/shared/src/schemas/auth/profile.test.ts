import { describe, expect, it } from "vitest";

import { apiContract } from "../../contracts";
import { apiRoutes } from "../../api-routes";
import {
	OWN_PROFILE_EDITABLE_FIELDS,
	OwnProfileEditableFieldsSchema,
	OwnProfileSchema,
	UpdateOwnProfileSchema,
	USER_FULL_NAME_MAX_LENGTH,
	USER_FULL_NAME_MIN_LENGTH,
	UserFullNameSchema,
} from "./profile";
import { UpdateUserSchema } from "./user";

const USER_ID = "4f0b7c62-3f7a-4c0e-9d8e-2f6a1b3c5d7e";
const AVATAR_FILE_ID = "9a1c2e4b-6d8f-4a0b-8c2d-4e6f8a0b2c4d";
const CREATED_AT_MS = 1_788_253_200_000;
const UPDATED_AT_MS = 1_788_253_260_000;

describe("UserFullNameSchema", () => {
	it("trims surrounding whitespace", () => {
		expect(UserFullNameSchema.parse("  Jane Doe  ")).toBe("Jane Doe");
	});

	it("accepts names in any script", () => {
		expect(UserFullNameSchema.parse("Zoë Ñúñez-李")).toBe("Zoë Ñúñez-李");
	});

	it("rejects a name that is shorter than the minimum once trimmed", () => {
		expect(UserFullNameSchema.safeParse(` ${"J".repeat(USER_FULL_NAME_MIN_LENGTH - 1)} `).success).toBe(false);
		expect(UserFullNameSchema.safeParse("   ").success).toBe(false);
	});

	it("accepts exactly the maximum length and rejects one more", () => {
		expect(UserFullNameSchema.safeParse("a".repeat(USER_FULL_NAME_MAX_LENGTH)).success).toBe(true);
		expect(UserFullNameSchema.safeParse("a".repeat(USER_FULL_NAME_MAX_LENGTH + 1)).success).toBe(false);
	});

	it("rejects control characters inside the name", () => {
		expect(UserFullNameSchema.safeParse("Jane\nDoe").success).toBe(false);
		expect(UserFullNameSchema.safeParse("Jane\u0000Doe").success).toBe(false);
	});
});

describe("OwnProfileEditableFieldsSchema", () => {
	it("lists exactly the editable fields", () => {
		expect(OWN_PROFILE_EDITABLE_FIELDS).toEqual(["fullName"]);
	});

	it("requires every editable field (the form edits the whole set)", () => {
		expect(OwnProfileEditableFieldsSchema.safeParse({}).success).toBe(false);
		expect(OwnProfileEditableFieldsSchema.parse({ fullName: " Jane " })).toEqual({ fullName: "Jane" });
	});
});

describe("UpdateOwnProfileSchema", () => {
	it("accepts a field change with the version it is based on", () => {
		expect(UpdateOwnProfileSchema.parse({ version: 3, fullName: "  Jane Doe " })).toEqual({ version: 3, fullName: "Jane Doe" });
	});

	it("requires the optimistic-lock version", () => {
		expect(UpdateOwnProfileSchema.safeParse({ fullName: "Jane Doe" }).success).toBe(false);
		expect(UpdateOwnProfileSchema.safeParse({ version: -1, fullName: "Jane Doe" }).success).toBe(false);
		expect(UpdateOwnProfileSchema.safeParse({ version: 1.5, fullName: "Jane Doe" }).success).toBe(false);
	});

	it("rejects a body that changes nothing", () => {
		expect(UpdateOwnProfileSchema.safeParse({ version: 0 }).success).toBe(false);
	});

	it("rejects fields a user may not change on their own profile", () => {
		expect(UpdateOwnProfileSchema.safeParse({ version: 0, fullName: "Jane Doe", email: "other@example.com" }).success).toBe(false);
		expect(UpdateOwnProfileSchema.safeParse({ version: 0, fullName: "Jane Doe", isSuperAdmin: true }).success).toBe(false);
	});

	it("validates the name with the shared rule", () => {
		expect(UpdateOwnProfileSchema.safeParse({ version: 0, fullName: "J" }).success).toBe(false);
	});
});

describe("OwnProfileSchema", () => {
	const profile = {
		id: USER_ID,
		email: "user@example.com",
		fullName: "Regular User",
		avatar: { fileId: AVATAR_FILE_ID, url: "https://cdn.example.com/users/avatar.png", updatedAt: UPDATED_AT_MS },
		version: 1,
		createdAt: CREATED_AT_MS,
		updatedAt: UPDATED_AT_MS,
	};

	it("parses a profile with an avatar", () => {
		expect(OwnProfileSchema.parse(profile)).toEqual(profile);
	});

	it("parses a profile without an avatar", () => {
		expect(OwnProfileSchema.parse({ ...profile, avatar: null }).avatar).toBeNull();
	});

	it("rejects an avatar whose URL is not absolute", () => {
		expect(OwnProfileSchema.safeParse({ ...profile, avatar: { ...profile.avatar, url: "users/avatar.png" } }).success).toBe(false);
	});

	it("strips keys it does not know (open response schema)", () => {
		expect(OwnProfileSchema.parse({ ...profile, passwordHash: "x" })).toEqual(profile);
	});
});

describe("own profile contract", () => {
	it("reads and edits the same route", () => {
		expect(apiContract.auth.profile).toMatchObject({ method: "GET", path: apiRoutes.auth.profile });
		expect(apiContract.auth.updateProfile).toMatchObject({ method: "PATCH", path: apiRoutes.auth.profile });
		expect(apiRoutes.auth.profile).toBe("/auth/profile");
	});
});

describe("UpdateUserSchema", () => {
	it("shares the full-name rule with the own-profile update", () => {
		expect(UpdateUserSchema.parse({ fullName: "  Jane Doe " })).toEqual({ fullName: "Jane Doe" });
		expect(UpdateUserSchema.safeParse({ fullName: "J" }).success).toBe(false);
	});
});
