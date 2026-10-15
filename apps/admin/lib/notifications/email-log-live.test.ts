import { describe, expect, it } from "vitest";

import { emailLogEventsUrl } from "@/lib/notifications/email-log-live";

describe("emailLogEventsUrl", () => {
	it("points at the API's email-log SSE route from the shared route table", () => {
		expect(new URL(emailLogEventsUrl()).pathname).toMatch(/\/notifications\/email-log\/events$/);
	});

	it("declares the admin client type, so the API reads the admin's session cookie", () => {
		expect(new URL(emailLogEventsUrl()).searchParams.get("client_type")).toBe("admin");
	});
});
