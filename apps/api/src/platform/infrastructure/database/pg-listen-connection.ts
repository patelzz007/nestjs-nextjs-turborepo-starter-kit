// A dedicated `pg` client that LISTENs on PostgreSQL channels — the live
// signals of the audit trail (prisma/rls/95-audit-trail-notify.sql) and of
// GitHub pull requests (the webhook receiver's pg_notify). Not from a pool: a
// LISTEN belongs to its session, and a pooled client would be handed to other
// work. Every API instance listens, so a NOTIFY reaches all of them.

import { Client, type Notification } from "pg";

/** What a listener needs of the connection — a fake implements it in tests. */
export interface ListenConnection {
	connect(): Promise<void>;
	/** Starts receiving one channel's notifications. */
	listen(channel: string): Promise<void>;
	/** Each notification's channel and payload (`null` when sent without one). */
	onNotification(listener: (channel: string, payload: string | null) => void): void;
	/** The connection failed (`error`) or ended (`null`); it will not recover by itself. */
	onClose(listener: (error: Error | null) => void): void;
	close(): Promise<void>;
}

/** Opens a new, not yet connected, listen connection. */
export type OpenListenConnection = () => ListenConnection;

/** A channel name is an identifier: LISTEN cannot take it as a bound parameter, so only plain identifiers are accepted. */
const CHANNEL_PATTERN = /^[a-z_][a-z0-9_]*$/;

export class PgListenConnection implements ListenConnection {
	private readonly client: Client;

	/** `applicationName` names the session in `pg_stat_activity` (`audit-trail-listener`, …). */
	public constructor(connectionString: string, applicationName: string) {
		this.client = new Client({ connectionString, application_name: applicationName });
	}

	public async connect(): Promise<void> {
		await this.client.connect();
	}

	public async listen(channel: string): Promise<void> {
		if (!CHANNEL_PATTERN.test(channel)) {
			throw new Error(`Not a channel name: ${channel}`);
		}
		await this.client.query(`LISTEN ${channel}`);
	}

	public onNotification(listener: (channel: string, payload: string | null) => void): void {
		this.client.on("notification", (notification: Notification): void => {
			listener(notification.channel, notification.payload ?? null);
		});
	}

	public onClose(listener: (error: Error | null) => void): void {
		this.client.on("error", (error: Error): void => {
			listener(error);
		});
		this.client.on("end", (): void => {
			listener(null);
		});
	}

	public async close(): Promise<void> {
		await this.client.end();
	}
}
