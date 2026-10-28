import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { AGENT_TOKEN_MARKER, AGENT_TOKEN_PREFIX_LENGTH, bearerToken, hashAgentToken, issueAgentToken } from "../policies/agent-token.policy";

describe("agent tokens", () => {
	it("issues a marked, random token with its sha256 digest and clear prefix", () => {
		const issued = issueAgentToken();

		expect(issued.token.startsWith(AGENT_TOKEN_MARKER)).toBe(true);
		expect(issued.hash).toBe(createHash("sha256").update(issued.token).digest("hex"));
		expect(issued.prefix).toBe(issued.token.slice(0, AGENT_TOKEN_PREFIX_LENGTH));
		expect(issueAgentToken().token).not.toBe(issued.token);
	});

	it("hashes the same token to the same digest", () => {
		expect(hashAgentToken("opsagent_a")).toBe(hashAgentToken("opsagent_a"));
		expect(hashAgentToken("opsagent_a")).not.toBe(hashAgentToken("opsagent_b"));
	});

	it("reads the bearer token of an Authorization header", () => {
		expect(bearerToken("Bearer opsagent_x")).toBe("opsagent_x");
		expect(bearerToken("bearer   opsagent_x")).toBe("opsagent_x");
		expect(bearerToken("Basic abc")).toBeNull();
		expect(bearerToken("Bearer two words")).toBeNull();
		expect(bearerToken(undefined)).toBeNull();
	});
});
