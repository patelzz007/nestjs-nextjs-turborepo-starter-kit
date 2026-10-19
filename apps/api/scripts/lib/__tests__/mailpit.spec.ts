import { describe, expect, it } from "vitest";

import { extractLinks, extractVerificationCodes, formatMessage, newestMessageToPath, parseInboxArgs, type MailpitMessage } from "../mailpit";

const MESSAGE: MailpitMessage = {
	ID: "6QW7vrP77c9alcT3lie5fA",
	Subject: "Your sign-in code",
	Date: "2026-10-16T13:23:26.026Z",
	To: [{ Address: "jamie@example.com" }],
	Text: "Verification code: 482913\nOr open http://localhost:3000/verify?token=abc.\n",
};

describe("parseInboxArgs", () => {
	it("defaults to the newest email of the whole inbox, printed in full", () => {
		expect(parseInboxArgs([])).toEqual({ to: null, codeOnly: false });
	});

	it("reads --to in both spellings and --code", () => {
		expect(parseInboxArgs(["--to", "jamie@example.com", "--code"])).toEqual({ to: "jamie@example.com", codeOnly: true });
		expect(parseInboxArgs(["--to=jamie@example.com"])).toEqual({ to: "jamie@example.com", codeOnly: false });
	});

	it("refuses an unknown flag and a --to that is not an email", () => {
		expect(() => parseInboxArgs(["--from", "x"])).toThrow("Unknown argument: --from");
		expect(() => parseInboxArgs(["--to"])).toThrow("--to must be an email address");
		expect(() => parseInboxArgs(["--to", "jamie"])).toThrow("--to must be an email address");
	});
});

describe("newestMessageToPath", () => {
	it("searches by recipient, newest first, one result", () => {
		expect(newestMessageToPath("jamie+1@example.com")).toBe("/api/v1/search?query=to%3A%22jamie%2B1%40example.com%22&limit=1");
	});
});

describe("extractVerificationCodes", () => {
	it("finds every standalone six-digit code once, in order", () => {
		expect(extractVerificationCodes("Code 123456, again 123456, backup 654321")).toEqual(["123456", "654321"]);
	});

	it("ignores longer and shorter numbers", () => {
		expect(extractVerificationCodes("Order 1234567, PIN 12345, year 2026")).toEqual([]);
	});
});

describe("extractLinks", () => {
	it("finds each http(s) link once, without trailing punctuation", () => {
		expect(extractLinks("Open (https://app.example.com/reset?t=1) or http://localhost:3000/v?t=2 — https://app.example.com/reset?t=1")).toEqual([
			"https://app.example.com/reset?t=1",
			"http://localhost:3000/v?t=2",
		]);
	});
});

describe("formatMessage", () => {
	it("leads with recipient, subject, codes and links, then the body", () => {
		expect(formatMessage(MESSAGE)).toBe(
			[
				"To:      jamie@example.com",
				"Subject: Your sign-in code",
				"Date:    2026-10-16T13:23:26.026Z",
				"Codes:   482913",
				"Links:",
				"  http://localhost:3000/verify?token=abc",
				"",
				"Verification code: 482913\nOr open http://localhost:3000/verify?token=abc.",
			].join("\n"),
		);
	});

	it("says so when an email has no code, no links and no recipients", () => {
		expect(formatMessage({ ...MESSAGE, To: null, Text: "Your password was changed." })).toBe(
			["To:      ", "Subject: Your sign-in code", "Date:    2026-10-16T13:23:26.026Z", "Codes:   (none)", "", "Your password was changed."].join("\n"),
		);
	});
});
