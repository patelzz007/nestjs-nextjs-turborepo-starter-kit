// ============================================
// github-pull-request-changes.hub.ts - Changes announced by webhook, on every API instance (ADR 052)
// ============================================
// The webhook receiver records a delivery and announces its change with
// pg_notify (GITHUB_PULL_REQUEST_CHANNEL), so every API instance hears it —
// whichever one GitHub happened to reach. Each instance keeps one listener
// while live updates are configured: on a change it drops its cached reads of
// that pull request (for every user) and hands the change to its open streams.
// A lost connection reconnects with backoff; on reconnect every stream is told
// to reload, since changes may have been missed meanwhile.

import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { GithubPullRequestChangeSchema, type GithubPullRequestChange } from "@workspace/shared";
import { Observable, Subject } from "rxjs";

import { TypedConfigService } from "../../../../config/typed-config.service";
import type { ListenConnection, OpenListenConnection } from "../../../../platform/infrastructure/database/pg-listen-connection";
import { GithubPullRequestCache } from "../github-api/github-pull-request.cache";
import type { GithubChangeSignal, GithubChangeSignalsPort } from "../../application/ports/github-live-updates.port";
import { GITHUB_PULL_REQUEST_CHANNEL } from "../persistence/prisma-github-webhook.store";

export const GITHUB_CHANGES_LISTEN_CONNECTION = Symbol("GITHUB_CHANGES_LISTEN_CONNECTION");

/** Reconnect backoff: 1 s, 2 s, 4 s … at most 30 s. */
const RECONNECT_INITIAL_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

@Injectable()
export class GithubPullRequestChangesHub implements GithubChangeSignalsPort, OnModuleInit, OnModuleDestroy {
	private readonly logger: Logger = new Logger(GithubPullRequestChangesHub.name);
	private readonly signals: Subject<GithubChangeSignal> = new Subject<GithubChangeSignal>();
	private connection: ListenConnection | null = null;
	private retry: NodeJS.Timeout | null = null;
	private failedAttempts = 0;
	private stopped = false;

	public constructor(
		private readonly config: TypedConfigService,
		private readonly cache: GithubPullRequestCache,
		@Inject(GITHUB_CHANGES_LISTEN_CONNECTION) private readonly openConnection: OpenListenConnection,
	) {}

	public onModuleInit(): void {
		if (this.config.github.webhook !== null) {
			void this.listen(false);
		}
	}

	public async onModuleDestroy(): Promise<void> {
		this.stopped = true;
		if (this.retry !== null) {
			clearTimeout(this.retry);
			this.retry = null;
		}
		const connection = this.connection;
		this.connection = null;
		if (connection !== null) {
			await this.closeQuietly(connection);
		}
	}

	public observe(): Observable<GithubChangeSignal> {
		return this.signals.asObservable();
	}

	/** Applies one announced change on this instance: cached reads dropped, streams told. */
	public apply(change: GithubPullRequestChange): void {
		if (change.number === null) {
			this.cache.invalidateRepository(change.owner, change.repository);
		} else {
			this.cache.invalidatePullRequest(change.owner, change.repository, change.number);
		}
		this.signals.next({ kind: "change", change });
	}

	private async listen(isReconnect: boolean): Promise<void> {
		const connection = this.openConnection();
		this.connection = connection;
		connection.onNotification((_channel: string, payload: string | null): void => {
			this.receive(payload);
		});
		connection.onClose((error: Error | null): void => {
			this.handleLoss(connection, error);
		});
		try {
			await connection.connect();
			await connection.listen(GITHUB_PULL_REQUEST_CHANNEL);
		} catch (error: unknown) {
			this.handleLoss(connection, error instanceof Error ? error : null);
			return;
		}
		this.failedAttempts = 0;
		if (isReconnect) {
			this.signals.next({ kind: "resync" });
		}
	}

	private receive(payload: string | null): void {
		try {
			const change = GithubPullRequestChangeSchema.safeParse(JSON.parse(payload ?? "null"));
			if (change.success) {
				this.apply(change.data);
				return;
			}
		} catch {
			// Not JSON: reported below like any other unreadable announcement.
		}
		this.logger.warn(`Ignored an unreadable pull-request change announcement: ${payload ?? "(none)"}`);
	}

	private handleLoss(connection: ListenConnection, error: Error | null): void {
		if (this.connection !== connection) {
			return;
		}
		this.connection = null;
		void this.closeQuietly(connection);
		if (this.stopped) {
			return;
		}
		const delayMs = Math.min(RECONNECT_MAX_MS, RECONNECT_INITIAL_MS * 2 ** this.failedAttempts);
		this.failedAttempts += 1;
		this.logger.warn(`The pull-request change listener lost its connection (${error?.message ?? "ended"}); reconnecting in ${String(delayMs)} ms`);
		this.retry = setTimeout((): void => {
			this.retry = null;
			if (!this.stopped && this.connection === null) {
				void this.listen(true);
			}
		}, delayMs);
	}

	private async closeQuietly(connection: ListenConnection): Promise<void> {
		try {
			await connection.close();
		} catch (error: unknown) {
			this.logger.debug(`Closing the pull-request change listener failed: ${error instanceof Error ? error.message : "unknown"}`);
		}
	}
}
