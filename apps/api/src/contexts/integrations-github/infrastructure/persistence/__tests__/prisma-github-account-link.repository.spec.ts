import type { GithubAccountLink } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { toGithubAccountLinkRecord } from "../prisma-github-account-link.repository";
import { LIVE_ROW_FIELDS } from "../../../../../platform/infrastructure/persistence/__tests__/base-row-fields";

const ROW: GithubAccountLink = {
	...LIVE_ROW_FIELDS,
	id: "4d6f8a2c-1b3e-4c5d-9e7f-0a1b2c3d4e5f",
	userId: "user-1",
	githubUserId: 583231n,
	githubLogin: "octocat",
	tokenCiphertext: "iv:tag:ciphertext",
	tokenKeyVersion: 2,
	tokenExpiresAt: 1_794_614_400_000n,
	status: "ACTIVE",
	linkedAt: 1_791_000_000_000n,
	createdAt: 1_791_000_000_000n,
	updatedAt: 1_791_000_000_000n,
	isDeleted: false,
	deletedAt: null,
	deletedBy: null,
};

describe("toGithubAccountLinkRecord", () => {
	it("reads a row as the application sees it: epoch numbers, the sealed token, the status", () => {
		expect(toGithubAccountLinkRecord(ROW)).toEqual({
			userId: "user-1",
			githubUserId: 583231,
			githubLogin: "octocat",
			token: { ciphertext: "iv:tag:ciphertext", keyVersion: 2 },
			tokenExpiresAt: 1_794_614_400_000,
			status: "ACTIVE",
			linkedAt: 1_791_000_000_000,
		});
	});

	it("reads a token GitHub never expires as no expiry, and a rejected link as rejected", () => {
		expect(toGithubAccountLinkRecord({ ...ROW, tokenExpiresAt: null, status: "REJECTED" })).toMatchObject({ tokenExpiresAt: null, status: "REJECTED" });
	});
});
