import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { GithubContentNotFoundError, GithubWriteRejectedError } from "../github.errors";
import { GithubHttpTransport, type GithubCredential, type GithubFetch } from "../github-http.transport";
import { GithubRepositoryFilesClient, RepositoryFileNotAnImageError } from "./github-repository-files.client";

const LINKED: GithubCredential = { source: "linked", token: "github_pat_linked" };
const REPOSITORY = { owner: "octo-org", repository: "hello-world" };
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const API = "https://api.github.com/repos/octo-org/hello-world";

function json(body: object, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function branch(exists: boolean): Response {
	return json({ data: { repository: { ref: exists ? { target: { oid: "abc" } } : null } } });
}

function client(fetchGithub: GithubFetch): GithubRepositoryFilesClient {
	return new GithubRepositoryFilesClient(new GithubHttpTransport(createTestTypedConfig({}), fetchGithub));
}

/** "METHOD url" of every request, and the JSON body of each write. */
function requests(fetchGithub: ReturnType<typeof vi.fn<GithubFetch>>): readonly string[] {
	return fetchGithub.mock.calls.map(([url, init]) => `${init.method ?? "GET"} ${url}`);
}

const BodySchema = z.record(z.string(), z.union([z.string(), z.array(z.record(z.string(), z.string())), z.array(z.string())]));

function bodyOf(fetchGithub: ReturnType<typeof vi.fn<GithubFetch>>, index: number): z.output<typeof BodySchema> {
	const [, init] = fetchGithub.mock.calls.at(index) ?? ["", {}];
	return BodySchema.parse(JSON.parse(z.string().parse(init.body)));
}

describe("GithubRepositoryFilesClient.commitFile", () => {
	it("adds the picture on top of the comment-assets branch when it exists", async () => {
		const fetchGithub = vi
			.fn<GithubFetch>()
			.mockResolvedValueOnce(branch(true))
			.mockResolvedValueOnce(json({ content: { path: "pull-requests/42/a.png" } }, 201));

		const file = await client(fetchGithub).commitFile(LINKED, REPOSITORY, "pull-requests/42/a.png", PNG, "Add a picture");

		expect(file).toEqual({ ...REPOSITORY, ref: "github-comment-assets", path: "pull-requests/42/a.png" });
		expect(requests(fetchGithub)).toEqual(["POST https://api.github.com/graphql", `PUT ${API}/contents/pull-requests/42/a.png`]);
		expect(bodyOf(fetchGithub, 1)).toEqual({ message: "Add a picture", content: PNG.toString("base64"), branch: "github-comment-assets" });
	});

	it("starts the branch from nothing for a repository's first picture — none of its code is copied into it", async () => {
		const fetchGithub = vi
			.fn<GithubFetch>()
			.mockResolvedValueOnce(branch(false))
			.mockResolvedValueOnce(json({ sha: "blob-sha" }, 201))
			.mockResolvedValueOnce(json({ sha: "tree-sha" }, 201))
			.mockResolvedValueOnce(json({ sha: "commit-sha" }, 201))
			.mockResolvedValueOnce(json({ ref: "refs/heads/github-comment-assets" }, 201));

		await client(fetchGithub).commitFile(LINKED, REPOSITORY, "pull-requests/42/a.png", PNG, "Add a picture");

		expect(requests(fetchGithub)).toEqual([
			"POST https://api.github.com/graphql",
			`POST ${API}/git/blobs`,
			`POST ${API}/git/trees`,
			`POST ${API}/git/commits`,
			`POST ${API}/git/refs`,
		]);
		expect(bodyOf(fetchGithub, 3)).toEqual({ message: "Add a picture", tree: "tree-sha", parents: [] });
		expect(bodyOf(fetchGithub, 4)).toEqual({ ref: "refs/heads/github-comment-assets", sha: "commit-sha" });
	});

	it("adds the picture to the branch someone else started first", async () => {
		const fetchGithub = vi
			.fn<GithubFetch>()
			.mockResolvedValueOnce(branch(false))
			.mockResolvedValueOnce(json({ sha: "blob-sha" }, 201))
			.mockResolvedValueOnce(json({ sha: "tree-sha" }, 201))
			.mockResolvedValueOnce(json({ sha: "commit-sha" }, 201))
			.mockResolvedValueOnce(json({ message: "Reference already exists" }, 422))
			.mockResolvedValueOnce(json({ content: { path: "pull-requests/42/a.png" } }, 201));

		await client(fetchGithub).commitFile(LINKED, REPOSITORY, "pull-requests/42/a.png", PNG, "Add a picture");

		expect(requests(fetchGithub).at(-1)).toBe(`PUT ${API}/contents/pull-requests/42/a.png`);
	});

	it("names the Contents permission when the token may not commit there", async () => {
		const fetchGithub = vi
			.fn<GithubFetch>()
			.mockResolvedValueOnce(branch(true))
			.mockResolvedValueOnce(json({ message: "Resource not accessible by personal access token" }, 403));

		const commit = client(fetchGithub).commitFile(LINKED, REPOSITORY, "pull-requests/42/a.png", PNG, "Add a picture");

		await expect(commit).rejects.toBeInstanceOf(GithubWriteRejectedError);
		await expect(commit).rejects.toThrow('Give it "Contents: Read and write" access');
	});
});

describe("GithubRepositoryFilesClient.readImage", () => {
	const FILE = { ...REPOSITORY, ref: "github-comment-assets", path: "pull-requests/42/a.png" };

	it("reads a picture's bytes with GitHub's raw media type", async () => {
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(new Response(new Uint8Array(PNG), { status: 200 })));

		await expect(client(fetchGithub).readImage(LINKED, FILE, 1_000)).resolves.toEqual({ bytes: PNG, mimeType: "image/png" });
		const [[url, init] = ["", {}]] = fetchGithub.mock.calls;
		expect(url).toBe(`${API}/contents/pull-requests/42/a.png?ref=github-comment-assets`);
		expect(new Headers(init.headers).get("accept")).toBe("application/vnd.github.raw+json");
	});

	it("serves nothing that is not a picture, or is larger than allowed", async () => {
		const notAPicture = vi.fn<GithubFetch>(() => Promise.resolve(new Response("%PDF-1.7 body", { status: 200 })));
		const tooLarge = vi.fn<GithubFetch>(() => Promise.resolve(new Response(new Uint8Array(PNG), { status: 200 })));

		await expect(client(notAPicture).readImage(LINKED, FILE, 1_000)).rejects.toBeInstanceOf(RepositoryFileNotAnImageError);
		await expect(client(tooLarge).readImage(LINKED, FILE, PNG.length - 1)).rejects.toBeInstanceOf(RepositoryFileNotAnImageError);
	});
});

describe("GithubRepositoryFilesClient.readSignedUpload", () => {
	const SIGNED = "https://private-user-images.githubusercontent.com/1/2-cb5fe4d3-85fb-4d1e-807a-1771925051be.png?jwt=eyJ0";

	it("reads an upload through GitHub's signed link without sending the token — the link is the credential", async () => {
		const fetchGithub = vi.fn<GithubFetch>(() => Promise.resolve(new Response(new Uint8Array(PNG), { status: 200 })));

		await expect(client(fetchGithub).readSignedUpload(SIGNED, "IC_node", 1_000)).resolves.toEqual({ bytes: PNG, mimeType: "image/png" });
		const [[url, init] = ["", {}]] = fetchGithub.mock.calls;
		expect(url).toBe(SIGNED);
		expect(new Headers(init.headers).get("authorization")).toBeNull();
	});

	it("answers an expired link, or anything that is not a picture, as not found", async () => {
		const expired = vi.fn<GithubFetch>(() => Promise.resolve(new Response("<Error>Request has expired</Error>", { status: 403 })));
		const notAPicture = vi.fn<GithubFetch>(() => Promise.resolve(new Response("<html>", { status: 200 })));

		await expect(client(expired).readSignedUpload(SIGNED, "IC_node", 1_000)).rejects.toBeInstanceOf(GithubContentNotFoundError);
		await expect(client(notAPicture).readSignedUpload(SIGNED, "IC_node", 1_000)).rejects.toBeInstanceOf(GithubContentNotFoundError);
	});
});

describe("GithubRepositoryFilesClient.fileExists", () => {
	const FILE = { ...REPOSITORY, ref: "github-comment-assets", path: "pull-requests/42/a.png" };

	it("asks GitHub for the object at <branch>:<path>", async () => {
		const there = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: { object: { __typename: "Blob" } } } })));
		const missing = vi.fn<GithubFetch>(() => Promise.resolve(json({ data: { repository: { object: null } } })));

		await expect(client(there).fileExists(LINKED, FILE)).resolves.toBe(true);
		await expect(client(missing).fileExists(LINKED, FILE)).resolves.toBe(false);
		const [[, init] = ["", {}]] = there.mock.calls;
		expect(JSON.parse(z.string().parse(init.body))).toMatchObject({
			variables: { owner: "octo-org", name: "hello-world", expression: "github-comment-assets:pull-requests/42/a.png" },
		});
	});
});
