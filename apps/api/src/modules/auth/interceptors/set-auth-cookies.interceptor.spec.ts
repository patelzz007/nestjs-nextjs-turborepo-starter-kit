import { describe, expect, it } from "vitest";

import { LoginTokenFieldsSchema } from "@workspace/shared";

describe("LoginTokenFieldsSchema", () => {
	it("extracts tokens from a login service response (extra user field)", (): void => {
		const parsed = LoginTokenFieldsSchema.safeParse({
			user: { id: "user-1", email: "a@b.com" },
			accessToken: "access-token",
			refreshToken: "refresh-token",
		});
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.data.accessToken).toBe("access-token");
		expect(parsed.data.refreshToken).toBe("refresh-token");
	});

	it("extracts tokens from a refresh response (extra message field)", (): void => {
		const parsed = LoginTokenFieldsSchema.safeParse({
			accessToken: "access-token",
			refreshToken: "refresh-token",
			message: "Tokens refreshed successfully",
		});
		expect(parsed.success).toBe(true);
		if (!parsed.success) return;
		expect(parsed.data.accessToken).toBe("access-token");
		expect(parsed.data.refreshToken).toBe("refresh-token");
	});
});
