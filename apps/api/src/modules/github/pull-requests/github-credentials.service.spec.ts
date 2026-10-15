import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { GithubAccountLinkStatus } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { AppError } from "../../../common/errors/app-error";
import { TypedConfigService } from "../../../config/typed-config.service";
import { GithubLinkedTokenRejectedError, GithubUnavailableError } from "../github.errors";
import { GithubAccountLinkRepository, type GithubAccountLinkInput, type GithubAccountLinkRecord } from "./github-account-link.repository";
import { GithubCredentialCipher, GithubPullRequestsOffError } from "./github-credential.cipher";
import { GITHUB_ACCOUNT_NOT_LINKED_CODE, GITHUB_TOKEN_INVALID_CODE, GithubAccountNotLinkedError, GithubCredentialsService } from "./github-credentials.service";
import { GithubPullRequestCache } from "./github-pull-request.cache";
import { GithubPullRequestClient, type GithubTokenOwner } from "./github-pull-request.client";

const USER = "user-1";
const TOKEN = "github_pat_11ABCDEFG0123456789_secret";
const LINKED_AT = 1_791_000_000_000;
const EXPIRES_AT = 1_794_614_400_000;
const OWNER: GithubTokenOwner = { user: { id: 583231, login: "octocat", avatar_url: "https://avatars.githubusercontent.com/u/583231" }, tokenExpiresAt: EXPIRES_AT };

/** An in-memory stand-in for the repository: one row per user, exactly like the table. */
class MemoryLinks implements Pick<GithubAccountLinkRepository, "findLive" | "upsert" | "unlink" | "markRejected"> {
	public readonly rows: Map<string, GithubAccountLinkRecord> = new Map<string, GithubAccountLinkRecord>();

	public findLive(userId: string): Promise<GithubAccountLinkRecord | null> {
		return Promise.resolve(this.rows.get(userId) ?? null);
	}

	public upsert(input: GithubAccountLinkInput): Promise<GithubAccountLinkRecord> {
		const record: GithubAccountLinkRecord = { ...input, status: GithubAccountLinkStatus.ACTIVE, linkedAt: LINKED_AT };
		this.rows.set(input.userId, record);
		return Promise.resolve(record);
	}

	public unlink(userId: string): Promise<boolean> {
		return Promise.resolve(this.rows.delete(userId));
	}

	public markRejected(userId: string): Promise<void> {
		const row = this.rows.get(userId);
		if (row !== undefined) {
			this.rows.set(userId, { ...row, status: GithubAccountLinkStatus.REJECTED });
		}
		return Promise.resolve();
	}
}

interface Harness {
	readonly service: GithubCredentialsService;
	readonly links: MemoryLinks;
	readonly fetchTokenOwner: ReturnType<typeof vi.fn<GithubPullRequestClient["fetchTokenOwner"]>>;
	readonly invalidateUser: ReturnType<typeof vi.fn<GithubPullRequestCache["invalidateUser"]>>;
	readonly cipher: GithubCredentialCipher;
}

async function setup(enabled = true): Promise<Harness> {
	const config = createTestTypedConfig(enabled ? {} : { GITHUB_CREDENTIAL_ENCRYPTION_KEYS: "" });
	const links = new MemoryLinks();
	const fetchTokenOwner = vi.fn<GithubPullRequestClient["fetchTokenOwner"]>(() => Promise.resolve(OWNER));
	const invalidateUser = vi.fn<GithubPullRequestCache["invalidateUser"]>();
	const moduleRef = await Test.createTestingModule({
		providers: [
			GithubCredentialsService,
			GithubCredentialCipher,
			{ provide: TypedConfigService, useValue: config },
			{ provide: GithubAccountLinkRepository, useValue: links },
			{ provide: GithubPullRequestClient, useValue: { fetchTokenOwner } },
			{ provide: GithubPullRequestCache, useValue: { invalidateUser } },
		],
	}).compile();
	return { service: moduleRef.get(GithubCredentialsService), links, fetchTokenOwner, invalidateUser, cipher: moduleRef.get(GithubCredentialCipher) };
}

describe("GithubCredentialsService", () => {
	beforeEach(() => {
		vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("says pull requests are off without a key ring, and refuses to link or unlink", async () => {
		const { service } = await setup(false);

		expect(await service.status(USER)).toEqual({ status: "off" });
		await expect(service.link(USER, TOKEN)).rejects.toBeInstanceOf(GithubPullRequestsOffError);
		await expect(service.unlink(USER)).rejects.toBeInstanceOf(GithubPullRequestsOffError);
		await expect(service.credentialFor(USER)).rejects.toBeInstanceOf(GithubPullRequestsOffError);
	});

	it("is unlinked until a token is linked", async () => {
		expect(await (await setup()).service.status(USER)).toEqual({ status: "unlinked" });
	});

	it("links a token GitHub accepts: stores it encrypted, answers the account, drops the user's cached reads", async () => {
		const { service, links, invalidateUser, cipher } = await setup();

		const status = await service.link(USER, TOKEN);

		expect(status).toEqual({
			status: "linked",
			login: "octocat",
			avatarUrl: "https://avatars.githubusercontent.com/u/583231",
			health: "active",
			linkedAt: LINKED_AT,
			tokenExpiresAt: EXPIRES_AT,
		});
		const stored = links.rows.get(USER);
		expect(stored?.token.ciphertext).not.toContain(TOKEN);
		expect(stored === undefined ? null : cipher.decrypt(stored.token, USER)).toBe(TOKEN);
		expect(invalidateUser).toHaveBeenCalledWith(USER);
	});

	it("refuses a token GitHub does not accept, storing nothing", async () => {
		const { service, links, fetchTokenOwner } = await setup();
		fetchTokenOwner.mockRejectedValue(new GithubLinkedTokenRejectedError());

		const failure = service.link(USER, TOKEN);

		await expect(failure).rejects.toBeInstanceOf(AppError);
		await expect(failure).rejects.toMatchObject({ code: GITHUB_TOKEN_INVALID_CODE, httpStatus: 400 });
		expect(links.rows.size).toBe(0);
	});

	it("passes GitHub being down through as it is", async () => {
		const { service, fetchTokenOwner } = await setup();
		fetchTokenOwner.mockRejectedValue(new GithubUnavailableError("timeout"));

		await expect(service.link(USER, TOKEN)).rejects.toBeInstanceOf(GithubUnavailableError);
	});

	it("unlinks: the token is gone and the user's cached reads are dropped", async () => {
		const { service, invalidateUser } = await setup();
		await service.link(USER, TOKEN);
		invalidateUser.mockClear();

		expect(await service.unlink(USER)).toEqual({ status: "unlinked" });
		expect(await service.status(USER)).toEqual({ status: "unlinked" });
		expect(invalidateUser).toHaveBeenCalledWith(USER);
	});

	it("hands out the linked token as a linked credential, with the account's login", async () => {
		const { service } = await setup();
		await service.link(USER, TOKEN);

		expect(await service.credentialFor(USER)).toEqual({ credential: { source: "linked", token: TOKEN }, login: "octocat" });
	});

	it("asks to link a token first when none is linked", async () => {
		const failure = (await setup()).service.credentialFor(USER);

		await expect(failure).rejects.toBeInstanceOf(GithubAccountNotLinkedError);
		await expect(failure).rejects.toMatchObject({ code: GITHUB_ACCOUNT_NOT_LINKED_CODE, httpStatus: 409 });
	});

	it("records a token GitHub refuses mid-use as rejected, and refuses it from then on", async () => {
		const { service, invalidateUser } = await setup();
		await service.link(USER, TOKEN);

		await expect(service.withCredential(USER, (): Promise<string> => Promise.reject(new GithubLinkedTokenRejectedError()))).rejects.toBeInstanceOf(
			GithubLinkedTokenRejectedError,
		);

		expect(await service.status(USER)).toMatchObject({ status: "linked", health: "rejected" });
		expect(invalidateUser).toHaveBeenCalledWith(USER);
		await expect(service.credentialFor(USER)).rejects.toBeInstanceOf(GithubLinkedTokenRejectedError);
	});

	it("treats a stored token no key opens as rejected, asking for a new one", async () => {
		const { service, links } = await setup();
		await service.link(USER, TOKEN);
		const row = links.rows.get(USER);
		if (row !== undefined) {
			links.rows.set(USER, { ...row, token: { ...row.token, keyVersion: 99 } });
		}

		await expect(service.credentialFor(USER)).rejects.toBeInstanceOf(GithubLinkedTokenRejectedError);
		expect(await service.status(USER)).toMatchObject({ health: "rejected" });
	});
});
