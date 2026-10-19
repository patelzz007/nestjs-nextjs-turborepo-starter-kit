// Real, in-memory implementations of the integrations-github ports, for the
// handler specs. Each records what it was asked, so a spec can assert the
// orchestration without mocking the handler under test.

import type {
	DocumentMimeType,
	GithubComment,
	GithubCommitDetail,
	GithubContentEditHistory,
	GithubPullRequestCommitPage,
	GithubPullRequestCommitParams,
	GithubPullRequestDetail,
	GithubPullRequestFilePage,
	GithubPullRequestListQuery,
	GithubPullRequestPage,
	GithubPullRequestParams,
	GithubPullRequestStatus,
	GithubReactionContent,
	GithubReactionSubject,
	GithubRepositoryFile,
	GithubRepositoryParams,
	GithubReview,
	GithubReviewEvent,
	GithubReviewThreadList,
	GithubTimelinePage,
} from "@workspace/shared";
import { Subject, type Observable } from "rxjs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { TransactionalEventCollector } from "../../../../../platform/application/events/transactional-event-collector";
import { InMemoryUnitOfWork } from "../../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import { GithubLinkedTokenRejectedError, GithubStoredTokenUnreadableError } from "../../errors/github.errors";
import type { GithubScope } from "../../github-scope";
import type {
	GithubAccountLinkInput,
	GithubAccountLinkReadPort,
	GithubAccountLinkRecord,
	GithubAccountLinkRepository,
	GithubAccountLinkStatus,
} from "../../ports/github-account-link.port";
import type { GithubClock } from "../../ports/github-clock.port";
import type { CommentPictureUpload, CommentPictureUploadsPort } from "../../ports/comment-picture-uploads.port";
import type { EncryptedGithubToken, GithubTokenCipherPort, GithubTokenOwner, GithubTokenOwnerPort, LinkedGithubCredential } from "../../ports/github-credentials.port";
import type {
	GithubChangeSignal,
	GithubChangeSignalsPort,
	GithubWebhookDeliveryInput,
	GithubWebhookEndpointPort,
	GithubWebhooksPort,
	GithubWebhookStorePort,
	GithubWebhookSubscriptionRecord,
	WebhookEndpoint,
} from "../../ports/github-live-updates.port";
import type { GithubPullRequestCachePort } from "../../ports/github-pull-request-cache.port";
import type { GithubHeadBranch, GithubMergeRequest, GithubPullRequestReadsPort, GithubPullRequestWritesPort } from "../../ports/github-pull-requests.port";
import type { GithubPicture, GithubRepositoryFilesPort } from "../../ports/github-repository-files.port";
import {
	AT,
	COMMIT_DETAIL,
	COMMIT_PAGE,
	CONTENT_EDITS,
	FILE_PAGE,
	MERGE_SHA,
	POSTED_COMMENT,
	PULL_REQUEST_DETAIL,
	PULL_REQUEST_PAGE,
	PULL_REQUEST_STATUS,
	REVIEW_THREADS,
	SUBMITTED_REVIEW,
	TIMELINE_PAGE,
} from "./github-contract.fixtures";

/** A clock frozen at `now` (epoch ms), moved on by hand. */
export class FixedGithubClock implements GithubClock {
	public constructor(public now: number = AT) {}

	public nowEpochMs(): number {
		return this.now;
	}
}

/** The prefix the fake cipher seals with — never a real envelope. */
const SEALED_PREFIX = "sealed";

/** Seals `token` as `sealed:<owner>:<token>`; refuses another owner's envelope, like AES-GCM's associated data does. */
export class FakeTokenCipher implements GithubTokenCipherPort {
	public constructor(public enabled = true) {}

	public isEnabled(): boolean {
		return this.enabled;
	}

	public encrypt(token: string, userId: string): EncryptedGithubToken {
		return { ciphertext: `${SEALED_PREFIX}:${userId}:${token}`, keyVersion: 1 };
	}

	public decrypt(stored: EncryptedGithubToken, userId: string): string {
		const prefix = `${SEALED_PREFIX}:${userId}:`;
		if (!stored.ciphertext.startsWith(prefix)) {
			throw new GithubStoredTokenUnreadableError("not sealed for this owner");
		}
		return stored.ciphertext.slice(prefix.length);
	}
}

/** GitHub's answer about a token: who owns it, or a refusal. */
export class FakeTokenOwners implements GithubTokenOwnerPort {
	public readonly asked: string[] = [];
	public failure: Error | null = null;

	public constructor(public owner: GithubTokenOwner = { githubUserId: 583231, login: "octocat", tokenExpiresAt: null }) {}

	public fetchTokenOwner(token: string): Promise<GithubTokenOwner> {
		this.asked.push(token);
		return this.failure === null ? Promise.resolve(this.owner) : Promise.reject(this.failure);
	}
}

/** One stored row, with what unlinking leaves behind. */
export interface StoredGithubAccountLink extends GithubAccountLinkRecord {
	readonly isDeleted: boolean;
	readonly deletedBy: string | null;
}

const ACTIVE: GithubAccountLinkStatus = "ACTIVE";
const REJECTED: GithubAccountLinkStatus = "REJECTED";

/** `GithubAccountLink` in memory: one row per user, soft-deleted on unlink, with the same statements' semantics. */
export class InMemoryGithubAccountLinks implements GithubAccountLinkRepository {
	public readonly rows: Map<string, StoredGithubAccountLink> = new Map<string, StoredGithubAccountLink>();

	public constructor(private readonly clock: GithubClock) {}

	public findLive(userId: string): Promise<GithubAccountLinkRecord | null> {
		const row = this.rows.get(userId);
		return Promise.resolve(row === undefined || row.isDeleted ? null : row);
	}

	public upsert(input: GithubAccountLinkInput): Promise<GithubAccountLinkRecord> {
		const row: StoredGithubAccountLink = { ...input, status: ACTIVE, linkedAt: this.clock.nowEpochMs(), isDeleted: false, deletedBy: null };
		this.rows.set(input.userId, row);
		return Promise.resolve(row);
	}

	public unlink(userId: string, actorUserId: string): Promise<boolean> {
		const row = this.rows.get(userId);
		if (row === undefined || row.isDeleted) {
			return Promise.resolve(false);
		}
		this.rows.set(userId, { ...row, isDeleted: true, deletedBy: actorUserId, token: { ciphertext: "", keyVersion: row.token.keyVersion } });
		return Promise.resolve(true);
	}

	public markRejected(userId: string): Promise<void> {
		const row = this.rows.get(userId);
		if (row !== undefined && !row.isDeleted && row.status === ACTIVE) {
			this.rows.set(userId, { ...row, status: REJECTED });
		}
		return Promise.resolve();
	}
}

/** The read port over the same rows, recording which actor read. */
export class InMemoryGithubAccountLinkReads implements GithubAccountLinkReadPort {
	public readonly readers: ActorContext[] = [];

	public constructor(private readonly links: InMemoryGithubAccountLinks) {}

	public findLive(actor: ActorContext, userId: string): Promise<GithubAccountLinkRecord | null> {
		this.readers.push(actor);
		return this.links.findLive(userId);
	}
}

/** A unit of work over the in-memory links. */
export function githubUnitOfWork(links: InMemoryGithubAccountLinks): InMemoryUnitOfWork<GithubScope> {
	return new InMemoryUnitOfWork<GithubScope>({ accountLinks: links, events: new TransactionalEventCollector() });
}

/** Records every invalidation instead of dropping anything. */
export class RecordingPullRequestCache implements GithubPullRequestCachePort {
	public readonly users: string[] = [];
	public readonly pullRequests: string[] = [];

	public invalidateUser(userId: string): void {
		this.users.push(userId);
	}

	public invalidatePullRequest(owner: string, repository: string, number: number): void {
		this.pullRequests.push(`${owner}/${repository}#${String(number)}`);
	}
}

/** One read the fake answered: which view, for whom, with which token. */
export interface RecordedRead {
	readonly view: string;
	readonly userId: string;
	readonly token: string;
	readonly input: string;
}

/** Answers every read with a fixed contract value, or fails with `failure` (GitHub refusing, being down). */
export class FakePullRequestReads implements GithubPullRequestReadsPort {
	public readonly reads: RecordedRead[] = [];
	public failure: Error | null = null;

	public list(userId: string, linked: LinkedGithubCredential, query: GithubPullRequestListQuery): Promise<GithubPullRequestPage> {
		return this.answer("list", userId, linked, JSON.stringify(query), PULL_REQUEST_PAGE);
	}

	public detail(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams): Promise<GithubPullRequestDetail> {
		return this.answer("detail", userId, linked, JSON.stringify(params), PULL_REQUEST_DETAIL);
	}

	public timeline(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams, cursor: string | undefined): Promise<GithubTimelinePage> {
		return this.answer("timeline", userId, linked, JSON.stringify({ params, cursor: cursor ?? null }), TIMELINE_PAGE);
	}

	public commits(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams, cursor: string | undefined): Promise<GithubPullRequestCommitPage> {
		return this.answer("commits", userId, linked, JSON.stringify({ params, cursor: cursor ?? null }), COMMIT_PAGE);
	}

	public files(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams, page: number): Promise<GithubPullRequestFilePage> {
		return this.answer("files", userId, linked, JSON.stringify({ params, page }), FILE_PAGE);
	}

	public commit(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestCommitParams): Promise<GithubCommitDetail> {
		return this.answer("commit", userId, linked, JSON.stringify(params), COMMIT_DETAIL);
	}

	public status(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams): Promise<GithubPullRequestStatus> {
		return this.answer("status", userId, linked, JSON.stringify(params), PULL_REQUEST_STATUS);
	}

	public reviewThreads(userId: string, linked: LinkedGithubCredential, params: GithubPullRequestParams): Promise<GithubReviewThreadList> {
		return this.answer("reviewThreads", userId, linked, JSON.stringify(params), REVIEW_THREADS);
	}

	public contentEdits(userId: string, linked: LinkedGithubCredential, nodeId: string): Promise<GithubContentEditHistory> {
		return this.answer("contentEdits", userId, linked, nodeId, CONTENT_EDITS);
	}

	private answer<T>(view: string, userId: string, linked: LinkedGithubCredential, input: string, value: T): Promise<T> {
		this.reads.push({ view, userId, token: linked.token, input });
		return this.failure === null ? Promise.resolve(value) : Promise.reject(this.failure);
	}
}

/** One write the fake made on "GitHub", in order. */
export interface RecordedWrite {
	readonly kind: string;
	readonly token: string;
	readonly detail: string;
}

/** Writes as the caller's account; a failure per write kind stands in for GitHub refusing it. */
export class FakePullRequestWrites implements GithubPullRequestWritesPort {
	public readonly writes: RecordedWrite[] = [];
	public readonly failures: Map<string, Error> = new Map<string, Error>();
	public head: GithubHeadBranch = { isCrossRepository: false, headRefName: "feature/parser" };

	public addComment(linked: LinkedGithubCredential, _params: GithubPullRequestParams, body: string): Promise<GithubComment> {
		return this.write("comment", linked, body, { ...POSTED_COMMENT, body });
	}

	public submitReview(linked: LinkedGithubCredential, _params: GithubPullRequestParams, event: GithubReviewEvent, body: string): Promise<GithubReview> {
		return this.write("review", linked, `${event}:${body}`, { ...SUBMITTED_REVIEW, body });
	}

	public setReaction(
		linked: LinkedGithubCredential,
		_params: GithubPullRequestParams,
		subject: GithubReactionSubject,
		content: GithubReactionContent,
		reacted: boolean,
	): Promise<void> {
		return this.write("reaction", linked, `${subject.type}:${content}:${String(reacted)}`, undefined);
	}

	public merge(linked: LinkedGithubCredential, _params: GithubPullRequestParams, merge: GithubMergeRequest): Promise<string> {
		return this.write("merge", linked, `${merge.method}@${merge.sha}:${merge.title}|${merge.message}`, MERGE_SHA);
	}

	public headBranch(linked: LinkedGithubCredential): Promise<GithubHeadBranch> {
		return this.write("headBranch", linked, "", this.head);
	}

	public deleteBranch(linked: LinkedGithubCredential, _params: GithubPullRequestParams, branch: string): Promise<void> {
		return this.write("deleteBranch", linked, branch, undefined);
	}

	private write<T>(kind: string, linked: LinkedGithubCredential, detail: string, value: T): Promise<T> {
		const failure = this.failures.get(kind);
		if (failure !== undefined) {
			return Promise.reject(failure);
		}
		this.writes.push({ kind, token: linked.token, detail });
		return Promise.resolve(value);
	}
}

/** A PNG's magic bytes — what a picture read back from "GitHub" holds. */
export const PNG_BYTES: Buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG: DocumentMimeType = "image/png";

/** A repository's files in memory, plus the rendered bodies uploads are found in. */
export class FakeRepositoryFiles implements GithubRepositoryFilesPort {
	public readonly committed: string[] = [];
	public readonly existing: Set<string> = new Set<string>();
	/** `nodeId → attachmentId → signed link` of the bodies GitHub would render. */
	public readonly signedLinks: Map<string, Map<string, string>> = new Map<string, Map<string, string>>();
	public readonly reads: string[] = [];
	public commitFailure: Error | null = null;

	public commitFile(linked: LinkedGithubCredential, repository: GithubRepositoryParams, path: string): Promise<void> {
		if (this.commitFailure !== null) {
			return Promise.reject(this.commitFailure);
		}
		this.committed.push(`${linked.token}:${repository.owner}/${repository.repository}:${path}`);
		this.existing.add(path);
		return Promise.resolve();
	}

	public readImage(linked: LinkedGithubCredential, file: GithubRepositoryFile, maxBytes: number): Promise<GithubPicture> {
		this.reads.push(`${linked.token}:${file.path}:${String(maxBytes)}`);
		return Promise.resolve({ bytes: PNG_BYTES, mimeType: PNG });
	}

	public readSignedUpload(signedUrl: string, nodeId: string, maxBytes: number): Promise<GithubPicture> {
		this.reads.push(`${signedUrl}:${nodeId}:${String(maxBytes)}`);
		return Promise.resolve({ bytes: PNG_BYTES, mimeType: PNG });
	}

	public fileExists(_linked: LinkedGithubCredential, file: GithubRepositoryFile): Promise<boolean> {
		return Promise.resolve(this.existing.has(file.path));
	}

	public findSignedUploadLink(_linked: LinkedGithubCredential, nodeId: string, attachmentId: string): Promise<string | null> {
		return Promise.resolve(this.signedLinks.get(nodeId)?.get(attachmentId) ?? null);
	}
}

/** Uploads through the file pipeline, in memory. */
export class InMemoryCommentPictureUploads implements CommentPictureUploadsPort {
	public readonly uploads: Map<string, CommentPictureUpload> = new Map<string, CommentPictureUpload>();
	public readonly discarded: string[] = [];
	public discardFailure: Error | null = null;

	public add(upload: CommentPictureUpload): this {
		this.uploads.set(upload.id, upload);
		return this;
	}

	public find(fileId: string): Promise<CommentPictureUpload | null> {
		return Promise.resolve(this.uploads.get(fileId) ?? null);
	}

	public readBytes(): Promise<Buffer> {
		return Promise.resolve(PNG_BYTES);
	}

	public discard(fileId: string, actorUserId: string): Promise<void> {
		if (this.discardFailure !== null) {
			return Promise.reject(this.discardFailure);
		}
		this.uploads.delete(fileId);
		this.discarded.push(`${fileId}:${actorUserId}`);
		return Promise.resolve();
	}
}

/** The server's webhook settings, `null` when it receives none. */
export class FakeWebhookEndpoint implements GithubWebhookEndpointPort {
	public constructor(public settings: WebhookEndpoint | null = { url: "https://api.example.com/api/v1/github/webhook", secret: "webhook-secret" }) {}

	public endpoint(): WebhookEndpoint | null {
		return this.settings;
	}
}

/** Repository hooks on "GitHub": each create answers the next id; failures queue up per call. */
export class FakeWebhooks implements GithubWebhooksPort {
	public readonly created: bigint[] = [];
	public readonly deleted: bigint[] = [];
	public readonly createFailures: Error[] = [];
	public visible = true;
	private nextHookId = 7n;

	public canSee(): Promise<boolean> {
		return Promise.resolve(this.visible);
	}

	public createHook(): Promise<bigint> {
		const failure = this.createFailures.shift();
		if (failure !== undefined) {
			return Promise.reject(failure);
		}
		const hookId = this.nextHookId;
		this.nextHookId += 1n;
		this.created.push(hookId);
		return Promise.resolve(hookId);
	}

	public deleteHook(_linked: LinkedGithubCredential, _repository: GithubRepositoryParams, hookId: bigint): Promise<void> {
		this.deleted.push(hookId);
		return Promise.resolve();
	}
}

function repositoryKey(repository: GithubRepositoryParams): string {
	return `${repository.owner}/${repository.repository}`.toLowerCase();
}

/** Subscriptions and deliveries with the statements' race semantics: one live row per repository, one record per delivery id. */
export class InMemoryWebhookStore implements GithubWebhookStorePort {
	public readonly subscriptions: Map<string, GithubWebhookSubscriptionRecord> = new Map<string, GithubWebhookSubscriptionRecord>();
	public readonly deliveries: Map<string, GithubWebhookDeliveryInput> = new Map<string, GithubWebhookDeliveryInput>();
	public readonly announcements: string[] = [];
	public readonly prunedBefore: number[] = [];
	/** Another admin's hook that claims the repository just before the next claim does (the ON CONFLICT race). */
	public racingHookId: bigint | null = null;

	public findLive(repository: GithubRepositoryParams): Promise<GithubWebhookSubscriptionRecord | null> {
		return Promise.resolve(this.subscriptions.get(repositoryKey(repository)) ?? null);
	}

	public claim(repository: GithubRepositoryParams, githubHookId: bigint): Promise<boolean> {
		const key = repositoryKey(repository);
		if (this.racingHookId !== null) {
			this.subscriptions.set(key, { githubHookId: this.racingHookId, createdAt: AT });
			this.racingHookId = null;
		}
		if (this.subscriptions.has(key)) {
			return Promise.resolve(false);
		}
		this.subscriptions.set(key, { githubHookId, createdAt: AT });
		return Promise.resolve(true);
	}

	public release(repository: GithubRepositoryParams, githubHookId: bigint): Promise<void> {
		const key = repositoryKey(repository);
		if (this.subscriptions.get(key)?.githubHookId === githubHookId) {
			this.subscriptions.delete(key);
		}
		return Promise.resolve();
	}

	public record(delivery: GithubWebhookDeliveryInput): Promise<boolean> {
		if (this.deliveries.has(delivery.deliveryId)) {
			return Promise.resolve(false);
		}
		this.deliveries.set(delivery.deliveryId, delivery);
		this.announcements.push(delivery.announcement);
		return Promise.resolve(true);
	}

	public prune(beforeMs: number): Promise<number> {
		this.prunedBefore.push(beforeMs);
		const old = [...this.deliveries.values()].filter((delivery): boolean => delivery.receivedAt < beforeMs);
		for (const delivery of old) {
			this.deliveries.delete(delivery.deliveryId);
		}
		return Promise.resolve(old.length);
	}
}

/** Change signals the spec emits by hand. */
export class ManualChangeSignals implements GithubChangeSignalsPort {
	public readonly signals: Subject<GithubChangeSignal> = new Subject<GithubChangeSignal>();

	public observe(): Observable<GithubChangeSignal> {
		return this.signals.asObservable();
	}
}

/** GitHub refusing a linked token mid-use. */
export function tokenRejected(): GithubLinkedTokenRejectedError {
	return new GithubLinkedTokenRejectedError();
}
