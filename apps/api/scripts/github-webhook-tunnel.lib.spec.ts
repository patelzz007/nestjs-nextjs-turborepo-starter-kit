import { describe, expect, it } from "vitest";

import { envValue, webhookUrlFor, withEnvValue } from "./github-webhook-tunnel.lib";

describe("webhookUrlFor", () => {
	it("puts the receiver under a quick tunnel's address", () => {
		expect(webhookUrlFor("https://calm-river-1234.trycloudflare.com")).toBe("https://calm-river-1234.trycloudflare.com/api/v1/github/webhook");
		expect(webhookUrlFor("https://calm-river-1234.trycloudflare.com/")).toBe("https://calm-river-1234.trycloudflare.com/api/v1/github/webhook");
	});

	it.each(["http://calm-river.trycloudflare.com", "https://example.com", "https://evil.trycloudflare.com.example.com", "not a url"])("refuses %s", (url: string) => {
		expect(() => webhookUrlFor(url)).toThrow();
	});
});

describe("withEnvValue", () => {
	it("replaces a set or commented-out line in place, keeping the rest of the file", () => {
		const env = "# Live updates\n# GITHUB_WEBHOOK_URL=\nGITHUB_WEBHOOK_SECRET=abc\nOTHER=1\n";

		expect(withEnvValue(env, "GITHUB_WEBHOOK_URL", "https://x.trycloudflare.com/api/v1/github/webhook")).toBe(
			"# Live updates\nGITHUB_WEBHOOK_URL=https://x.trycloudflare.com/api/v1/github/webhook\nGITHUB_WEBHOOK_SECRET=abc\nOTHER=1\n",
		);
		expect(withEnvValue(env, "GITHUB_WEBHOOK_SECRET", "def")).toBe("# Live updates\n# GITHUB_WEBHOOK_URL=\nGITHUB_WEBHOOK_SECRET=def\nOTHER=1\n");
	});

	it("appends a variable the file does not have", () => {
		expect(withEnvValue("A=1", "B", "2")).toBe("A=1\nB=2\n");
		expect(withEnvValue("", "B", "2")).toBe("B=2\n");
	});

	it("refuses a name that is not an environment variable", () => {
		expect(() => withEnvValue("", "a.b", "1")).toThrow();
	});
});

describe("envValue", () => {
	it("reads a set value and ignores a commented-out one", () => {
		expect(envValue("# A=1\nA=2\n", "A")).toBe("2");
		expect(envValue("# A=1\n", "A")).toBeNull();
	});
});
