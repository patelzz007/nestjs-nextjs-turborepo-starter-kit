import { SessionSchema } from "@workspace/shared";

import { NOW_MS, sessionJson } from "../../../test/fixtures";
import { formatDateTime } from "../../lib/time-format";
import { clientTypeLabelOf, platformLineOf, sessionDetailItems } from "./session-details";

describe("device session details (§10.11)", () => {
	it("describes a phone by model and OS", () => {
		const phone = SessionSchema.parse(sessionJson({ id: "s-1", label: "Alex’s iPhone", clientType: "mobile" }));
		expect(clientTypeLabelOf(phone)).toBe("Mobile app");
		expect(platformLineOf(phone)).toBe("iPhone 15 Pro · iOS 26");
		const items = sessionDetailItems(phone, NOW_MS);
		expect(items.map((item) => item.label)).toEqual(["App", "Signed in with", "Sign-in IP", "Last seen from", "Signed in", "Last active", "Expires"]);
		expect(items.map((item) => item.value)).toEqual([
			"App 1.0.0",
			"Password + 2FA",
			"203.0.113.24",
			"198.51.100.7",
			formatDateTime(NOW_MS - 2 * 3_600_000),
			"1 hour ago",
			"in 1 day",
		]);
	});

	it("describes a browser by browser and OS major versions", () => {
		const browser = SessionSchema.parse(sessionJson({ id: "s-2", label: "Chrome 141 on macOS", clientType: "web" }));
		expect(clientTypeLabelOf(browser)).toBe("Web");
		expect(platformLineOf(browser)).toBe("Chrome 141 · macOS 16");
	});

	it("hides what the API does not know", () => {
		const legacy = SessionSchema.parse({
			...SessionSchema.parse(sessionJson({ id: "s-3", label: "Unknown device" })),
			clientType: null,
			browserName: null,
			browserVersion: null,
			osName: null,
			osVersion: null,
			appVersion: null,
			signInMethod: null,
			ipAddress: null,
			lastIpAddress: null,
			location: { country: "MY", region: null, city: "Petaling Jaya" },
		});
		expect(clientTypeLabelOf(legacy)).toBe("Unknown app");
		expect(platformLineOf(legacy)).toBe("");
		expect(sessionDetailItems(legacy, NOW_MS).map((item) => item.label)).toEqual(["Location", "Signed in", "Last active", "Expires"]);
		expect(sessionDetailItems(legacy, NOW_MS).at(0)?.value).toBe("Petaling Jaya, MY");
	});
});
