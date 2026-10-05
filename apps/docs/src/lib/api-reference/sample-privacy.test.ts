import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { findNonTemplateEmailAddresses, neutralizeEmailAddresses } from "./sample-privacy";

const REPOSITORY_ROOT: string = path.resolve(import.meta.dirname, "../../../../..");

describe("findNonTemplateEmailAddresses", () => {
	it("accepts documentation and seed demo domains", () => {
		expect(findNonTemplateEmailAddresses("superadmin@example.com, brew.owner@kl-rewards.demo, ops@mail.example, a@example.org, dev@localhost.dev")).toEqual([
			"dev@localhost.dev",
		]);
	});

	it("reports real-world addresses once each, sorted", () => {
		expect(findNonTemplateEmailAddresses("noreply@company.io … Reach us at noreply@company.io or ME@Gmail.com")).toEqual(["ME@Gmail.com", "noreply@company.io"]);
	});
});

describe("neutralizeEmailAddresses", () => {
	it("moves personal addresses to the documentation domain and keeps template ones", () => {
		expect(neutralizeEmailAddresses("From noreply@company.io to Someone.Real@gmail.com, cc brew.owner@kl-rewards.demo")).toBe(
			"From noreply@example.com to recipient@example.com, cc brew.owner@kl-rewards.demo",
		);
	});

	it("leaves nothing for the guard to report", () => {
		expect(findNonTemplateEmailAddresses(neutralizeEmailAddresses("a@corp.io b@gmail.com"))).toEqual([]);
	});
});

describe("committed API samples", () => {
	it("contain no personal email address (capture with neutral EMAIL_FROM_ADDRESS; see scripts/capture-api-samples.mjs)", () => {
		const samples: string = readFileSync(path.join(REPOSITORY_ROOT, "docs/generated/api-samples.json"), "utf8");

		expect(findNonTemplateEmailAddresses(samples)).toEqual([]);
	});
});
