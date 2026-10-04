import { ApiError } from "@workspace/client/lib/api/use-api";
import { describe, expect, it } from "vitest";

import {
	isCompleteVerificationCode,
	resolveTeamInviteFormError,
	sanitizeVerificationCode,
	TEAM_INVITE_PREVIEW_QUERY_SCOPE,
	VERIFICATION_CODE_LENGTH,
} from "@/lib/team-invite/invite-form";

describe("team invite form helpers", () => {
	it("takes the code length from the shared schema", () => {
		expect(VERIFICATION_CODE_LENGTH).toBe(6);
	});

	it("keeps only digits, up to the code length", () => {
		expect(sanitizeVerificationCode("12a3-45 6789")).toBe("123456");
	});

	it("accepts only a complete code", () => {
		expect(isCompleteVerificationCode("123456")).toBe(true);
		expect(isCompleteVerificationCode("12345")).toBe(false);
	});

	it("explains a missing invitation in production terms — no developer instructions", () => {
		const message = resolveTeamInviteFormError(new ApiError({ message: "Not found", statusCode: 404 }));

		expect(message).toContain("ask your organization admin");
		expect(message).not.toMatch(/dev server|deployed/iu);
	});

	it("never puts an invite token in the preview's cache key", () => {
		expect(TEAM_INVITE_PREVIEW_QUERY_SCOPE.join("/")).toBe("merchant/team-invite/preview");
	});
});
