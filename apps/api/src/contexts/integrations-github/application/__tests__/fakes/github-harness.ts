import type { InMemoryUnitOfWork } from "../../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import type { GithubScope } from "../../github-scope";
import { GithubCommentPictures } from "../../services/github-comment-pictures";
import { GithubLinkedCredentials } from "../../services/github-linked-credentials";
import { GithubLiveUpdatesStatusReader } from "../../services/github-live-updates-status";
import { USER_ID } from "./github-contract.fixtures";
import {
	FakePullRequestReads,
	FakePullRequestWrites,
	FakeRepositoryFiles,
	FakeTokenCipher,
	FakeTokenOwners,
	FakeWebhookEndpoint,
	FakeWebhooks,
	FixedGithubClock,
	githubUnitOfWork,
	InMemoryCommentPictureUploads,
	InMemoryGithubAccountLinkReads,
	InMemoryGithubAccountLinks,
	InMemoryWebhookStore,
	RecordingPullRequestCache,
} from "./github-fakes";

/** The token an admin linked in the harness. */
export const LINKED_TOKEN = "github_pat_11ABCDEFG0123456789_secret";

/** Every port of the context, faked, wired the way the module wires them. */
export interface GithubHarness {
	readonly clock: FixedGithubClock;
	readonly cipher: FakeTokenCipher;
	readonly tokenOwners: FakeTokenOwners;
	readonly links: InMemoryGithubAccountLinks;
	readonly linkReads: InMemoryGithubAccountLinkReads;
	readonly unitOfWork: InMemoryUnitOfWork<GithubScope>;
	readonly cache: RecordingPullRequestCache;
	readonly reads: FakePullRequestReads;
	readonly writes: FakePullRequestWrites;
	readonly repositoryFiles: FakeRepositoryFiles;
	readonly uploads: InMemoryCommentPictureUploads;
	readonly endpoint: FakeWebhookEndpoint;
	readonly webhooks: FakeWebhooks;
	readonly store: InMemoryWebhookStore;
	readonly credentials: GithubLinkedCredentials;
	readonly pictures: GithubCommentPictures;
	readonly liveUpdates: GithubLiveUpdatesStatusReader;
}

export function githubHarness(): GithubHarness {
	const clock = new FixedGithubClock();
	const cipher = new FakeTokenCipher();
	const links = new InMemoryGithubAccountLinks(clock);
	const linkReads = new InMemoryGithubAccountLinkReads(links);
	const unitOfWork = githubUnitOfWork(links);
	const cache = new RecordingPullRequestCache();
	const repositoryFiles = new FakeRepositoryFiles();
	const uploads = new InMemoryCommentPictureUploads();
	const endpoint = new FakeWebhookEndpoint();
	const store = new InMemoryWebhookStore();
	return {
		clock,
		cipher,
		tokenOwners: new FakeTokenOwners(),
		links,
		linkReads,
		unitOfWork,
		cache,
		reads: new FakePullRequestReads(),
		writes: new FakePullRequestWrites(),
		repositoryFiles,
		uploads,
		endpoint,
		webhooks: new FakeWebhooks(),
		store,
		credentials: new GithubLinkedCredentials(cipher, linkReads, unitOfWork, cache),
		pictures: new GithubCommentPictures(uploads, repositoryFiles),
		liveUpdates: new GithubLiveUpdatesStatusReader(endpoint, store),
	};
}

/** Links `token` for `userId` the way linking stores it. */
export async function linkToken(harness: GithubHarness, userId: string = USER_ID, token: string = LINKED_TOKEN): Promise<void> {
	await harness.links.upsert({ userId, githubUserId: 583231, githubLogin: "octocat", token: harness.cipher.encrypt(token, userId), tokenExpiresAt: null });
}
