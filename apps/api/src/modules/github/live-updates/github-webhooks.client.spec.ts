import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { GithubWriteRejectedError } from "../github.errors";
import { GithubHttpTransport, type GithubCredential, type GithubFetch } from "../github-http.transport";
import { GithubWebhooksClient } from "./github-webhooks.client";

const LINKED: GithubCredential = { source: "linked", token: "github_pat_linked" };
const REPO = { owner: "octo-org", repository: "hello-world" };
const ENDPOINT = { url: "https://api.example.com/api/v1/github/webhook", secret: "s".repeat(40) };
const HOOKS = "https://api.github.com/repos/octo-org/hello-world/hooks";

function json(body: object | readonly object[], status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function client(fetchGithub: GithubFetch): GithubWebhooksClient {
	return new GithubWebhooksClient(new GithubHttpTransport(createTestTypedConfig({}), fetchGithub));
}

function calls(fetchGithub: ReturnType<typeof vi.fn<GithubFetch>>): readonly string[] {
	return fetchGithub.mock.calls.map(([url, init]) => `${init.method ?? "GET"} ${url}`);
}

const HookBodySchema = z.object({
	name: z.string().optional(),
	active: z.boolean(),
	events: z.array(z.string()),
	config: z.object({ url: z.string(), content_type: z.string(), secret: z.string(), insecure_ssl: z.string() }),
});

describe("GithubWebhooksClient", () => {
	it("registers a JSON web hook for the pull-request events, signed with the secret", async () => {
		const fetchGithub = vi
			.fn<GithubFetch>()
			.mockResolvedValueOnce(json([]))
			.mockResolvedValueOnce(json({ id: 12, config: { url: ENDPOINT.url } }, 201));

		await expect(client(fetchGithub).createHook(LINKED, REPO, ENDPOINT)).resolves.toBe(12n);

		expect(calls(fetchGithub)).toEqual([`GET ${HOOKS}?per_page=100`, `POST ${HOOKS}`]);
		const [, init] = fetchGithub.mock.calls.at(1) ?? ["", {}];
		expect(HookBodySchema.parse(JSON.parse(z.string().parse(init.body)))).toEqual({
			name: "web",
			active: true,
			events: ["pull_request", "pull_request_review", "pull_request_review_comment", "pull_request_review_thread", "issue_comment"],
			config: { url: ENDPOINT.url, content_type: "json", secret: ENDPOINT.secret, insecure_ssl: "0" },
		});
	});

	it("adopts a hook already delivering here and brings it up to date, instead of making a second", async () => {
		const fetchGithub = vi
			.fn<GithubFetch>()
			.mockResolvedValueOnce(
				json([
					{ id: 3, config: { url: "https://elsewhere.example.com" } },
					{ id: 9, config: { url: ENDPOINT.url } },
				]),
			)
			.mockResolvedValueOnce(json({ id: 9, config: { url: ENDPOINT.url } }));

		await expect(client(fetchGithub).createHook(LINKED, REPO, ENDPOINT)).resolves.toBe(9n);

		expect(calls(fetchGithub)).toEqual([`GET ${HOOKS}?per_page=100`, `PATCH ${HOOKS}/9`]);
	});

	it("names the Webhooks permission when the token may not register hooks", async () => {
		const fetchGithub = vi
			.fn<GithubFetch>()
			.mockResolvedValueOnce(json({ message: "Resource not accessible by personal access token" }, 403))
			.mockResolvedValueOnce(json({ message: "Resource not accessible by personal access token" }, 403));

		const creating = client(fetchGithub).createHook(LINKED, REPO, ENDPOINT);

		await expect(creating).rejects.toBeInstanceOf(GithubWriteRejectedError);
		await expect(creating).rejects.toThrow('Give it "Webhooks: Read and write" access');
	});

	it("re-points a hook to this server's address, and says when it is gone", async () => {
		const repointed = vi.fn<GithubFetch>(() => Promise.resolve(json({ id: 9, config: { url: ENDPOINT.url } })));
		const gone = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "Not Found" }, 404)));

		await expect(client(repointed).repointHook(LINKED, REPO, 9n, ENDPOINT)).resolves.toBe(true);
		await expect(client(gone).repointHook(LINKED, REPO, 9n, ENDPOINT)).resolves.toBe(false);
		expect(calls(repointed)).toEqual([`PATCH ${HOOKS}/9`]);
	});

	it("deletes the hook, and takes one already gone as done", async () => {
		const deleted = vi.fn<GithubFetch>(() => Promise.resolve(new Response(null, { status: 204 })));
		const gone = vi.fn<GithubFetch>(() => Promise.resolve(json({ message: "Not Found" }, 404)));

		await client(deleted).deleteHook(LINKED, REPO, 9n);
		await expect(client(gone).deleteHook(LINKED, REPO, 9n)).resolves.toBeUndefined();
		expect(calls(deleted)).toEqual([`DELETE ${HOOKS}/9`]);
	});

	it("tells whether the token can see a repository", async () => {
		const visible = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: { id: "R_1" } } })));
		const hidden = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: null } })));

		await expect(client(visible).canSee(LINKED, REPO)).resolves.toBe(true);
		await expect(client(hidden).canSee(LINKED, REPO)).resolves.toBe(false);
	});
});
