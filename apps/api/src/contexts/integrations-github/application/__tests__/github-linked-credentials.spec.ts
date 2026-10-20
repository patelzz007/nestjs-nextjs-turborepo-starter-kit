import { describe, expect, it } from "vitest";

import { AuthenticationError } from "../../../../platform/application/errors/app-error";
import { GithubAccountNotLinkedError, GithubLinkedTokenRejectedError, GithubPullRequestsOffError, GithubUnavailableError } from "../errors/github.errors";
import { anonymousActor, AT, USER_ID, userActor } from "./fakes/github-contract.fixtures";
import { tokenRejected } from "./fakes/github-fakes";
import { githubHarness, LINKED_TOKEN, linkToken } from "./fakes/github-harness";

describe("GithubLinkedCredentials", () => {
	it("says pull requests are off without a key ring, and hands out no token", async () => {
		const harness = githubHarness();
		harness.cipher.enabled = false;

		await expect(harness.credentials.status(userActor())).resolves.toEqual({ status: "off" });
		await expect(harness.credentials.credentialFor(userActor())).rejects.toBeInstanceOf(GithubPullRequestsOffError);
		expect((): void => {
			harness.credentials.assertEnabled();
		}).toThrow(GithubPullRequestsOffError);
	});

	it("is unlinked until a token is linked, reading the link as the caller", async () => {
		const harness = githubHarness();

		await expect(harness.credentials.status(userActor())).resolves.toEqual({ status: "unlinked" });
		expect(harness.linkReads.readers).toEqual([userActor()]);
	});

	it("answers the linked account, never the token", async () => {
		const harness = githubHarness();
		await linkToken(harness);

		const status = await harness.credentials.status(userActor());

		expect(status).toEqual({
			status: "linked",
			login: "octocat",
			avatarUrl: "https://avatars.githubusercontent.com/u/583231",
			health: "active",
			linkedAt: AT,
			tokenExpiresAt: null,
		});
		expect(JSON.stringify(status)).not.toContain(LINKED_TOKEN);
	});

	it("hands out the linked token with the account's login", async () => {
		const harness = githubHarness();
		await linkToken(harness);

		await expect(harness.credentials.credentialFor(userActor())).resolves.toEqual({ token: LINKED_TOKEN, login: "octocat" });
	});

	it("asks to link a token first when none is linked", async () => {
		await expect(githubHarness().credentials.credentialFor(userActor())).rejects.toBeInstanceOf(GithubAccountNotLinkedError);
	});

	it("refuses a token already known to be rejected, without decrypting it", async () => {
		const harness = githubHarness();
		await linkToken(harness);
		await harness.links.markRejected(USER_ID);

		await expect(harness.credentials.credentialFor(userActor())).rejects.toBeInstanceOf(GithubLinkedTokenRejectedError);
		await expect(harness.credentials.status(userActor())).resolves.toMatchObject({ health: "rejected" });
	});

	it("treats a stored token no key opens as rejected, asking for a new one", async () => {
		const harness = githubHarness();
		await harness.links.upsert({ userId: USER_ID, githubUserId: 1, githubLogin: "octocat", token: { ciphertext: "tampered", keyVersion: 9 }, tokenExpiresAt: null });

		await expect(harness.credentials.credentialFor(userActor())).rejects.toBeInstanceOf(GithubLinkedTokenRejectedError);
		expect(harness.links.rows.get(USER_ID)?.status).toBe("REJECTED");
		expect(harness.unitOfWork.committed).toEqual([{ actor: userActor(), operation: null }]);
	});

	it("records a token GitHub refuses mid-use as rejected, drops the user's cached reads, and refuses it from then on", async () => {
		const harness = githubHarness();
		await linkToken(harness);

		await expect(harness.credentials.withCredential(userActor(), () => Promise.reject(tokenRejected()))).rejects.toBeInstanceOf(GithubLinkedTokenRejectedError);

		expect(harness.links.rows.get(USER_ID)?.status).toBe("REJECTED");
		expect(harness.cache.users).toEqual([USER_ID]);
		await expect(harness.credentials.credentialFor(userActor())).rejects.toBeInstanceOf(GithubLinkedTokenRejectedError);
	});

	it("passes GitHub being down through as it is, keeping the token", async () => {
		const harness = githubHarness();
		await linkToken(harness);

		await expect(harness.credentials.withCredential(userActor(), () => Promise.reject(new GithubUnavailableError("timeout")))).rejects.toBeInstanceOf(GithubUnavailableError);
		expect(harness.links.rows.get(USER_ID)?.status).toBe("ACTIVE");
		expect(harness.cache.users).toEqual([]);
	});

	it("serves no one but a signed-in user", async () => {
		await expect(githubHarness().credentials.status(anonymousActor())).rejects.toBeInstanceOf(AuthenticationError);
	});
});
