import { describe, expect, it } from "vitest";

import { emailLogEventsUrl } from "@/lib/notifications/email-log-live";

describe("emailLogEventsUrl", () => {
	it("points at the API's email-log SSE route from the shared route table", () => {
		expect(new URL(emailLogEventsUrl()).pathname).toMatch(/\/notifications\/email-log\/events$/);
	});
});
