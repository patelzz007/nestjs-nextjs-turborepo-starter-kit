import { SessionRevokedBySchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { revokedBySystem, revokedByUser, sessionRevokerColumn } from "./session-revoker";

const USER_ID = "4b0a6f0e-8c1e-4d47-9a51-0d3f3f9b2c11";

describe("sessionRevokerColumn", () => {
	it("records a user revocation as the user's id", () => {
		expect(sessionRevokerColumn(revokedByUser(USER_ID))).toBe(USER_ID);
	});

	it("records a system revocation as its closed marker", () => {
		expect(sessionRevokerColumn(revokedBySystem("system:rotation-reuse"))).toBe("system:rotation-reuse");
	});

	it("always writes a value the shared deletedBy schema accepts", () => {
		expect(SessionRevokedBySchema.parse(sessionRevokerColumn(revokedByUser(USER_ID)))).toBe(USER_ID);
		expect(SessionRevokedBySchema.parse(sessionRevokerColumn(revokedBySystem("system:session-limit")))).toBe("system:session-limit");
	});
});
