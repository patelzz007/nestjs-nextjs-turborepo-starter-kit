import { describe, expect, it } from "vitest";

import { notificationLinkTarget } from "../notification-link";

describe("notificationLinkTarget", () => {
	it("keeps an app path in the app", () => {
		expect(notificationLinkTarget("/rewards/0193f2c4-0000-7000-8000-000000000001")).toEqual({ kind: "internal", href: "/rewards/0193f2c4-0000-7000-8000-000000000001" });
	});

	it("opens an https page elsewhere", () => {
		expect(notificationLinkTarget("https://example.com/menu")).toEqual({ kind: "external", href: "https://example.com/menu" });
	});

	it("keeps an https page of this app's own origin in the app", () => {
		expect(notificationLinkTarget("https://admin.example.com/operations/alerts?status=OPEN#top", "https://admin.example.com")).toEqual({
			kind: "internal",
			href: "/operations/alerts?status=OPEN#top",
		});
		expect(notificationLinkTarget("https://admin.example.com/operations/alerts", "https://app.example.com")).toEqual({
			kind: "external",
			href: "https://admin.example.com/operations/alerts",
		});
	});

	it("leads nowhere for no link, a protocol-relative URL, another protocol or plain text", () => {
		expect(notificationLinkTarget(null)).toBeNull();
		expect(notificationLinkTarget("")).toBeNull();
		expect(notificationLinkTarget("//evil.example/path")).toBeNull();
		expect(notificationLinkTarget("http://example.com")).toBeNull();
		expect(notificationLinkTarget("javascript:alert(1)")).toBeNull();
		expect(notificationLinkTarget("rewards")).toBeNull();
	});
});
