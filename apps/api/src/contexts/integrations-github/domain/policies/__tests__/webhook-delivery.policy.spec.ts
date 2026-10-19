import { describe, expect, it } from "vitest";

import { isChangeOfRepository, readGithubDelivery } from "../webhook-delivery.policy";

const REPOSITORY_PAYLOAD = { repository: { name: "Hello-World", owner: { login: "Octo-Org" } } };

function body(payload: object): Buffer {
	return Buffer.from(JSON.stringify(payload));
}

function headers(
	event: string | undefined,
	deliveryId: string | undefined,
): { readonly event: string | undefined; readonly deliveryId: string | undefined; readonly signature: string } {
	return { event, deliveryId, signature: "verified elsewhere" };
}

describe("readGithubDelivery", () => {
	it("reads which pull request changed, and nothing else of the body", () => {
		expect(readGithubDelivery(headers("pull_request", "delivery-1"), body({ ...REPOSITORY_PAYLOAD, pull_request: { number: 42, title: "never read" } }))).toEqual({
			kind: "change",
			deliveryId: "delivery-1",
			event: "pull_request",
			change: { owner: "Octo-Org", repository: "Hello-World", number: 42 },
		});
	});

	it("reads a comment on a pull request by its issue number, and ignores one on an issue", () => {
		expect(readGithubDelivery(headers("issue_comment", "delivery-1"), body({ ...REPOSITORY_PAYLOAD, issue: { number: 7, pull_request: { url: "x" } } }))).toMatchObject({
			change: { number: 7 },
		});
		expect(readGithubDelivery(headers("issue_comment", "delivery-1"), body({ ...REPOSITORY_PAYLOAD, issue: { number: 8 } }))).toEqual({ kind: "ignored" });
	});

	it("reads a change GitHub did not tie to one pull request as the repository's", () => {
		expect(readGithubDelivery(headers("pull_request_review_thread", "delivery-1"), body(REPOSITORY_PAYLOAD))).toMatchObject({ change: { number: null } });
	});

	it("answers ping before reading anything", () => {
		expect(readGithubDelivery(headers("ping", undefined), Buffer.from("not json"))).toEqual({ kind: "ping" });
	});

	it.each<[string, string | undefined, string | undefined, Buffer]>([
		["an event the server does not use", "push", "delivery-1", body(REPOSITORY_PAYLOAD)],
		["no event header", undefined, "delivery-1", body(REPOSITORY_PAYLOAD)],
		["no delivery id", "pull_request", undefined, body(REPOSITORY_PAYLOAD)],
		["an empty delivery id", "pull_request", "", body(REPOSITORY_PAYLOAD)],
		["a delivery id past 64 characters", "pull_request", "d".repeat(65), body(REPOSITORY_PAYLOAD)],
		["a body that is not JSON", "pull_request", "delivery-1", Buffer.from("not json")],
		["a body without a repository", "pull_request", "delivery-1", body({ pull_request: { number: 1 } })],
		["a pull request number that is not positive", "pull_request", "delivery-1", body({ ...REPOSITORY_PAYLOAD, pull_request: { number: 0 } })],
	])("ignores %s", (_name, event, deliveryId, rawBody) => {
		expect(readGithubDelivery(headers(event, deliveryId), rawBody)).toEqual({ kind: "ignored" });
	});

	it("accepts a delivery id of exactly 64 characters", () => {
		expect(readGithubDelivery(headers("pull_request", "d".repeat(64)), body({ ...REPOSITORY_PAYLOAD, pull_request: { number: 1 } }))).toMatchObject({ kind: "change" });
	});
});

describe("isChangeOfRepository", () => {
	it("compares owner and repository without case", () => {
		const change = { owner: "Octo-Org", repository: "Hello-World", number: 1 };

		expect(isChangeOfRepository(change, { owner: "octo-org", repository: "hello-world" })).toBe(true);
		expect(isChangeOfRepository(change, { owner: "octo-org", repository: "other" })).toBe(false);
		expect(isChangeOfRepository(change, { owner: "someone", repository: "hello-world" })).toBe(false);
	});
});
