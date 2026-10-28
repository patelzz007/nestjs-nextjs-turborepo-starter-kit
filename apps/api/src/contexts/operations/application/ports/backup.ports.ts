// ============================================
// application/ports/backup.ports.ts — what taking a backup needs (ADR 068)
// ============================================
// Dependency Inversion: the application orchestrates a backup through these three ports; `pg_dump`,
// the object storage provider and BullMQ are infrastructure details behind them.

import type { Readable } from "node:stream";

/** A running dump: its bytes, and a promise that settles when `pg_dump` exits (rejects on failure). */
export interface RunningDump {
	readonly stream: Readable;
	readonly finished: Promise<void>;
}

export interface DatabaseDumpPort {
	/** Whether backups can run here, and why not when they cannot. */
	availability(): { readonly ready: true } | { readonly ready: false; readonly reason: string };
	/** The versions of the dump tool that will be used and of the server (recorded on the backup). */
	versions(): Promise<{ readonly pgDumpVersion: string; readonly serverVersion: string }>;
	/** Starts `pg_dump --format=custom` of the whole database. */
	dump(): Promise<RunningDump>;
}

/** Where a stored backup is. */
export interface StoredBackup {
	readonly container: string;
	readonly path: string;
	readonly sizeBytes: number;
	/** Hex SHA-256 of the stored bytes. */
	readonly checksum: string;
}

export interface BackupStoragePort {
	/** Streams one backup into private, encrypted storage (multipart where the provider supports it). */
	store(backupId: string, takenAt: number, bytes: Readable): Promise<StoredBackup>;
	/** The stored bytes, or `null` when the object is gone. */
	open(container: string, path: string): Promise<Readable | null>;
	remove(container: string, path: string): Promise<void>;
}

export interface BackupQueuePort {
	/** Hands a queued backup to the worker (or runs it in this process when there is no queue). */
	enqueue(backupId: string): Promise<void>;
}

export const DATABASE_DUMP = Symbol("DATABASE_DUMP");
export const BACKUP_STORAGE = Symbol("BACKUP_STORAGE");
export const BACKUP_QUEUE = Symbol("BACKUP_QUEUE");
