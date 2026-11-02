import { describe, expect, it } from "vitest";

import type { DemoNotificationsOutcome } from "../../../src/contexts/notifications/application/services/demo-notifications";
import { describeDemoNotificationsOutcome, parseDemoNotificationsArgs } from "../notifications-demo";

describe("parseDemoNotificationsArgs", () => {
	it("defaults to the platform's only superadmin", () => {
		expect(parseDemoNotificationsArgs([])).toEqual({ kind: "sole-superadmin" });
	});

	it("reads --email in both spellings, trimmed", () => {
		expect(parseDemoNotificationsArgs(["--email", "jamie@example.com"])).toEqual({ kind: "email", email: "jamie@example.com" });
		expect(parseDemoNotificationsArgs(["--email= jamie@example.com "])).toEqual({ kind: "email", email: "jamie@example.com" });
	});

	it("refuses a missing or malformed address and any unknown flag", () => {
		expect(() => parseDemoNotificationsArgs(["--email"])).toThrow(/--email needs an email address/u);
		expect(() => parseDemoNotificationsArgs(["--email", "not-an-email"])).toThrow(/--email needs an email address/u);
		expect(() => parseDemoNotificationsArgs(["--to", "jamie@example.com"])).toThrow("Unknown argument: --to");
	});
});

describe("describeDemoNotificationsOutcome", () => {
	/** Three notifications sent, `handedOff` of them handed to the fan-out queue. */
	function sent(handedOff: number): DemoNotificationsOutcome {
		return { kind: "sent", email: "jamie@example.com", notificationIds: ["a", "b", "c"], handedOff };
	}

	it("says what was sent and where to look, delivered now when every one was handed off", () => {
		const report = describeDemoNotificationsOutcome({ kind: "sole-superadmin" }, sent(3));
		expect(report.ok).toBe(true);
		expect(report.message).toContain("Sent 3 notifications to jamie@example.com");
		expect(report.message).toContain("being delivered now");
		expect(report.message).toContain("admin panel");
	});

	it("points at the maintenance run when some were not handed off", () => {
		expect(describeDemoNotificationsOutcome({ kind: "sole-superadmin" }, sent(1)).message).toContain("maintenance run");
	});

	it("explains a wrong address and a missing or doubled superadmin, as failures", () => {
		const missing = describeDemoNotificationsOutcome({ kind: "email", email: "nobody@example.com" }, { kind: "not-found" });
		expect(missing.ok).toBe(false);
		expect(missing.message).toContain("No account uses nobody@example.com");
		expect(describeDemoNotificationsOutcome({ kind: "sole-superadmin" }, { kind: "ambiguous", superadmins: "none" }).message).toContain("no superadmin");
		expect(describeDemoNotificationsOutcome({ kind: "sole-superadmin" }, { kind: "ambiguous", superadmins: "several" }).message).toContain("more than one superadmin");
	});
});
