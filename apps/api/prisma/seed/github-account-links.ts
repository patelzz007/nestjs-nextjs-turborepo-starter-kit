import { GithubAccountLinkStatus } from "@prisma/client";

import { getApiConfig } from "../../src/config/api-config";
import { TypedConfigService } from "../../src/config/typed-config.service";
import { GithubCredentialCipher } from "../../src/modules/github/pull-requests/github-credential.cipher";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";

// ---------------------------------------------------------------------------
// GitHub pull-request links (ADR 052) — development scenario.
//
// Only states the API itself leaves behind, sealed with the app's own
// `GithubCredentialCipher` (GITHUB_CREDENTIAL_ENCRYPTION_KEYS):
//   - the platform Admin linked a token that has since expired: GitHub refused
//     it, so the link is REJECTED and the app asks for a new token;
//   - the SuperAdmin linked a token and then unlinked it: the row is
//     soft-deleted and its token wiped, so they start unlinked and can link
//     their real token.
// No real token is ever seeded: the demo token is a placeholder GitHub would
// refuse. Idempotent: upserted by user. A link a developer made themselves (a
// live link to any account but the demo ones) is never replaced — reseeding a
// development database must not throw away someone's real token. Only the e2e
// suites, which snapshot and restore every link, reset them (`replaceRealLinks`).
// ---------------------------------------------------------------------------

const GITHUB_LINK_NAMESPACE = "seed.github_account_link";

/** A placeholder in the fine-grained format — never a working token. */
const PLACEHOLDER_TOKEN = "github_pat_SEEDONLY0000000000000000_placeholder_not_a_real_token";

const DAY_MS = 24 * 60 * 60 * 1_000;
/** The Admin linked 40 days ago a token that ran out 10 days ago; the SuperAdmin unlinked theirs 2 days ago. */
const ADMIN_LINKED_DAYS_AGO = 40;
const ADMIN_TOKEN_EXPIRED_DAYS_AGO = 10;
const SUPER_ADMIN_LINKED_DAYS_AGO = 20;
const SUPER_ADMIN_UNLINKED_DAYS_AGO = 2;

/** GitHub ids of the demo accounts (any positive integers — they are never looked up). */
const DEMO_GITHUB_USER_IDS = { admin: 90_000_001, superAdmin: 90_000_002 };

/** What an unlinked row keeps in place of the token (the repository's `unlink` wipes it the same way). */
const WIPED_CIPHERTEXT = "";

export interface GithubAccountLinkSeedActors {
	readonly adminId: string;
	readonly superAdminId: string;
}

export interface GithubAccountLinkSeedSummary {
	/** `skipped`: GITHUB_CREDENTIAL_ENCRYPTION_KEYS is not set, so pull requests are off and nothing can be sealed. */
	readonly status: "seeded" | "skipped";
	readonly links: number;
	/** Users whose own (non-demo) link was kept as it is. */
	readonly kept: number;
}

export interface GithubAccountLinkSeedOptions {
	/** Replace a developer's own link too — only for suites that snapshot and restore every link. */
	readonly replaceRealLinks: boolean;
}

/** Logins the seed itself writes; a live link to any other account is someone's real token. */
const DEMO_LOGINS: ReadonlySet<string> = new Set<string>(["demo-admin", "demo-superadmin"]);

/** Whether `userId` has a live link they made themselves. */
async function hasRealLink(userId: string): Promise<boolean> {
	const link = await prisma.githubAccountLink.findFirst({ where: { userId, isDeleted: false }, select: { githubLogin: true } });
	return link !== null && !DEMO_LOGINS.has(link.githubLogin);
}

export async function seedGithubAccountLinks(
	actors: GithubAccountLinkSeedActors,
	nowMs: number,
	options: GithubAccountLinkSeedOptions = { replaceRealLinks: false },
): Promise<GithubAccountLinkSeedSummary> {
	const cipher = new GithubCredentialCipher(new TypedConfigService(getApiConfig()));
	if (!cipher.isEnabled()) {
		return { status: "skipped", links: 0, kept: 0 };
	}
	const keepAdmin = !options.replaceRealLinks && (await hasRealLink(actors.adminId));
	const keepSuperAdmin = !options.replaceRealLinks && (await hasRealLink(actors.superAdminId));
	const adminLinkedAt = BigInt(nowMs - ADMIN_LINKED_DAYS_AGO * DAY_MS);
	const adminToken = cipher.encrypt(PLACEHOLDER_TOKEN, actors.adminId);
	const adminLink = {
		githubUserId: BigInt(DEMO_GITHUB_USER_IDS.admin),
		githubLogin: "demo-admin",
		tokenCiphertext: adminToken.ciphertext,
		tokenKeyVersion: adminToken.keyVersion,
		tokenExpiresAt: BigInt(nowMs - ADMIN_TOKEN_EXPIRED_DAYS_AGO * DAY_MS),
		status: GithubAccountLinkStatus.REJECTED,
		linkedAt: adminLinkedAt,
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
		updatedAt: BigInt(nowMs - ADMIN_TOKEN_EXPIRED_DAYS_AGO * DAY_MS),
	};
	if (!keepAdmin) {
		await prisma.githubAccountLink.upsert({
			where: { userId: actors.adminId },
			create: { id: deterministicUuid(GITHUB_LINK_NAMESPACE, actors.adminId), userId: actors.adminId, ...adminLink, createdAt: adminLinkedAt },
			update: adminLink,
		});
	}

	const superAdminLinkedAt = BigInt(nowMs - SUPER_ADMIN_LINKED_DAYS_AGO * DAY_MS);
	const superAdminUnlinkedAt = BigInt(nowMs - SUPER_ADMIN_UNLINKED_DAYS_AGO * DAY_MS);
	const superAdminLink = {
		githubUserId: BigInt(DEMO_GITHUB_USER_IDS.superAdmin),
		githubLogin: "demo-superadmin",
		tokenCiphertext: WIPED_CIPHERTEXT,
		tokenKeyVersion: cipher.encrypt(PLACEHOLDER_TOKEN, actors.superAdminId).keyVersion,
		tokenExpiresAt: null,
		status: GithubAccountLinkStatus.ACTIVE,
		linkedAt: superAdminLinkedAt,
		isDeleted: true,
		deletedAt: superAdminUnlinkedAt,
		deletedBy: actors.superAdminId,
		updatedAt: superAdminUnlinkedAt,
	};
	if (!keepSuperAdmin) {
		await prisma.githubAccountLink.upsert({
			where: { userId: actors.superAdminId },
			create: { id: deterministicUuid(GITHUB_LINK_NAMESPACE, actors.superAdminId), userId: actors.superAdminId, ...superAdminLink, createdAt: superAdminLinkedAt },
			update: superAdminLink,
		});
	}
	const kept = Number(keepAdmin) + Number(keepSuperAdmin);
	return { status: "seeded", links: 2 - kept, kept };
}
