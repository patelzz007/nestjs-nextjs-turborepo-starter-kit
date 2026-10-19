import { Logger } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { GITHUB_REST_API_VERSION } from "../github.constants";
import {
	contentTarget,
	GithubContentNotFoundError,
	GithubLinkedTokenRejectedError,
	GithubPullRequestNotFoundError,
	GithubResponseError,
	pullRequestTarget,
} from "../../../application/errors/github.errors";
import { GithubHttpTransport, type GithubCredential, type GithubFetch } from "../github-http.transport";
import { GraphqlErrorsWireSchema } from "../github.wire-schemas";

const URL = "https://api.github.com/repos/octo-org/hello-world/pulls/42";
const PULL_REQUEST = { owner: "octo-org", repository: "hello-world", number: 42 };
const LINKED: GithubCredential = { source: "linked", token: "github_pat_linked" };
const SERVER: GithubCredential = { source: "server", token: "github_pat_server" };

function transport(fetchGithub: GithubFetch): GithubHttpTransport {
	return new GithubHttpTransport(createTestTypedConfig({}), fetchGithub);
}

function answering(status: number): ReturnType<typeof vi.fn<GithubFetch>> {
	return vi.fn<GithubFetch>(() => Promise.resolve(new Response("{}", { status })));
}

describe("GithubHttpTransport", () => {
	beforeEach(() => {
		vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);
		vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("sends the credential it is given, with GitHub's API version", async () => {
		const fetchGithub = answering(200);

		await transport(fetchGithub).send(LINKED, URL, { method: "GET" }, pullRequestTarget(PULL_REQUEST));

		const [[, init] = ["", {}]] = fetchGithub.mock.calls;
		expect(init.headers).toMatchObject({ Authorization: "Bearer github_pat_linked", "X-GitHub-Api-Version": GITHUB_REST_API_VERSION });
	});

	it("tells its owner to link a new token when GitHub refuses a linked one", async () => {
		await expect(transport(answering(401)).send(LINKED, URL, { method: "GET" }, pullRequestTarget(PULL_REQUEST))).rejects.toBeInstanceOf(GithubLinkedTokenRejectedError);
	});

	it("treats GitHub refusing the server's own token as a broken integration (502), as before", async () => {
		const failure = transport(answering(401)).send(SERVER, URL, { method: "GET" }, pullRequestTarget(PULL_REQUEST));

		await expect(failure).rejects.toBeInstanceOf(GithubResponseError);
	});

	it("answers 404 for a pull request or a comment the token cannot see", async () => {
		await expect(transport(answering(404)).send(LINKED, URL, { method: "GET" }, pullRequestTarget(PULL_REQUEST))).rejects.toBeInstanceOf(GithubPullRequestNotFoundError);
		await expect(transport(answering(404)).send(LINKED, URL, { method: "GET" }, contentTarget("IC_abc"))).rejects.toBeInstanceOf(GithubContentNotFoundError);
	});

	it("treats a GraphQL NOT_FOUND on a pull request as a 404", async () => {
		const fetchGithub = vi.fn<GithubFetch>(() =>
			Promise.resolve(new Response(JSON.stringify({ data: null, errors: [{ type: "NOT_FOUND", message: "nope" }] }), { status: 200 })),
		);
		const schema = z.object({ errors: GraphqlErrorsWireSchema.optional() });

		await expect(transport(fetchGithub).graphql(LINKED, schema, "query { viewer { login } }", pullRequestTarget(PULL_REQUEST), {})).rejects.toBeInstanceOf(
			GithubPullRequestNotFoundError,
		);
	});
});
