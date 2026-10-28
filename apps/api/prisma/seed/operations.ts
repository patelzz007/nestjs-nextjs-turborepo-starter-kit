import { createHash } from "node:crypto";

import type { OpsDependency, OpsResolution, Prisma } from "@prisma/client";
import { DEV_LAPTOP_AGENT_TOKEN, LOAD_TEST_DEFAULT_CAPS, OPS_DEFAULT_ALERT_SETTINGS, OPS_DEFAULT_BACKUP_SCHEDULE, OPS_HOUR_MS, OPS_MINUTE_MS } from "@workspace/shared";
import { z } from "zod";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";

// ---------------------------------------------------------------------------
// The operations console (ADR 068), so every screen and every column has realistic data after
// `db:seed`:
//
//   OpsServer            "This laptop" (the developer's machine; `pnpm dev` starts its agent with
//                         SEED_LOCAL_AGENT_TOKEN), a DigitalOcean droplet, and a revoked server
//   OpsServerSample      the last hour by minute and the last day by hour, for both live servers
//   OpsInstanceSample    an API instance's last hour
//   OpsDependencySample  each dependency's last hour
//   OpsAlert             an open disk alert and a resolved CPU alert
//   OpsSettings          the defaults, plus OPS_ALERT_EXTRA_RECIPIENTS from your own .env
//   OpsBackup            a pinned finished backup, a failed one and a deleted one
//   LoadTestRun / …      a passed scenario run, a failed traffic mix and an aborted endpoint run,
//                         with their seconds and steps
//
// Idempotent: every row is upserted on a deterministic id or its natural unique key.
// ---------------------------------------------------------------------------

const NAMESPACE = "seed.operations";

/** The laptop agent's token in development (only its digest is stored, as for every server). */
export const SEED_LOCAL_AGENT_TOKEN = DEV_LAPTOP_AGENT_TOKEN;

/** The extra alert recipients from YOUR .env (comma-separated), so they are never committed. */
const ExtraRecipientsSchema = z
	.string()
	.optional()
	.transform((value) =>
		(value ?? "")
			.split(",")
			.map((entry) => entry.trim().toLowerCase())
			.filter((entry) => entry.length > 0),
	)
	.pipe(z.array(z.email()));

const GIB = 1_024 * 1_024 * 1_024;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const SECONDS_PER_RUN = 60;

function sha256(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

/** A smooth, deterministic wave between `low` and `high` (the same numbers on every re-seed). */
function wave(index: number, low: number, high: number, period: number): number {
	const middle = (low + high) / 2;
	const swing = (high - low) / 2;
	return round2(middle + swing * Math.sin((index / period) * 2 * Math.PI));
}

function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

function clamp(value: number, low: number, high: number): number {
	return Math.min(high, Math.max(low, value));
}

/** Deterministic noise in [0, 1) for a time and a salt (the same chart on every re-seed). */
function noise(at: number, salt: number): number {
	const x = Math.sin((at / OPS_MINUTE_MS) * 12.9898 + salt * 78.233) * 43_758.5453;
	return x - Math.floor(x);
}

/** The platform's (Malaysian) local time is UTC+8. */
const LOCAL_OFFSET_MS = 8 * OPS_HOUR_MS;
const DAY_MS = HOURS_PER_DAY * OPS_HOUR_MS;
const SUNDAY = 0;
const SATURDAY = 6;

/**
 * How busy the platform is at `at`, 0–1: quiet before dawn, busiest mid-afternoon (local time), and
 * about a third quieter at weekends — so the charts look like a real week, not a sine wave.
 */
function busyness(at: number): number {
	const local = at + LOCAL_OFFSET_MS;
	const hour = (local % DAY_MS) / OPS_HOUR_MS;
	const daily = 0.5 - 0.5 * Math.cos((2 * Math.PI * (hour - 3)) / HOURS_PER_DAY);
	const weekday = new Date(local).getUTCDay();
	return daily * (weekday === SUNDAY || weekday === SATURDAY ? 0.65 : 1);
}

/** `low`–`high` by how busy it is at `at`, with a little jitter. */
function byLoad(at: number, salt: number, low: number, high: number, jitter = 0.08): number {
	return round2(low + (high - low) * clamp(busyness(at) + (noise(at, salt) - 0.5) * 2 * jitter, 0, 1));
}

/** One server's figures, as a load profile: how hard it works and how big it is. */
interface ServerProfile {
	readonly serverId: string;
	readonly salt: number;
	readonly cpuLow: number;
	readonly cpuHigh: number;
	readonly memoryTotal: number;
	readonly diskTotal: number;
	/** The disk's fill a year ago and now: it creeps up. */
	readonly diskFromPercent: number;
	readonly diskToPercent: number;
}

const YEAR_MS = 365 * DAY_MS;
/** One bucket in this many is a CPU spike (a deploy, a cron job, a busy minute). */
const SPIKE_CHANCE = 0.012;

function serverPoint(profile: ServerProfile, resolution: OpsResolution, bucketStart: number, index: number, now: number): Prisma.OpsServerSampleUncheckedCreateInput {
	const spike = noise(bucketStart, profile.salt + 1) < SPIKE_CHANCE ? 30 : 0;
	const cpu = clamp(byLoad(bucketStart, profile.salt, profile.cpuLow, profile.cpuHigh) + spike, 1, 100);
	const peakSpread = resolution === "HOUR" ? 22 : 9;
	const memoryPercent = byLoad(bucketStart, profile.salt + 2, 46, 74, 0.05);
	const age = clamp((now - bucketStart) / YEAR_MS, 0, 1);
	const diskPercent = round2(profile.diskToPercent - (profile.diskToPercent - profile.diskFromPercent) * age);
	return {
		id: deterministicUuid(NAMESPACE, `server-sample:${profile.serverId}:${resolution}:${String(index)}`),
		serverId: profile.serverId,
		resolution,
		bucketStart: BigInt(bucketStart),
		cpuPercentAvg: round2(cpu),
		cpuPercentMax: round2(Math.min(100, cpu + peakSpread * (0.4 + noise(bucketStart, profile.salt + 3)))),
		stealPercentAvg: byLoad(bucketStart, profile.salt + 4, 0, 2.5),
		iowaitPercentAvg: byLoad(bucketStart, profile.salt + 5, 0.2, 4.5, 0.2),
		load1Avg: byLoad(bucketStart, profile.salt + 6, 0.2, 2.8),
		memoryUsedBytes: BigInt(Math.round((profile.memoryTotal * memoryPercent) / 100)),
		memoryTotalBytes: BigInt(profile.memoryTotal),
		memoryPercentMax: round2(Math.min(100, memoryPercent + 3 + noise(bucketStart, profile.salt + 7) * 4)),
		swapUsedBytes: BigInt(Math.round(byLoad(bucketStart, profile.salt + 8, 0, 0.4) * GIB)),
		diskUsedBytes: BigInt(Math.round((profile.diskTotal * diskPercent) / 100)),
		diskTotalBytes: BigInt(profile.diskTotal),
		diskPercentMax: diskPercent,
		inodesPercentMax: round2(diskPercent / 3),
		diskReadBytesPerSec: byLoad(bucketStart, profile.salt + 9, 40_000, 1_400_000, 0.2),
		diskWriteBytesPerSec: byLoad(bucketStart, profile.salt + 10, 120_000, 3_200_000, 0.2),
		netRxBytesPerSec: byLoad(bucketStart, profile.salt + 11, 60_000, 2_600_000),
		netTxBytesPerSec: byLoad(bucketStart, profile.salt + 12, 40_000, 1_900_000),
		tcpConnections: Math.round(byLoad(bucketStart, profile.salt + 13, 30, 260)),
		processCount: Math.round(byLoad(bucketStart, profile.salt + 14, 180, 250, 0.1)),
	};
}

/** The buckets of the last `count` buckets of `size` before `end`, oldest first. */
function bucketStarts(end: number, size: number, count: number): number[] {
	return Array.from({ length: count }, (_unused, index) => end - (count - index) * size);
}

/** Inserts rows in batches (one statement per batch keeps a year of history fast to seed). */
async function insertInBatches<Row>(rows: readonly Row[], insert: (batch: Row[]) => Promise<{ count: number }>): Promise<number> {
	const batchSize = 2_000;
	let inserted = 0;
	for (let start = 0; start < rows.length; start += batchSize) {
		inserted += (await insert(rows.slice(start, start + batchSize))).count;
	}
	return inserted;
}

/** History lengths: a day of minutes (the 1h–24h charts), a year of hours for servers, a month for the rest. */
const MINUTE_BUCKETS = HOURS_PER_DAY * MINUTES_PER_HOUR;
const SERVER_HOUR_BUCKETS = 365 * HOURS_PER_DAY;
const OTHER_HOUR_BUCKETS = 30 * HOURS_PER_DAY;

const DEPENDENCIES: readonly OpsDependency[] = ["POSTGRES", "REDIS", "QUEUES", "KAFKA", "RABBITMQ", "ENDPOINTS"];

/** The figure columns of one dependency's minute (the others stay null, as the API writes them). */
function dependencyFigures(dependency: OpsDependency, index: number): Partial<Prisma.OpsDependencySampleUncheckedCreateInput> {
	switch (dependency) {
		case "POSTGRES":
			return { connectionsUsed: Math.round(wave(index, 8, 26, 20)), sizeBytes: BigInt(Math.round(1.2 * GIB) + index * 40_000) };
		case "REDIS":
			return { connectionsUsed: 14, memoryUsedBytes: BigInt(Math.round(wave(index, 22, 31, 30) * 1_024 * 1_024)) };
		case "QUEUES":
			return { backlog: Math.round(wave(index, 0, 9, 7)), failed: 3 };
		case "KAFKA":
			return { backlog: Math.round(wave(index, 0, 40, 11)) };
		case "RABBITMQ":
		case "ENDPOINTS":
			return {};
	}
}

export async function seedOperations(
	input: { readonly superAdminId: string; readonly developerId: string },
	now: number,
): Promise<{ servers: number; samples: number; alerts: number; backups: number; loadTests: number }> {
	const minuteNow = Math.floor(now / OPS_MINUTE_MS) * OPS_MINUTE_MS;
	const hourNow = Math.floor(now / OPS_HOUR_MS) * OPS_HOUR_MS;

	await prisma.opsSettings.upsert({
		where: { key: "default" },
		update: { extraRecipients: ExtraRecipientsSchema.parse(process.env.OPS_ALERT_EXTRA_RECIPIENTS) },
		create: {
			key: "default",
			...OPS_DEFAULT_ALERT_SETTINGS,
			extraRecipients: ExtraRecipientsSchema.parse(process.env.OPS_ALERT_EXTRA_RECIPIENTS),
			backupHour: OPS_DEFAULT_BACKUP_SCHEDULE.backupHour,
			backupRetentionDays: OPS_DEFAULT_BACKUP_SCHEDULE.retentionDays,
			loadMaxVus: LOAD_TEST_DEFAULT_CAPS.maxVirtualUsers,
			loadMaxRps: LOAD_TEST_DEFAULT_CAPS.maxRequestsPerSecond,
			loadMaxMinutes: LOAD_TEST_DEFAULT_CAPS.maxMinutes,
			loadMaxSoakMinutes: LOAD_TEST_DEFAULT_CAPS.maxSoakMinutes,
		},
	});

	// ── Servers ────────────────────────────────────────────────────────────
	const laptopId = deterministicUuid(NAMESPACE, "server:laptop");
	const dropletId = deterministicUuid(NAMESPACE, "server:droplet");
	const revokedId = deterministicUuid(NAMESPACE, "server:revoked");
	const servers: Prisma.OpsServerUncheckedCreateInput[] = [
		{
			id: laptopId,
			name: "This laptop",
			provider: "LOCAL",
			providerServerId: null,
			agentTokenHash: sha256(SEED_LOCAL_AGENT_TOKEN),
			agentTokenPrefix: SEED_LOCAL_AGENT_TOKEN.slice(0, 16),
			lastSeenAt: BigInt(minuteNow),
			agentVersion: "1.0.0",
			hostname: "developer-laptop.local",
			os: "macOS 27.0",
			kernel: "Darwin 27.0.0",
			cpuModel: "Apple M4 Pro",
			cpuCores: 12,
			memoryTotalBytes: BigInt(36 * GIB),
			uptimeSeconds: BigInt(3 * 86_400),
		},
		{
			id: dropletId,
			name: "web-01",
			provider: "DIGITALOCEAN",
			providerServerId: "512345678",
			agentTokenHash: sha256("opsagent_seed-droplet-token"),
			agentTokenPrefix: "opsagent_seed-dr",
			lastSeenAt: BigInt(minuteNow),
			agentVersion: "1.0.0",
			hostname: "web-01",
			os: "Ubuntu 24.04.3 LTS",
			kernel: "Linux 6.8.0-71-generic",
			cpuModel: "DO-Premium-AMD",
			cpuCores: 4,
			memoryTotalBytes: BigInt(8 * GIB),
			uptimeSeconds: BigInt(41 * 86_400),
		},
		{
			id: revokedId,
			name: "old-worker",
			provider: "HETZNER",
			providerServerId: "40112233",
			agentTokenHash: sha256("opsagent_seed-revoked-token"),
			agentTokenPrefix: "opsagent_seed-re",
			lastSeenAt: BigInt(minuteNow - 30 * HOURS_PER_DAY * OPS_HOUR_MS),
			agentVersion: "0.9.0",
			hostname: "old-worker",
			os: "Debian 12",
			kernel: "Linux 6.1.0-27-amd64",
			cpuModel: "AMD EPYC",
			cpuCores: 2,
			memoryTotalBytes: BigInt(4 * GIB),
			uptimeSeconds: BigInt(90 * 86_400),
			isDeleted: true,
			deletedAt: BigInt(minuteNow - 29 * HOURS_PER_DAY * OPS_HOUR_MS),
			deletedBy: input.superAdminId,
		},
	];
	for (const server of servers) {
		await prisma.opsServer.upsert({ where: { id: server.id ?? "" }, update: {}, create: server });
	}

	// ── History ────────────────────────────────────────────────────────────
	let samples = 0;
	const profiles: readonly ServerProfile[] = [
		{ serverId: laptopId, salt: 1, cpuLow: 6, cpuHigh: 48, memoryTotal: 36 * GIB, diskTotal: 1_000 * GIB, diskFromPercent: 41, diskToPercent: 58 },
		{ serverId: dropletId, salt: 50, cpuLow: 9, cpuHigh: 71, memoryTotal: 8 * GIB, diskTotal: 160 * GIB, diskFromPercent: 63, diskToPercent: 88 },
	];
	for (const profile of profiles) {
		const rows: Prisma.OpsServerSampleUncheckedCreateInput[] = [
			...bucketStarts(minuteNow, OPS_MINUTE_MS, MINUTE_BUCKETS).map((at, index) => serverPoint(profile, "MINUTE", at, index, now)),
			...bucketStarts(hourNow, OPS_HOUR_MS, SERVER_HOUR_BUCKETS).map((at, index) => serverPoint(profile, "HOUR", at, index, now)),
		];
		samples += await insertInBatches(rows, (batch) => prisma.opsServerSample.createMany({ data: batch, skipDuplicates: true }));
	}
	const instances = [
		{ instanceId: "developer-laptop.local:4242:1767225600000", hostname: "developer-laptop.local", salt: 100, requestsHigh: 900 },
		{ instanceId: "web-01:1:1767225600000", hostname: "web-01", salt: 200, requestsHigh: 4_200 },
	];
	for (const instance of instances) {
		const instanceRow = (resolution: OpsResolution, at: number, index: number): Prisma.OpsInstanceSampleUncheckedCreateInput => {
			const perBucket = resolution === "HOUR" ? MINUTES_PER_HOUR : 1;
			const requests = Math.round(byLoad(at, instance.salt, 40, instance.requestsHigh) * perBucket);
			const errorBurst = noise(at, instance.salt + 1) < SPIKE_CHANCE;
			const p95 = byLoad(at, instance.salt + 2, 28, 140, 0.15) + (errorBurst ? 300 : 0);
			return {
				id: deterministicUuid(NAMESPACE, `instance-sample:${instance.instanceId}:${resolution}:${String(index)}`),
				instanceId: instance.instanceId,
				service: "api",
				hostname: instance.hostname,
				version: "v1",
				resolution,
				bucketStart: BigInt(at),
				cpuPercentAvg: byLoad(at, instance.salt + 3, 2, 42),
				cpuPercentMax: byLoad(at, instance.salt + 4, 8, 78),
				rssBytes: BigInt(Math.round(byLoad(at, instance.salt + 5, 210, 380) * 1_024 * 1_024)),
				heapUsedBytes: BigInt(Math.round(byLoad(at, instance.salt + 6, 90, 190) * 1_024 * 1_024)),
				eventLoopLagP99Ms: byLoad(at, instance.salt + 7, 9, 38, 0.15),
				gcPauseMs: round2(byLoad(at, instance.salt + 8, 2, 40) * perBucket),
				requestCount: requests,
				serverErrorCount: errorBurst ? Math.round(requests * 0.02) : Math.round(noise(at, instance.salt + 9) * 2 * perBucket * 0.1),
				clientErrorCount: Math.round(requests * 0.01),
				latencyP50Ms: round2(p95 / 6),
				latencyP95Ms: round2(p95),
				latencyP99Ms: round2(p95 * 2.4),
			};
		};
		samples += await insertInBatches(
			[
				...bucketStarts(minuteNow, OPS_MINUTE_MS, MINUTE_BUCKETS).map((at, index) => instanceRow("MINUTE", at, index)),
				...bucketStarts(hourNow, OPS_HOUR_MS, OTHER_HOUR_BUCKETS).map((at, index) => instanceRow("HOUR", at, index)),
			],
			(batch) => prisma.opsInstanceSample.createMany({ data: batch, skipDuplicates: true }),
		);
	}
	for (const [salt, parsed] of DEPENDENCIES.entries()) {
		const dependencyRow = (resolution: OpsResolution, at: number, index: number): Prisma.OpsDependencySampleUncheckedCreateInput => ({
			id: deterministicUuid(NAMESPACE, `dependency-sample:${parsed}:${resolution}:${String(index)}`),
			dependency: parsed,
			resolution,
			bucketStart: BigInt(at),
			// Kafka has the odd outage, so the up-time chart has something to show.
			upPercent: parsed === "KAFKA" && noise(at, salt + 300) < SPIKE_CHANCE ? (resolution === "HOUR" ? 92 : 0) : 100,
			latencyMsAvg: byLoad(at, salt + 400, 0.4, 7, 0.2),
			...dependencyFigures(parsed, index),
		});
		samples += await insertInBatches(
			[
				...bucketStarts(minuteNow, OPS_MINUTE_MS, MINUTE_BUCKETS).map((at, index) => dependencyRow("MINUTE", at, index)),
				...bucketStarts(hourNow, OPS_HOUR_MS, OTHER_HOUR_BUCKETS).map((at, index) => dependencyRow("HOUR", at, index)),
			],
			(batch) => prisma.opsDependencySample.createMany({ data: batch, skipDuplicates: true }),
		);
	}

	// ── Alerts ─────────────────────────────────────────────────────────────
	const alerts: Prisma.OpsAlertUncheckedCreateInput[] = [
		{
			id: deterministicUuid(NAMESPACE, "alert:disk"),
			subjectKind: "SERVER",
			subjectId: dropletId,
			subjectName: "web-01",
			rule: "DISK_HIGH",
			openedAt: BigInt(minuteNow - 25 * OPS_MINUTE_MS),
			resolvedAt: null,
			thresholdValue: 85,
			peakValue: 88.4,
			lastValue: 87.9,
			message: "web-01 disk is 88% full",
			openNotifiedAt: BigInt(minuteNow - 25 * OPS_MINUTE_MS),
			resolveNotifiedAt: null,
		},
		{
			id: deterministicUuid(NAMESPACE, "alert:cpu"),
			subjectKind: "SERVER",
			subjectId: laptopId,
			subjectName: "This laptop",
			rule: "CPU_HIGH",
			openedAt: BigInt(minuteNow - 3 * OPS_HOUR_MS),
			resolvedAt: BigInt(minuteNow - 3 * OPS_HOUR_MS + 14 * OPS_MINUTE_MS),
			thresholdValue: 90,
			peakValue: 97.2,
			lastValue: 91.5,
			message: "This laptop CPU has been above 90% for 5 minutes (peak 97%)",
			openNotifiedAt: BigInt(minuteNow - 3 * OPS_HOUR_MS),
			resolveNotifiedAt: BigInt(minuteNow - 3 * OPS_HOUR_MS + 14 * OPS_MINUTE_MS),
		},
		{
			id: deterministicUuid(NAMESPACE, "alert:memory"),
			subjectKind: "SERVER",
			subjectId: dropletId,
			subjectName: "web-01",
			rule: "MEMORY_HIGH",
			openedAt: BigInt(minuteNow - 2 * DAY_MS),
			resolvedAt: BigInt(minuteNow - 2 * DAY_MS + 47 * OPS_MINUTE_MS),
			thresholdValue: 90,
			peakValue: 93.6,
			lastValue: 90.4,
			message: "web-01 memory is at 94%",
			openNotifiedAt: BigInt(minuteNow - 2 * DAY_MS),
			resolveNotifiedAt: BigInt(minuteNow - 2 * DAY_MS + 47 * OPS_MINUTE_MS),
		},
		{
			id: deterministicUuid(NAMESPACE, "alert:kafka"),
			subjectKind: "DEPENDENCY",
			subjectId: "KAFKA",
			subjectName: "KAFKA",
			rule: "DEPENDENCY_DOWN",
			openedAt: BigInt(minuteNow - 5 * DAY_MS),
			resolvedAt: BigInt(minuteNow - 5 * DAY_MS + 6 * OPS_MINUTE_MS),
			thresholdValue: null,
			peakValue: null,
			lastValue: null,
			message: "KAFKA is down: connect ECONNREFUSED 127.0.0.1:9092",
			openNotifiedAt: BigInt(minuteNow - 5 * DAY_MS),
			resolveNotifiedAt: BigInt(minuteNow - 5 * DAY_MS + 6 * OPS_MINUTE_MS),
		},
		{
			id: deterministicUuid(NAMESPACE, "alert:instance-silent"),
			subjectKind: "INSTANCE",
			subjectId: "web-01:1:1767225600000",
			subjectName: "api on web-01",
			rule: "SILENT",
			openedAt: BigInt(minuteNow - 6 * DAY_MS),
			resolvedAt: BigInt(minuteNow - 6 * DAY_MS + 3 * OPS_MINUTE_MS),
			thresholdValue: 3,
			peakValue: 5.2,
			lastValue: 5.2,
			message: "Instance api on web-01 stopped reporting 5 minutes ago",
			openNotifiedAt: BigInt(minuteNow - 6 * DAY_MS),
			resolveNotifiedAt: BigInt(minuteNow - 6 * DAY_MS + 3 * OPS_MINUTE_MS),
		},
		{
			id: deterministicUuid(NAMESPACE, "alert:tls"),
			subjectKind: "ENDPOINT",
			subjectId: "https://api.example.com",
			subjectName: "https://api.example.com",
			rule: "TLS_EXPIRING",
			openedAt: BigInt(minuteNow - 9 * OPS_HOUR_MS),
			resolvedAt: null,
			thresholdValue: 14,
			peakValue: 12,
			lastValue: 12,
			message: "The TLS certificate of https://api.example.com expires in 12 days",
			openNotifiedAt: BigInt(minuteNow - 9 * OPS_HOUR_MS),
			resolveNotifiedAt: null,
		},
	];
	for (const alert of alerts) {
		await prisma.opsAlert.upsert({ where: { id: alert.id ?? "" }, update: {}, create: alert });
	}

	// ── Backups ────────────────────────────────────────────────────────────
	const dayAgo = now - HOURS_PER_DAY * OPS_HOUR_MS;
	const backups: Prisma.OpsBackupUncheckedCreateInput[] = [
		{
			id: deterministicUuid(NAMESPACE, "backup:pinned"),
			status: "SUCCEEDED",
			trigger: "MANUAL",
			requestedById: input.superAdminId,
			startedAt: BigInt(dayAgo),
			finishedAt: BigInt(dayAgo + 42_000),
			sizeBytes: BigInt(184_320_512),
			checksum: sha256("seed-backup-pinned"),
			storageContainer: "private",
			storagePath: "backups/seed/pinned.dump",
			pgDumpVersion: "pg_dump (PostgreSQL) 18.1",
			serverVersion: "18.1",
			pinned: true,
			error: null,
		},
		{
			id: deterministicUuid(NAMESPACE, "backup:failed"),
			status: "FAILED",
			trigger: "SCHEDULED",
			requestedById: null,
			startedAt: BigInt(dayAgo + OPS_HOUR_MS),
			finishedAt: BigInt(dayAgo + OPS_HOUR_MS + 3_000),
			pgDumpVersion: "pg_dump (PostgreSQL) 18.1",
			serverVersion: "18.1",
			pinned: false,
			error: 'pg_dump: error: connection to server failed: FATAL: password authentication failed for user "app_backup"',
		},
		{
			id: deterministicUuid(NAMESPACE, "backup:deleted"),
			status: "SUCCEEDED",
			trigger: "SCHEDULED",
			requestedById: null,
			startedAt: BigInt(dayAgo - 20 * HOURS_PER_DAY * OPS_HOUR_MS),
			finishedAt: BigInt(dayAgo - 20 * HOURS_PER_DAY * OPS_HOUR_MS + 39_000),
			sizeBytes: BigInt(171_002_331),
			checksum: sha256("seed-backup-deleted"),
			storageContainer: "private",
			storagePath: "backups/seed/deleted.dump",
			pgDumpVersion: "pg_dump (PostgreSQL) 18.1",
			serverVersion: "18.1",
			pinned: false,
			isDeleted: true,
			deletedAt: BigInt(dayAgo - 6 * HOURS_PER_DAY * OPS_HOUR_MS),
			deletedBy: input.superAdminId,
		},
		// A week of nightly backups at the default hour, a little bigger each night.
		...Array.from({ length: 7 }, (_unused, night): Prisma.OpsBackupUncheckedCreateInput => {
			const started = hourNow - (night + 2) * DAY_MS;
			return {
				id: deterministicUuid(NAMESPACE, `backup:nightly:${String(night)}`),
				status: "SUCCEEDED",
				trigger: "SCHEDULED",
				requestedById: null,
				startedAt: BigInt(started),
				finishedAt: BigInt(started + 38_000 + night * 900),
				sizeBytes: BigInt(184_320_512 - night * 1_350_000),
				checksum: sha256(`seed-backup-nightly-${String(night)}`),
				storageContainer: "private",
				storagePath: `backups/seed/nightly-${String(night)}.dump`,
				pgDumpVersion: "pg_dump (PostgreSQL) 18.1",
				serverVersion: "18.1",
				pinned: false,
				error: null,
			};
		}),
	];
	for (const backup of backups) {
		await prisma.opsBackup.upsert({ where: { id: backup.id ?? "" }, update: {}, create: backup });
	}

	// ── Load tests ─────────────────────────────────────────────────────────
	const runs: Prisma.LoadTestRunUncheckedCreateInput[] = [
		{
			id: deterministicUuid(NAMESPACE, "run:browse"),
			name: "Marketplace browse, 200 rps",
			target: "SCENARIO",
			scenario: "browse-marketplace",
			shape: "RAMP",
			virtualUsers: 100,
			requestsPerSecond: 200,
			durationSeconds: SECONDS_PER_RUN,
			thresholdP95Ms: 300,
			thresholdErrorPercent: 1,
			status: "PASSED",
			requestedById: input.developerId,
			startedAt: BigInt(dayAgo),
			finishedAt: BigInt(dayAgo + SECONDS_PER_RUN * 1_000),
			totalRequests: 9_120,
			failedRequests: 4,
			p50Ms: 38,
			p95Ms: 142,
			p99Ms: 260,
			peakRps: 204,
		},
		{
			id: deterministicUuid(NAMESPACE, "run:mix"),
			name: "Whole platform, spike to 600 rps",
			target: "MIX",
			mixWeights: { "sign-in": 10, "browse-marketplace": 50, "claim-reward": 20, "merchant-dashboard": 15, "merchant-rewards": 5 },
			shape: "SPIKE",
			virtualUsers: 300,
			requestsPerSecond: 600,
			durationSeconds: SECONDS_PER_RUN,
			thresholdP95Ms: 400,
			thresholdErrorPercent: 1,
			status: "FAILED",
			requestedById: input.developerId,
			startedAt: BigInt(dayAgo + 2 * OPS_HOUR_MS),
			finishedAt: BigInt(dayAgo + 2 * OPS_HOUR_MS + SECONDS_PER_RUN * 1_000),
			totalRequests: 19_800,
			failedRequests: 612,
			p50Ms: 91,
			p95Ms: 780,
			p99Ms: 1_900,
			peakRps: 597,
		},
		{
			id: deterministicUuid(NAMESPACE, "run:endpoint"),
			name: "GET /rewards soak",
			target: "ENDPOINT",
			endpoint: "/rewards",
			shape: "SOAK",
			virtualUsers: 50,
			requestsPerSecond: 100,
			durationSeconds: 3_600,
			thresholdP95Ms: 250,
			thresholdErrorPercent: 0.5,
			status: "ABORTED",
			requestedById: input.superAdminId,
			startedAt: BigInt(dayAgo + 4 * OPS_HOUR_MS),
			finishedAt: BigInt(dayAgo + 4 * OPS_HOUR_MS + 12 * OPS_MINUTE_MS),
			abortRequestedAt: BigInt(dayAgo + 4 * OPS_HOUR_MS + 12 * OPS_MINUTE_MS),
			abortReason: "Aborted by an operator",
			totalRequests: 71_900,
			failedRequests: 0,
			p50Ms: 22,
			p95Ms: 61,
			p99Ms: 118,
			peakRps: 101,
			error: "The runner stopped k6 after the abort; the seconds before it are kept.",
		},
		{
			id: deterministicUuid(NAMESPACE, "run:sign-in"),
			name: "Sign-in burst before launch",
			target: "SCENARIO",
			scenario: "sign-in",
			shape: "SPIKE",
			virtualUsers: 150,
			requestsPerSecond: 300,
			durationSeconds: SECONDS_PER_RUN,
			thresholdP95Ms: 500,
			thresholdErrorPercent: 1,
			status: "PASSED",
			requestedById: input.developerId,
			startedAt: BigInt(dayAgo - 6 * DAY_MS),
			finishedAt: BigInt(dayAgo - 6 * DAY_MS + SECONDS_PER_RUN * 1_000),
			totalRequests: 14_350,
			failedRequests: 21,
			p50Ms: 120,
			p95Ms: 410,
			p99Ms: 690,
			peakRps: 302,
		},
		{
			id: deterministicUuid(NAMESPACE, "run:merchant-dashboard"),
			name: "Merchant dashboard, steady 150 rps",
			target: "SCENARIO",
			scenario: "merchant-dashboard",
			shape: "CONSTANT",
			virtualUsers: 80,
			requestsPerSecond: 150,
			durationSeconds: SECONDS_PER_RUN,
			thresholdP95Ms: 300,
			thresholdErrorPercent: 1,
			status: "PASSED",
			requestedById: input.developerId,
			startedAt: BigInt(dayAgo - 3 * DAY_MS),
			finishedAt: BigInt(dayAgo - 3 * DAY_MS + SECONDS_PER_RUN * 1_000),
			totalRequests: 8_940,
			failedRequests: 0,
			p50Ms: 44,
			p95Ms: 188,
			p99Ms: 301,
			peakRps: 151,
		},
		{
			id: deterministicUuid(NAMESPACE, "run:claim-error"),
			name: "Claim reward ramp (runner crashed)",
			target: "SCENARIO",
			scenario: "claim-reward",
			shape: "RAMP",
			virtualUsers: 120,
			requestsPerSecond: 250,
			durationSeconds: SECONDS_PER_RUN,
			thresholdP95Ms: 400,
			thresholdErrorPercent: 1,
			status: "ERROR",
			requestedById: input.superAdminId,
			startedAt: BigInt(dayAgo - 10 * DAY_MS),
			finishedAt: BigInt(dayAgo - 10 * DAY_MS + 31_000),
			totalRequests: 4_210,
			failedRequests: 97,
			p50Ms: 66,
			p95Ms: 350,
			p99Ms: 820,
			peakRps: 188,
			error: "k6 exited with code 107",
		},
	];
	for (const run of runs) {
		await prisma.loadTestRun.upsert({ where: { id: run.id ?? "" }, update: {}, create: run });
		const runId = run.id ?? "";
		const started = Number(run.startedAt ?? 0);
		await prisma.loadTestPoint.createMany({
			data: Array.from({ length: SECONDS_PER_RUN }, (_unused, second) => ({
				id: deterministicUuid(NAMESPACE, `point:${runId}:${String(second)}`),
				runId,
				second,
				at: BigInt(started + second * 1_000),
				virtualUsers: Math.min(run.virtualUsers, Math.round((run.virtualUsers * (second + 1)) / 12)),
				requests: Math.round(wave(second, run.requestsPerSecond * 0.6, run.requestsPerSecond, 20)),
				failures: Math.round(wave(second, 0, (run.failedRequests ?? 0) / SECONDS_PER_RUN, 9)),
				p50Ms: wave(second, (run.p50Ms ?? 10) * 0.8, (run.p50Ms ?? 10) * 1.2, 13),
				p95Ms: wave(second, (run.p95Ms ?? 40) * 0.8, (run.p95Ms ?? 40) * 1.2, 13),
				p99Ms: wave(second, (run.p99Ms ?? 80) * 0.8, (run.p99Ms ?? 80) * 1.2, 13),
			})),
			skipDuplicates: true,
		});
		const steps = run.target === "ENDPOINT" ? ["GET /rewards"] : ["login", "marketplace", "reward", "claim"];
		await prisma.loadTestStepStat.createMany({
			data: steps.map((step, index) => ({
				id: deterministicUuid(NAMESPACE, `step:${runId}:${step}`),
				runId,
				step,
				requests: Math.round((run.totalRequests ?? 0) / steps.length),
				failures: index === 0 ? (run.failedRequests ?? 0) : 0,
				p50Ms: (run.p50Ms ?? 10) * (1 + index * 0.2),
				p95Ms: (run.p95Ms ?? 40) * (1 + index * 0.2),
				p99Ms: (run.p99Ms ?? 80) * (1 + index * 0.2),
			})),
			skipDuplicates: true,
		});
	}

	return { servers: servers.length, samples, alerts: alerts.length, backups: backups.length, loadTests: runs.length };
}
