// ============================================
// audit-trail-events.service.ts - the audit trail's live signal
// ============================================
// Every audit entry the database writes NOTIFYs `audit_trail`
// (prisma/rls/95-audit-trail-notify.sql) — requests through the API and
// background writes alike. This service holds ONE listening connection while
// at least one admin has the audit log open, and turns each notification into
// a "something changed" signal; the page then refetches through the normal,
// authorized list endpoint. No audit content travels on the signal.
//
// The connection opens with the first subscriber and closes with the last.
// When it drops, it reconnects with backoff and then signals once, because
// entries may have been written while it was down.

import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Observable, Subject } from "rxjs";

import type { ListenConnection, OpenListenConnection } from "../../../infrastructure/database/pg-listen-connection";
import { AUDIT_TRAIL_CHANNEL, AUDIT_TRAIL_LISTEN_CONNECTION } from "./audit-trail-listen-connection";

/** Reconnect backoff: 1 s, 2 s, 4 s … at most 30 s. */
export const AUDIT_TRAIL_RECONNECT_INITIAL_MS = 1_000;
export const AUDIT_TRAIL_RECONNECT_MAX_MS = 30_000;

/** Delay before reconnect attempt `attempt` (0-based). */
export function reconnectDelayMs(attempt: number): number {
	return Math.min(AUDIT_TRAIL_RECONNECT_MAX_MS, AUDIT_TRAIL_RECONNECT_INITIAL_MS * 2 ** attempt);
}

@Injectable()
export class AuditTrailEventsService implements OnModuleDestroy {
	private readonly logger: Logger = new Logger(AuditTrailEventsService.name);
	private readonly signals: Subject<void> = new Subject<void>();
	private subscribers = 0;
	private connection: ListenConnection | null = null;
	private retry: NodeJS.Timeout | null = null;
	private failedAttempts = 0;

	public constructor(@Inject(AUDIT_TRAIL_LISTEN_CONNECTION) private readonly openConnection: OpenListenConnection) {}

	/** "Something changed" signals; subscribing opens the shared listener, the last unsubscribe closes it. */
	public observe(): Observable<void> {
		return new Observable<void>((subscriber) => {
			const subscription = this.signals.subscribe(subscriber);
			this.subscribers += 1;
			if (this.subscribers === 1) {
				void this.listen(false);
			}
			return (): void => {
				subscription.unsubscribe();
				this.subscribers -= 1;
				if (this.subscribers === 0) {
					void this.stop();
				}
			};
		});
	}

	public async onModuleDestroy(): Promise<void> {
		await this.stop();
	}

	private async listen(isReconnect: boolean): Promise<void> {
		const connection = this.openConnection();
		this.connection = connection;
		connection.onNotification((): void => {
			this.signals.next();
		});
		connection.onClose((error: Error | null): void => {
			this.handleLoss(connection, error);
		});
		try {
			await connection.connect();
			await connection.listen(AUDIT_TRAIL_CHANNEL);
		} catch (error: unknown) {
			this.handleLoss(connection, error instanceof Error ? error : null);
			return;
		}
		if (this.connection !== connection) {
			// Stopped while connecting: the last subscriber left.
			await this.closeQuietly(connection);
			return;
		}
		this.failedAttempts = 0;
		if (isReconnect) {
			this.signals.next();
		}
	}

	private handleLoss(connection: ListenConnection, error: Error | null): void {
		if (this.connection !== connection) {
			return;
		}
		this.connection = null;
		void this.closeQuietly(connection);
		if (this.subscribers === 0) {
			return;
		}
		const delayMs = reconnectDelayMs(this.failedAttempts);
		this.failedAttempts += 1;
		this.logger.warn(`The audit trail listener lost its connection (${error?.message ?? "ended"}); reconnecting in ${String(delayMs)} ms`);
		this.retry = setTimeout((): void => {
			this.retry = null;
			if (this.subscribers > 0 && this.connection === null) {
				void this.listen(true);
			}
		}, delayMs);
	}

	private async stop(): Promise<void> {
		if (this.retry !== null) {
			clearTimeout(this.retry);
			this.retry = null;
		}
		const connection = this.connection;
		this.connection = null;
		this.failedAttempts = 0;
		if (connection !== null) {
			await this.closeQuietly(connection);
		}
	}

	private async closeQuietly(connection: ListenConnection): Promise<void> {
		try {
			await connection.close();
		} catch (error: unknown) {
			this.logger.debug(`Closing the audit trail listener failed: ${error instanceof Error ? error.message : "unknown"}`);
		}
	}
}
