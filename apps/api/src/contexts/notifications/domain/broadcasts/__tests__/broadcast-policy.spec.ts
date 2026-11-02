import type { RichTextDocument } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { broadcastLinkProblems, broadcastStartsAt, broadcastStatusesBefore, canMoveBroadcast, isoWeek, LOCAL_TIME_LEAD_MS, reportPauseThreshold } from "../broadcast-policy";

function documentWithLinks(...hrefs: string[]): RichTextDocument {
	return {
		type: "doc",
		content: hrefs.map((href) => ({ type: "paragraph", content: [{ type: "text", text: "link", marks: [{ type: "link", attrs: { href } }] }] })),
	};
}

describe("broadcastLinkProblems", () => {
	it("passes plain https links and names every link that may not be sent", () => {
		expect(broadcastLinkProblems(documentWithLinks("https://sunrise.example/menu"), [])).toEqual([]);
		expect(broadcastLinkProblems(documentWithLinks("http://sunrise.example", "https://bit.ly/x", "https://go.evil.example/a"), ["evil.example"])).toEqual([
			{ href: "http://sunrise.example", problem: "not-https" },
			{ href: "https://bit.ly/x", problem: "shortener" },
			{ href: "https://go.evil.example/a", problem: "blocked-domain" },
		]);
	});

	it("checks the call-to-action button too", () => {
		const document: RichTextDocument = { type: "doc", content: [{ type: "callToAction", attrs: { label: "Order", href: "https://tinyurl.com/x" } }] };

		expect(broadcastLinkProblems(document, [])).toEqual([{ href: "https://tinyurl.com/x", problem: "shortener" }]);
	});
});

describe("isoWeek", () => {
	it("follows ISO weeks across a year boundary", () => {
		expect(isoWeek(Date.UTC(2026, 9, 30))).toBe("2026-W44");
		expect(isoWeek(Date.UTC(2027, 0, 1))).toBe("2026-W53");
		expect(isoWeek(Date.UTC(2027, 0, 4))).toBe("2027-W01");
	});
});

describe("reportPauseThreshold", () => {
	it("pauses at 10 reports or 1% of the audience, whichever comes first, never at zero", () => {
		expect(reportPauseThreshold(50)).toBe(1);
		expect(reportPauseThreshold(500)).toBe(5);
		expect(reportPauseThreshold(100_000)).toBe(10);
	});
});

describe("the broadcast lifecycle", () => {
	it("allows only the documented moves", () => {
		expect(canMoveBroadcast("DRAFT", "SCHEDULED")).toBe(true);
		expect(canMoveBroadcast("SENDING", "CANCELLED")).toBe(false);
		expect(canMoveBroadcast("SENT", "SCHEDULED")).toBe(false);
		expect(broadcastStatusesBefore("CANCELLED")).toEqual(["DRAFT", "PENDING_APPROVAL", "SCHEDULED", "PAUSED"]);
	});

	it("starts a local-time broadcast early enough for the earliest time zone", () => {
		expect(broadcastStartsAt("INSTANT", 5_000, null, 1_000)).toBe(5_000);
		expect(broadcastStartsAt("INSTANT", null, null, 1_000)).toBe(1_000);
		expect(broadcastStartsAt("RECIPIENT_LOCAL_TIME", null, 100_000_000, 1_000)).toBe(100_000_000 - LOCAL_TIME_LEAD_MS);
	});
});
