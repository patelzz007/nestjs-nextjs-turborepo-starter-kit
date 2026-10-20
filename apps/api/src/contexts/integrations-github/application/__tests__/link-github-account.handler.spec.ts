import { describe, expect, it } from "vitest";

import { AppError } from "../../../../platform/application/errors/app-error";
import { LinkGithubAccountCommand } from "../commands/link-github-account/link-github-account.command";
import { LinkGithubAccountHandler } from "../commands/link-github-account/link-github-account.handler";
import { UnlinkGithubAccountCommand } from "../commands/unlink-github-account/unlink-github-account.command";
import { UnlinkGithubAccountHandler } from "../commands/unlink-github-account/unlink-github-account.handler";
import { GITHUB_TOKEN_INVALID_CODE, GithubPullRequestsOffError, GithubUnavailableError } from "../errors/github.errors";
import { AT, OTHER_USER_ID, USER_ID, userActor } from "./fakes/github-contract.fixtures";
import { tokenRejected } from "./fakes/github-fakes";
import { githubHarness, LINKED_TOKEN, linkToken, type GithubHarness } from "./fakes/github-harness";

/** When GitHub says the token expires. */
const EXPIRES_AT = 1_794_614_400_000;

function linkHandler(harness: GithubHarness): LinkGithubAccountHandler {
	return new LinkGithubAccountHandler(harness.credentials, harness.cipher, harness.tokenOwners, harness.unitOfWork, harness.cache);
}

function unlinkHandler(harness: GithubHarness): UnlinkGithubAccountHandler {
	return new UnlinkGithubAccountHandler(harness.credentials, harness.unitOfWork, harness.cache);
}

describe("LinkGithubAccountHandler", () => {
	it("links a token GitHub accepts: stores it sealed to its owner, answers the account, drops the user's cached reads", async () => {
		const harness = githubHarness();
		harness.tokenOwners.owner = { githubUserId: 583231, login: "octocat", tokenExpiresAt: EXPIRES_AT };

		const status = await linkHandler(harness).execute(new LinkGithubAccountCommand(userActor(), { personalAccessToken: LINKED_TOKEN }));

		expect(status).toEqual({
			status: "linked",
			login: "octocat",
			avatarUrl: "https://avatars.githubusercontent.com/u/583231",
			health: "active",
			linkedAt: AT,
			tokenExpiresAt: EXPIRES_AT,
		});
		expect(harness.tokenOwners.asked).toEqual([LINKED_TOKEN]);
		expect(harness.links.rows.get(USER_ID)?.token).toEqual(harness.cipher.encrypt(LINKED_TOKEN, USER_ID));
		expect(harness.cache.users).toEqual([USER_ID]);
		expect(harness.unitOfWork.committed).toEqual([{ actor: userActor(), operation: null }]);
	});

	it("replaces an earlier token, a rejected one included", async () => {
		const harness = githubHarness();
		await linkToken(harness, USER_ID, "github_pat_old");
		await harness.links.markRejected(USER_ID);

		await linkHandler(harness).execute(new LinkGithubAccountCommand(userActor(), { personalAccessToken: LINKED_TOKEN }));

		expect(harness.links.rows.get(USER_ID)).toMatchObject({ status: "ACTIVE", token: harness.cipher.encrypt(LINKED_TOKEN, USER_ID) });
	});

	it("refuses a token GitHub does not accept with 400 GITHUB_TOKEN_INVALID, storing nothing", async () => {
		const harness = githubHarness();
		harness.tokenOwners.failure = tokenRejected();

		const failure = linkHandler(harness).execute(new LinkGithubAccountCommand(userActor(), { personalAccessToken: LINKED_TOKEN }));

		await expect(failure).rejects.toBeInstanceOf(AppError);
		await expect(failure).rejects.toMatchObject({ code: GITHUB_TOKEN_INVALID_CODE, httpStatus: 400 });
		expect(harness.links.rows.size).toBe(0);
		expect(harness.cache.users).toEqual([]);
	});

	it("passes GitHub being down through as it is", async () => {
		const harness = githubHarness();
		harness.tokenOwners.failure = new GithubUnavailableError("unreachable");

		await expect(linkHandler(harness).execute(new LinkGithubAccountCommand(userActor(), { personalAccessToken: LINKED_TOKEN }))).rejects.toBeInstanceOf(
			GithubUnavailableError,
		);
		expect(harness.links.rows.size).toBe(0);
	});

	it("refuses to link when pull requests are off, before asking GitHub", async () => {
		const harness = githubHarness();
		harness.cipher.enabled = false;

		await expect(linkHandler(harness).execute(new LinkGithubAccountCommand(userActor(), { personalAccessToken: LINKED_TOKEN }))).rejects.toBeInstanceOf(
			GithubPullRequestsOffError,
		);
		expect(harness.tokenOwners.asked).toEqual([]);
	});
});

describe("UnlinkGithubAccountHandler", () => {
	it("soft-deletes the link and wipes the token, as its owner, and drops the user's cached reads", async () => {
		const harness = githubHarness();
		await linkToken(harness);

		await expect(unlinkHandler(harness).execute(new UnlinkGithubAccountCommand(userActor()))).resolves.toEqual({ status: "unlinked" });

		expect(harness.links.rows.get(USER_ID)).toMatchObject({ isDeleted: true, deletedBy: USER_ID, token: { ciphertext: "" } });
		expect(harness.cache.users).toEqual([USER_ID]);
	});

	it("is already done when nothing is linked, and never touches another user's link", async () => {
		const harness = githubHarness();
		await linkToken(harness, OTHER_USER_ID);

		await expect(unlinkHandler(harness).execute(new UnlinkGithubAccountCommand(userActor()))).resolves.toEqual({ status: "unlinked" });
		expect(harness.links.rows.get(OTHER_USER_ID)?.isDeleted).toBe(false);
	});

	it("refuses to unlink when pull requests are off", async () => {
		const harness = githubHarness();
		harness.cipher.enabled = false;

		await expect(unlinkHandler(harness).execute(new UnlinkGithubAccountCommand(userActor()))).rejects.toBeInstanceOf(GithubPullRequestsOffError);
	});
});
