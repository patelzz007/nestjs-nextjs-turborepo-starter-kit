import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";

// ── Platform operations contracts (ADR 068) ─────────────────────────────────
//
// ONE definition of every bound and every shape the operations console uses:
// the server agent builds its reports from these schemas, the API validates
// them independently (never trusting the agent), and the admin panel renders
// the same types. Terms follow GLOSSARY.md → "Platform operations".

// ── Development ─────────────────────────────────────────────────────────────

/**
 * The developer laptop's agent token: `pnpm db:seed` registers "This laptop" with it and `pnpm dev`
 * starts the server agent with it (`OPS_AGENT_DEV=true`). Only a development database knows it; a
 * deployed server's token is issued by registering it in the console.
 */
export const DEV_LAPTOP_AGENT_TOKEN = "opsagent_seed-local-laptop-development-token-not-for-production";
/** Where the laptop's API listens in development. */
export const DEV_API_URL = "http://localhost:8080";

// ── Cadence and retention ───────────────────────────────────────────────────

/** How often a server agent and every instance take a live sample. */
export const OPS_SAMPLE_INTERVAL_MS = 10_000;
/** One history bucket of the fine resolution. */
export const OPS_MINUTE_MS = 60_000;
/** One history bucket of the coarse resolution. */
export const OPS_HOUR_MS = 3_600_000;
/** How long a live sample stays readable after it was written: three missed samples and it is gone. */
export const OPS_LIVE_SAMPLE_TTL_MS = 30_000;
/** An instance that has not reported for this long shows Down. */
export const OPS_INSTANCE_DOWN_AFTER_MS = 30_000;
/** Minute rows are kept this long. */
export const OPS_MINUTE_RETENTION_MS = 7 * 24 * OPS_HOUR_MS;
/** Hourly rows are kept this long. */
export const OPS_HOUR_RETENTION_MS = 365 * 24 * OPS_HOUR_MS;

// ── Bounds (the same numbers size the database columns) ─────────────────────

/** Server names (`VarChar(100)`). */
export const OPS_SERVER_NAME_MAX_LENGTH = 100;
/** Host facts the agent reports — hostname, OS, kernel, CPU model (`VarChar(200)`). */
export const OPS_HOST_FACT_MAX_LENGTH = 200;
/** Agent and application versions (`VarChar(40)`). */
export const OPS_VERSION_MAX_LENGTH = 40;
/** A server's id at its cloud provider (`VarChar(64)`): digits (DigitalOcean, Linode, Hetzner) or a UUID (Vultr). */
export const OPS_PROVIDER_SERVER_ID_MAX_LENGTH = 64;
/** CPU cores one server may report per-core figures for. */
export const OPS_MAX_CORES = 512;
/** Mounted file systems one server may report. */
export const OPS_MAX_DISKS = 32;
/** The busiest processes one server reports. */
export const OPS_TOP_PROCESS_COUNT = 5;
/** Process names as reported (`ps` truncates; so do we). */
export const OPS_PROCESS_NAME_MAX_LENGTH = 120;
/** Mount points as reported. */
export const OPS_MOUNT_MAX_LENGTH = 200;
/** The slowest endpoints one instance reports. */
export const OPS_SLOWEST_ENDPOINT_COUNT = 10;
/** The largest PostgreSQL tables reported. */
export const OPS_LARGEST_TABLE_COUNT = 5;
/** Extra alert recipients (beyond every SuperAdmin). */
export const OPS_ALERT_RECIPIENT_LIMIT = 20;
/** A percentage. */
export const OPS_PERCENT_MAX = 100;
/** The lowest a CPU, memory or disk alert threshold may be set: below it, a healthy server would alert. */
export const OPS_THRESHOLD_MIN_PERCENT = 50;
/** The longest an alert may wait — for sustained CPU, or for a silent server — before it opens. */
export const OPS_ALERT_WAIT_MAX_MINUTES = 60;
/** The earliest a certificate expiry may be warned about. */
export const OPS_TLS_WARN_MAX_DAYS = 90;
/** An alert recipient's address (`VarChar(255)`, like every stored email address). */
export const OPS_RECIPIENT_MAX_LENGTH = 255;

const PercentSchema = z.number().min(0).max(OPS_PERCENT_MAX);
const NonNegativeSchema = z.number().nonnegative();
const CountSchema = z.number().int().nonnegative();
const BytesSchema = z.number().int().nonnegative();

// ── Enums ───────────────────────────────────────────────────────────────────

/** Where a server runs. `LOCAL` is a developer's laptop; each cloud has a facts adapter in the API. */
export const OpsServerProviderSchema = z.enum(["LOCAL", "DIGITALOCEAN", "LINODE", "VULTR", "HETZNER", "OTHER"]);
export type OpsServerProvider = z.output<typeof OpsServerProviderSchema>;

/** A server's, instance's or dependency's state as the console shows it. `UNKNOWN`: it never reported. */
export const OpsHealthSchema = z.enum(["UP", "DEGRADED", "DOWN", "UNKNOWN"]);
export type OpsHealth = z.output<typeof OpsHealthSchema>;

/** The platform processes that report themselves as instances. */
export const OpsInstanceServiceSchema = z.enum(["api", "analytics-consumer"]);
export type OpsInstanceService = z.output<typeof OpsInstanceServiceSchema>;

/** The services the instances need but do not run. */
export const OpsDependencySchema = z.enum(["POSTGRES", "REDIS", "QUEUES", "KAFKA", "RABBITMQ", "ENDPOINTS"]);
export type OpsDependency = z.output<typeof OpsDependencySchema>;

/** What an alert is about. */
export const OpsAlertSubjectKindSchema = z.enum(["SERVER", "INSTANCE", "DEPENDENCY", "ENDPOINT"]);
export type OpsAlertSubjectKind = z.output<typeof OpsAlertSubjectKindSchema>;

/** Why an alert opened. */
export const OpsAlertRuleSchema = z.enum(["CPU_HIGH", "MEMORY_HIGH", "DISK_HIGH", "SILENT", "DEPENDENCY_DOWN", "ENDPOINT_DOWN", "TLS_EXPIRING"]);
export type OpsAlertRule = z.output<typeof OpsAlertRuleSchema>;

/** Open alerts, resolved ones, or both. */
export const OpsAlertStatusFilterSchema = z.enum(["OPEN", "RESOLVED", "ALL"]);
export type OpsAlertStatusFilter = z.output<typeof OpsAlertStatusFilterSchema>;

/** The history windows the charts offer. */
export const OpsHistoryRangeSchema = z.enum(["1h", "6h", "24h", "7d", "30d", "1y"]);
export type OpsHistoryRange = z.output<typeof OpsHistoryRangeSchema>;

/** The resolution a history answer is in: minutes up to a day, hours beyond. */
export const OpsResolutionSchema = z.enum(["MINUTE", "HOUR"]);
export type OpsResolution = z.output<typeof OpsResolutionSchema>;

/** Each history window's span, and the resolution it is drawn at. */
export const OPS_HISTORY_RANGES: Readonly<Record<OpsHistoryRange, { readonly spanMs: number; readonly resolution: OpsResolution }>> = {
	"1h": { spanMs: OPS_HOUR_MS, resolution: "MINUTE" },
	"6h": { spanMs: 6 * OPS_HOUR_MS, resolution: "MINUTE" },
	"24h": { spanMs: 24 * OPS_HOUR_MS, resolution: "MINUTE" },
	"7d": { spanMs: 7 * 24 * OPS_HOUR_MS, resolution: "HOUR" },
	"30d": { spanMs: 30 * 24 * OPS_HOUR_MS, resolution: "HOUR" },
	"1y": { spanMs: 365 * 24 * OPS_HOUR_MS, resolution: "HOUR" },
};

// ── Server: what the agent reports ──────────────────────────────────────────

/** The machine's fixed facts, sent with every report (a reinstall or resize changes them). */
export const OpsHostFactsSchema = z.object({
	hostname: z.string().min(1).max(OPS_HOST_FACT_MAX_LENGTH),
	os: z.string().min(1).max(OPS_HOST_FACT_MAX_LENGTH),
	kernel: z.string().min(1).max(OPS_HOST_FACT_MAX_LENGTH),
	cpuModel: z.string().min(1).max(OPS_HOST_FACT_MAX_LENGTH),
	cpuCores: z.number().int().min(1).max(OPS_MAX_CORES),
	memoryTotalBytes: BytesSchema,
	uptimeSeconds: CountSchema,
});
export type OpsHostFacts = z.output<typeof OpsHostFactsSchema>;

/** One mounted file system. `inodesPercent` is `null` where the platform does not report it (macOS). */
export const OpsDiskSchema = z.object({
	mount: z.string().min(1).max(OPS_MOUNT_MAX_LENGTH),
	usedBytes: BytesSchema,
	totalBytes: BytesSchema,
	inodesPercent: PercentSchema.nullable(),
});
export type OpsDisk = z.output<typeof OpsDiskSchema>;

/** One of the busiest processes. */
export const OpsProcessSchema = z.object({
	pid: CountSchema,
	name: z.string().min(1).max(OPS_PROCESS_NAME_MAX_LENGTH),
	cpuPercent: NonNegativeSchema,
	memoryBytes: BytesSchema,
});
export type OpsProcess = z.output<typeof OpsProcessSchema>;

/**
 * One live sample of a server. Figures a platform cannot measure are `null` — CPU steal and inodes
 * on macOS, for example — never a made-up zero.
 */
export const OpsServerLiveSchema = z.object({
	sampledAt: EpochMsSchema,
	cpuPercent: PercentSchema,
	perCorePercent: z.array(PercentSchema).max(OPS_MAX_CORES),
	stealPercent: PercentSchema.nullable(),
	iowaitPercent: PercentSchema.nullable(),
	load1: NonNegativeSchema,
	load5: NonNegativeSchema,
	load15: NonNegativeSchema,
	memoryUsedBytes: BytesSchema,
	memoryTotalBytes: BytesSchema,
	swapUsedBytes: BytesSchema,
	swapTotalBytes: BytesSchema,
	disks: z.array(OpsDiskSchema).max(OPS_MAX_DISKS),
	diskReadBytesPerSec: NonNegativeSchema,
	diskWriteBytesPerSec: NonNegativeSchema,
	diskReadIops: NonNegativeSchema.nullable(),
	diskWriteIops: NonNegativeSchema.nullable(),
	netRxBytesPerSec: NonNegativeSchema,
	netTxBytesPerSec: NonNegativeSchema,
	tcpConnections: CountSchema,
	openFiles: CountSchema.nullable(),
	processCount: CountSchema,
	topProcesses: z.array(OpsProcessSchema).max(OPS_TOP_PROCESS_COUNT),
});
export type OpsServerLive = z.output<typeof OpsServerLiveSchema>;

/** One history point of a server: a minute's (or an hour's) averages and peaks. */
export const OpsServerPointSchema = z.object({
	bucketStart: EpochMsSchema,
	cpuPercentAvg: PercentSchema,
	cpuPercentMax: PercentSchema,
	stealPercentAvg: PercentSchema.nullable(),
	iowaitPercentAvg: PercentSchema.nullable(),
	load1Avg: NonNegativeSchema,
	memoryUsedBytes: BytesSchema,
	memoryTotalBytes: BytesSchema,
	memoryPercentMax: PercentSchema,
	swapUsedBytes: BytesSchema,
	diskUsedBytes: BytesSchema,
	diskTotalBytes: BytesSchema,
	diskPercentMax: PercentSchema,
	inodesPercentMax: PercentSchema.nullable(),
	diskReadBytesPerSec: NonNegativeSchema,
	diskWriteBytesPerSec: NonNegativeSchema,
	netRxBytesPerSec: NonNegativeSchema,
	netTxBytesPerSec: NonNegativeSchema,
	tcpConnections: CountSchema,
	processCount: CountSchema,
});
export type OpsServerPoint = z.output<typeof OpsServerPointSchema>;

/**
 * One agent report: the host's facts and a live sample, plus — once a minute — the minute that just
 * ended, averaged by the agent from its own samples.
 */
export const OpsAgentReportSchema = z
	.object({
		agentVersion: z.string().min(1).max(OPS_VERSION_MAX_LENGTH),
		host: OpsHostFactsSchema.strict(),
		live: OpsServerLiveSchema.extend({
			disks: z.array(OpsDiskSchema.strict()).max(OPS_MAX_DISKS),
			topProcesses: z.array(OpsProcessSchema.strict()).max(OPS_TOP_PROCESS_COUNT),
		}).strict(),
		minute: OpsServerPointSchema.strict().nullable(),
	})
	.strict();
export type OpsAgentReport = z.output<typeof OpsAgentReportSchema>;

/** What the API answers an agent: when to report next. */
export const OpsAgentReportAckSchema = z.object({ nextReportInMs: CountSchema });
export type OpsAgentReportAck = z.output<typeof OpsAgentReportAckSchema>;

// ── Server: what the console shows ──────────────────────────────────────────

/** The clouds the console can read a server's facts from (each with its own API token). */
export const OpsCloudProviderSchema = z.enum(["DIGITALOCEAN", "LINODE", "VULTR", "HETZNER"]);
export type OpsCloudProvider = z.output<typeof OpsCloudProviderSchema>;

/**
 * A server as its cloud provider describes it — the same shape for every provider. Only when that
 * provider's token is configured; `status` is the provider's own word (`active`, `running`, `off`…).
 */
export const OpsCloudServerFactsSchema = z.object({
	provider: OpsCloudProviderSchema,
	name: z.string(),
	region: z.string(),
	plan: z.string(),
	vcpus: CountSchema,
	memoryMb: CountSchema,
	diskGb: CountSchema,
	status: z.string(),
	running: z.boolean(),
	publicIpv4: z.string().nullable(),
	createdAt: EpochMsSchema.nullable(),
});
export type OpsCloudServerFacts = z.output<typeof OpsCloudServerFactsSchema>;

/** One registered server, as the Servers screen lists it. */
export const OpsServerSummarySchema = z.object({
	id: z.uuid(),
	name: z.string(),
	provider: OpsServerProviderSchema,
	providerServerId: z.string().nullable(),
	health: OpsHealthSchema,
	hostname: z.string().nullable(),
	os: z.string().nullable(),
	/** The machine's spec, from its agent's latest report (null until it first reports). */
	cpuModel: z.string().nullable(),
	cpuCores: CountSchema.nullable(),
	memoryTotalBytes: BytesSchema.nullable(),
	uptimeSeconds: CountSchema.nullable(),
	lastSeenAt: EpochMsSchema.nullable(),
	live: OpsServerLiveSchema.nullable(),
	openAlerts: CountSchema,
});
export type OpsServerSummary = z.output<typeof OpsServerSummarySchema>;

/** One server with everything its detail page shows. */
export const OpsServerDetailSchema = OpsServerSummarySchema.extend({
	kernel: z.string().nullable(),
	agentVersion: z.string().nullable(),
	tokenPrefix: z.string(),
	registeredAt: EpochMsSchema,
	/** The provider's view, when the server is in a cloud whose token is configured. */
	cloud: OpsCloudServerFactsSchema.nullable(),
	/** Why `cloud` is null for a cloud server: no token for that provider, or its API failed. */
	cloudError: z.string().nullable(),
});
export type OpsServerDetail = z.output<typeof OpsServerDetailSchema>;

export const OpsServerPathSchema = z.object({ serverId: z.uuid() }).strict();
export type OpsServerPath = z.output<typeof OpsServerPathSchema>;

/** Registering a server. Its provider id links it to that cloud's facts (DigitalOcean, Linode, Vultr, Hetzner). */
export const RegisterOpsServerSchema = z
	.object({
		name: z.string().trim().min(1).max(OPS_SERVER_NAME_MAX_LENGTH),
		provider: OpsServerProviderSchema,
		providerServerId: z
			.string()
			.trim()
			.regex(/^[A-Za-z0-9-]+$/, "A provider server id is letters, digits and dashes")
			.max(OPS_PROVIDER_SERVER_ID_MAX_LENGTH)
			.nullable(),
	})
	.strict()
	.refine((input) => input.providerServerId === null || OpsCloudProviderSchema.safeParse(input.provider).success, {
		path: ["providerServerId"],
		message: "Only a cloud server (DigitalOcean, Linode, Vultr, Hetzner) has a provider server id",
	});
export type RegisterOpsServerInput = z.output<typeof RegisterOpsServerSchema>;

/** A server's agent credentials. The token is shown once, here, and never again. */
export const OpsServerCredentialsSchema = z.object({
	server: OpsServerDetailSchema,
	agentToken: z.string(),
	installCommand: z.string(),
});
export type OpsServerCredentials = z.output<typeof OpsServerCredentialsSchema>;

// ── History answers ─────────────────────────────────────────────────────────

export const OpsHistoryQuerySchema = z.object({ range: OpsHistoryRangeSchema.default("1h") }).strict();
export type OpsHistoryQuery = z.output<typeof OpsHistoryQuerySchema>;

/** A history answer: the window, its resolution and its points, oldest first. */
function historyOf<Point extends z.ZodType>(
	point: Point,
): z.ZodObject<{
	range: typeof OpsHistoryRangeSchema;
	resolution: typeof OpsResolutionSchema;
	from: typeof EpochMsSchema;
	to: typeof EpochMsSchema;
	points: z.ZodArray<Point>;
}> {
	return z.object({ range: OpsHistoryRangeSchema, resolution: OpsResolutionSchema, from: EpochMsSchema, to: EpochMsSchema, points: z.array(point) });
}

export const OpsServerHistorySchema = historyOf(OpsServerPointSchema);
export type OpsServerHistory = z.output<typeof OpsServerHistorySchema>;

// ── Instances ───────────────────────────────────────────────────────────────

/** One of an instance's slowest endpoints over the last minute. */
export const OpsSlowEndpointSchema = z.object({
	endpoint: z.string(),
	p95Ms: NonNegativeSchema,
	count: CountSchema,
});
export type OpsSlowEndpoint = z.output<typeof OpsSlowEndpointSchema>;

/** One instance's live numbers (its heartbeat). Request figures cover the last minute. */
export const OpsInstanceLiveSchema = z.object({
	instanceId: z.string(),
	service: OpsInstanceServiceSchema,
	hostname: z.string(),
	pid: CountSchema,
	version: z.string(),
	startedAt: EpochMsSchema,
	sampledAt: EpochMsSchema,
	cpuPercent: NonNegativeSchema,
	rssBytes: BytesSchema,
	heapUsedBytes: BytesSchema,
	heapTotalBytes: BytesSchema,
	eventLoopLagP99Ms: NonNegativeSchema,
	gcPauseMs: NonNegativeSchema,
	activeHandles: CountSchema,
	dbPoolInUse: CountSchema.nullable(),
	dbPoolWaiting: CountSchema.nullable(),
	requestsPerMinute: CountSchema,
	serverErrorsPerMinute: CountSchema,
	clientErrorsPerMinute: CountSchema,
	latencyP50Ms: NonNegativeSchema.nullable(),
	latencyP95Ms: NonNegativeSchema.nullable(),
	latencyP99Ms: NonNegativeSchema.nullable(),
	slowestEndpoints: z.array(OpsSlowEndpointSchema).max(OPS_SLOWEST_ENDPOINT_COUNT),
});
export type OpsInstanceLive = z.output<typeof OpsInstanceLiveSchema>;

/** An instance as the console lists it: its last heartbeat, and whether it is still beating. */
export const OpsInstanceSchema = OpsInstanceLiveSchema.extend({ health: OpsHealthSchema });
export type OpsInstance = z.output<typeof OpsInstanceSchema>;

/** One history point of an instance. */
export const OpsInstancePointSchema = z.object({
	bucketStart: EpochMsSchema,
	cpuPercentAvg: NonNegativeSchema,
	cpuPercentMax: NonNegativeSchema,
	rssBytes: BytesSchema,
	heapUsedBytes: BytesSchema,
	eventLoopLagP99Ms: NonNegativeSchema,
	gcPauseMs: NonNegativeSchema,
	requestCount: CountSchema,
	serverErrorCount: CountSchema,
	clientErrorCount: CountSchema,
	latencyP50Ms: NonNegativeSchema.nullable(),
	latencyP95Ms: NonNegativeSchema.nullable(),
	latencyP99Ms: NonNegativeSchema.nullable(),
});
export type OpsInstancePoint = z.output<typeof OpsInstancePointSchema>;

export const OpsInstanceHistorySchema = historyOf(OpsInstancePointSchema);
export type OpsInstanceHistory = z.output<typeof OpsInstanceHistorySchema>;

export const OpsInstancePathSchema = z.object({ instanceId: z.string().min(1).max(OPS_HOST_FACT_MAX_LENGTH) }).strict();
export type OpsInstancePath = z.output<typeof OpsInstancePathSchema>;

// ── Dependencies ────────────────────────────────────────────────────────────

const PostgresStatsSchema = z.object({
	dependency: z.literal("POSTGRES"),
	connectionsUsed: CountSchema,
	connectionsMax: CountSchema,
	cacheHitPercent: PercentSchema.nullable(),
	sizeBytes: BytesSchema,
	growthBytesPerDay: z.number().nullable(),
	largestTables: z.array(z.object({ name: z.string(), bytes: BytesSchema })).max(OPS_LARGEST_TABLE_COUNT),
	longestQuerySeconds: NonNegativeSchema.nullable(),
	slowQueries: CountSchema,
	deadlocks: CountSchema,
});

const RedisStatsSchema = z.object({
	dependency: z.literal("REDIS"),
	usedMemoryBytes: BytesSchema,
	maxMemoryBytes: BytesSchema.nullable(),
	hitRatePercent: PercentSchema.nullable(),
	evictedKeys: CountSchema,
	opsPerSecond: NonNegativeSchema,
	connectedClients: CountSchema,
});

const QueuesStatsSchema = z.object({
	dependency: z.literal("QUEUES"),
	queues: z.array(z.object({ name: z.string(), waiting: CountSchema, active: CountSchema, delayed: CountSchema, failed: CountSchema })),
});

const KafkaStatsSchema = z.object({
	dependency: z.literal("KAFKA"),
	brokers: CountSchema,
	consumerLag: CountSchema.nullable(),
});

const RabbitMqStatsSchema = z.object({
	dependency: z.literal("RABBITMQ"),
	connected: z.boolean(),
});

const EndpointsStatsSchema = z.object({
	dependency: z.literal("ENDPOINTS"),
	endpoints: z.array(
		z.object({
			url: z.string(),
			up: z.boolean(),
			status: CountSchema.nullable(),
			latencyMs: NonNegativeSchema.nullable(),
			tlsDaysLeft: z.number().int().nullable(),
		}),
	),
});

/** Each dependency's own statistics. */
export const OpsDependencyStatsSchema = z.discriminatedUnion("dependency", [
	PostgresStatsSchema,
	RedisStatsSchema,
	QueuesStatsSchema,
	KafkaStatsSchema,
	RabbitMqStatsSchema,
	EndpointsStatsSchema,
]);
export type OpsDependencyStats = z.output<typeof OpsDependencyStatsSchema>;

/** One dependency's latest check. `stats` is `null` while it is down or not configured. */
export const OpsDependencyStatusSchema = z.object({
	dependency: OpsDependencySchema,
	health: OpsHealthSchema,
	configured: z.boolean(),
	latencyMs: NonNegativeSchema.nullable(),
	checkedAt: EpochMsSchema,
	error: z.string().nullable(),
	stats: OpsDependencyStatsSchema.nullable(),
});
export type OpsDependencyStatus = z.output<typeof OpsDependencyStatusSchema>;

export const OpsDependencyListSchema = z.object({ dependencies: z.array(OpsDependencyStatusSchema) });
export type OpsDependencyList = z.output<typeof OpsDependencyListSchema>;

/**
 * One history point of a dependency. The figure columns that do not apply to it are `null`: a
 * database has no backlog, a queue no size.
 */
export const OpsDependencyPointSchema = z.object({
	bucketStart: EpochMsSchema,
	upPercent: PercentSchema,
	latencyMsAvg: NonNegativeSchema.nullable(),
	connectionsUsed: CountSchema.nullable(),
	sizeBytes: BytesSchema.nullable(),
	memoryUsedBytes: BytesSchema.nullable(),
	backlog: CountSchema.nullable(),
	failed: CountSchema.nullable(),
});
export type OpsDependencyPoint = z.output<typeof OpsDependencyPointSchema>;

export const OpsDependencyHistorySchema = historyOf(OpsDependencyPointSchema);
export type OpsDependencyHistory = z.output<typeof OpsDependencyHistorySchema>;

export const OpsDependencyPathSchema = z.object({ dependency: OpsDependencySchema }).strict();
export type OpsDependencyPath = z.output<typeof OpsDependencyPathSchema>;

/** Every instance's latest heartbeat. */
export const OpsInstanceListSchema = z.object({ instances: z.array(OpsInstanceSchema) });
export type OpsInstanceList = z.output<typeof OpsInstanceListSchema>;

/** Every registered server. */
export const OpsServerListSchema = z.object({ servers: z.array(OpsServerSummarySchema) });
export type OpsServerList = z.output<typeof OpsServerListSchema>;

// ── Alerts ──────────────────────────────────────────────────────────────────

/** One alert: an incident, open until its condition clears. */
export const OpsAlertSchema = z.object({
	id: z.uuid(),
	subjectKind: OpsAlertSubjectKindSchema,
	subjectId: z.string(),
	subjectName: z.string(),
	rule: OpsAlertRuleSchema,
	openedAt: EpochMsSchema,
	resolvedAt: EpochMsSchema.nullable(),
	thresholdValue: z.number().nullable(),
	peakValue: z.number().nullable(),
	lastValue: z.number().nullable(),
	message: z.string(),
});
export type OpsAlert = z.output<typeof OpsAlertSchema>;

export const OpsAlertListQuerySchema = z.object({ status: OpsAlertStatusFilterSchema.default("OPEN") }).strict();
export type OpsAlertListQuery = z.output<typeof OpsAlertListQuerySchema>;

export const OpsAlertListSchema = z.object({ alerts: z.array(OpsAlertSchema) });
export type OpsAlertList = z.output<typeof OpsAlertListSchema>;

/** The alert thresholds and the extra people alerts are emailed to. Every SuperAdmin always gets them. */
export const OpsAlertSettingsSchema = z.object({
	cpuPercent: z.number().int().min(OPS_THRESHOLD_MIN_PERCENT).max(OPS_PERCENT_MAX),
	cpuSustainMinutes: z.number().int().min(1).max(OPS_ALERT_WAIT_MAX_MINUTES),
	memoryPercent: z.number().int().min(OPS_THRESHOLD_MIN_PERCENT).max(OPS_PERCENT_MAX),
	diskPercent: z.number().int().min(OPS_THRESHOLD_MIN_PERCENT).max(OPS_PERCENT_MAX),
	silentAfterMinutes: z.number().int().min(1).max(OPS_ALERT_WAIT_MAX_MINUTES),
	tlsWarnDays: z.number().int().min(1).max(OPS_TLS_WARN_MAX_DAYS),
	extraRecipients: z.array(z.email().max(OPS_RECIPIENT_MAX_LENGTH)).max(OPS_ALERT_RECIPIENT_LIMIT),
});
export type OpsAlertSettings = z.output<typeof OpsAlertSettingsSchema>;
/** Changing the alert settings: the same fields, and nothing else (request bodies are closed; responses stay open). */
export const OpsAlertSettingsInputSchema = OpsAlertSettingsSchema.strict();

/** The thresholds a fresh install starts with (ADR 068). */
export const OPS_DEFAULT_ALERT_SETTINGS: OpsAlertSettings = {
	cpuPercent: 90,
	cpuSustainMinutes: 5,
	memoryPercent: 90,
	diskPercent: 85,
	silentAfterMinutes: 2,
	tlsWarnDays: 14,
	extraRecipients: [],
};

// ── Overview ────────────────────────────────────────────────────────────────

/** The Operations landing page in one read: every server, instance, dependency and open alert. */
export const OpsOverviewSchema = z.object({
	servers: z.array(OpsServerSummarySchema),
	instances: z.array(OpsInstanceSchema),
	dependencies: z.array(OpsDependencyStatusSchema),
	openAlerts: z.array(OpsAlertSchema),
	/** The clouds whose API token is configured here. */
	cloudProviders: z.array(OpsCloudProviderSchema),
});
export type OpsOverview = z.output<typeof OpsOverviewSchema>;

// ── Database backups (phase 2) ──────────────────────────────────────────────

export const OpsBackupStatusSchema = z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]);
export type OpsBackupStatus = z.output<typeof OpsBackupStatusSchema>;

export const OpsBackupTriggerSchema = z.enum(["MANUAL", "SCHEDULED"]);
export type OpsBackupTrigger = z.output<typeof OpsBackupTriggerSchema>;

/** The longest a backup's download link stays valid. */
export const OPS_BACKUP_DOWNLOAD_TTL_SECONDS = 300;
/** The hour of the day a backup schedule may name (0–23, platform time zone). */
export const OPS_BACKUP_LAST_HOUR = 23;
/** The longest backups may be kept. */
export const OPS_BACKUP_MAX_RETENTION_DAYS = 365;
/** An error message stored with a failed backup or load test (`VarChar(1000)`). */
export const OPS_ERROR_MAX_LENGTH = 1_000;

/** One backup as the Backups screen lists it. */
export const OpsBackupSchema = z.object({
	id: z.uuid(),
	status: OpsBackupStatusSchema,
	trigger: OpsBackupTriggerSchema,
	requestedByName: z.string().nullable(),
	createdAt: EpochMsSchema,
	startedAt: EpochMsSchema.nullable(),
	finishedAt: EpochMsSchema.nullable(),
	sizeBytes: BytesSchema.nullable(),
	checksum: z.string().nullable(),
	pgDumpVersion: z.string().nullable(),
	serverVersion: z.string().nullable(),
	pinned: z.boolean(),
	error: z.string().nullable(),
});
export type OpsBackup = z.output<typeof OpsBackupSchema>;

/** When the daily backup runs and how long backups are kept. */
export const OpsBackupScheduleSchema = z.object({
	backupHour: z.number().int().min(0).max(OPS_BACKUP_LAST_HOUR),
	retentionDays: z.number().int().min(1).max(OPS_BACKUP_MAX_RETENTION_DAYS),
});
export type OpsBackupSchedule = z.output<typeof OpsBackupScheduleSchema>;
/** Changing the backup schedule (a closed request body). */
export const OpsBackupScheduleInputSchema = OpsBackupScheduleSchema.strict();

/** The Backups screen in one read. */
export const OpsBackupListSchema = z.object({
	backups: z.array(OpsBackupSchema),
	schedule: OpsBackupScheduleSchema,
	timeZone: z.string(),
	nextScheduledAt: EpochMsSchema,
	storageConfigured: z.boolean(),
});
export type OpsBackupList = z.output<typeof OpsBackupListSchema>;

export const OpsBackupPathSchema = z.object({ backupId: z.uuid() }).strict();

/** The longest one-time download ticket accepted. */
const OPS_DOWNLOAD_TICKET_MAX_LENGTH = 128;

/** A backup file download: the backup and its one-time ticket (`POST …/download` issues it). */
export const OpsBackupFileInputSchema = OpsBackupPathSchema.extend({ ticket: z.string().min(1).max(OPS_DOWNLOAD_TICKET_MAX_LENGTH) });
export type OpsBackupFileInput = z.output<typeof OpsBackupFileInputSchema>;
/** A backup file is `pg_dump --format=custom` output: binary, restored with `pg_restore`. */
export const OPS_BACKUP_FILE_CONTENT_TYPE = "application/octet-stream";
export type OpsBackupPath = z.output<typeof OpsBackupPathSchema>;

export const PinOpsBackupSchema = z.object({ pinned: z.boolean() }).strict();
export type PinOpsBackupInput = z.output<typeof PinOpsBackupSchema>;

/** A short-lived download link for one backup. */
export const OpsBackupDownloadSchema = z.object({ url: z.string(), expiresAt: EpochMsSchema, fileName: z.string() });
export type OpsBackupDownload = z.output<typeof OpsBackupDownloadSchema>;

/** The schedule a fresh install starts with (ADR 068): daily at 03:00, kept 14 days. */
export const OPS_DEFAULT_BACKUP_SCHEDULE: OpsBackupSchedule = { backupHour: 3, retentionDays: 14 };

// ── Load tests (phase 3) ────────────────────────────────────────────────────

/** What a load test drives: one scenario, every scenario weighted (a traffic mix), or one read endpoint. */
export const LoadTestTargetSchema = z.enum(["SCENARIO", "MIX", "ENDPOINT"]);
export type LoadTestTarget = z.output<typeof LoadTestTargetSchema>;

/** How the load changes over the run. */
export const LoadTestShapeSchema = z.enum(["CONSTANT", "RAMP", "SPIKE", "SOAK"]);
export type LoadTestShape = z.output<typeof LoadTestShapeSchema>;

export const LoadTestStatusSchema = z.enum(["QUEUED", "RUNNING", "PASSED", "FAILED", "ABORTED", "ERROR"]);
export type LoadTestStatus = z.output<typeof LoadTestStatusSchema>;

/** The scenarios: named user journeys, each replayed as a load-test user of the Load Test tenant. */
export const LoadTestScenarioSchema = z.enum(["sign-in", "browse-marketplace", "claim-reward", "merchant-dashboard", "merchant-rewards"]);
export type LoadTestScenario = z.output<typeof LoadTestScenarioSchema>;

/** What each scenario does, its steps (the per-step breakdown's rows) and its default weight in a traffic mix. */
export const LOAD_TEST_SCENARIOS: Readonly<
	Record<LoadTestScenario, { readonly title: string; readonly description: string; readonly steps: readonly string[]; readonly defaultWeight: number }>
> = {
	"sign-in": { title: "Sign in", description: "A customer signs in with a password and loads their session.", steps: ["login", "session"], defaultWeight: 10 },
	"browse-marketplace": {
		title: "Browse marketplace",
		description: "A signed-in customer opens the marketplace, pages through it and opens a reward.",
		steps: ["marketplace", "marketplace-page-2", "reward"],
		defaultWeight: 50,
	},
	"claim-reward": { title: "Claim a reward", description: "A customer claims a reward and opens their claims.", steps: ["reward", "claim", "my-claims"], defaultWeight: 20 },
	"merchant-dashboard": {
		title: "Merchant dashboard",
		description: "A merchant's staff member opens the dashboard and its analytics.",
		steps: ["tenant-context", "rewards", "analytics"],
		defaultWeight: 15,
	},
	"merchant-rewards": {
		title: "Merchant reviews its rewards",
		description: "A merchant's manager opens the rewards list and one reward.",
		steps: ["tenant-rewards", "tenant-reward"],
		defaultWeight: 5,
	},
};

/** The hard ceilings no cap can be raised above, and the caps a fresh install starts with (ADR 068). */
export const LOAD_TEST_CAP_CEILINGS = { virtualUsers: 2_000, requestsPerSecond: 5_000, minutes: 120, soakMinutes: 720 } satisfies Record<string, number>;
export const LOAD_TEST_DEFAULT_CAPS = { maxVirtualUsers: 300, maxRequestsPerSecond: 1_000, maxMinutes: 30, maxSoakMinutes: 120 } satisfies Record<string, number>;
/** Auto-abort: errors above this share for {@link LOAD_TEST_ABORT_ERROR_SECONDS} seconds… */
export const LOAD_TEST_ABORT_ERROR_PERCENT = 50;
export const LOAD_TEST_ABORT_ERROR_SECONDS = 30;
/** …or any server above this CPU for {@link LOAD_TEST_ABORT_CPU_SECONDS} seconds. */
export const LOAD_TEST_ABORT_CPU_PERCENT = 95;
export const LOAD_TEST_ABORT_CPU_SECONDS = 60;
/** The shortest run. */
export const LOAD_TEST_MIN_SECONDS = 10;
/** Load-test names (`VarChar(100)`) and endpoint templates (`VarChar(300)`). */
export const LOAD_TEST_NAME_MAX_LENGTH = 100;
export const LOAD_TEST_ENDPOINT_MAX_LENGTH = 300;
/** A scenario's weight in a traffic mix. */
export const LOAD_TEST_MAX_WEIGHT = 100;
/** The slowest p95 a pass/fail threshold may name. */
export const LOAD_TEST_MAX_THRESHOLD_MS = 60_000;
const SECONDS_PER_MINUTE = 60;
/** A path from the root (`/rewards`). */
const ABSOLUTE_PATH = /^\//;

/** The load-test caps, editable by SuperAdmin up to {@link LOAD_TEST_CAP_CEILINGS}. */
export const LoadTestCapsSchema = z.object({
	maxVirtualUsers: z.number().int().min(1).max(LOAD_TEST_CAP_CEILINGS.virtualUsers),
	maxRequestsPerSecond: z.number().int().min(1).max(LOAD_TEST_CAP_CEILINGS.requestsPerSecond),
	maxMinutes: z.number().int().min(1).max(LOAD_TEST_CAP_CEILINGS.minutes),
	maxSoakMinutes: z.number().int().min(1).max(LOAD_TEST_CAP_CEILINGS.soakMinutes),
});
export type LoadTestCaps = z.output<typeof LoadTestCapsSchema>;
/** Changing the load-test caps (a closed request body). */
export const LoadTestCapsInputSchema = LoadTestCapsSchema.strict();

/** A traffic mix's weights: every scenario named at most once. */
export const LoadTestMixWeightsSchema = z.partialRecord(LoadTestScenarioSchema, z.number().int().min(0).max(LOAD_TEST_MAX_WEIGHT));
export type LoadTestMixWeights = z.output<typeof LoadTestMixWeightsSchema>;

/**
 * Starting a load test. Shape-independent bounds only: the caps in force are checked by the API,
 * which owns them. The target's own field must be set and the others null.
 */
export const StartLoadTestSchema = z
	.object({
		name: z.string().trim().min(1).max(LOAD_TEST_NAME_MAX_LENGTH),
		target: LoadTestTargetSchema,
		scenario: LoadTestScenarioSchema.nullable(),
		endpoint: z.string().regex(ABSOLUTE_PATH, "An endpoint is a path starting with /").max(LOAD_TEST_ENDPOINT_MAX_LENGTH).nullable(),
		mixWeights: LoadTestMixWeightsSchema.nullable(),
		shape: LoadTestShapeSchema,
		virtualUsers: z.number().int().min(1).max(LOAD_TEST_CAP_CEILINGS.virtualUsers),
		requestsPerSecond: z.number().int().min(1).max(LOAD_TEST_CAP_CEILINGS.requestsPerSecond),
		durationSeconds: z
			.number()
			.int()
			.min(LOAD_TEST_MIN_SECONDS)
			.max(LOAD_TEST_CAP_CEILINGS.soakMinutes * SECONDS_PER_MINUTE),
		thresholdP95Ms: z.number().int().min(1).max(LOAD_TEST_MAX_THRESHOLD_MS),
		thresholdErrorPercent: z.number().min(0).max(OPS_PERCENT_MAX),
	})
	.strict()
	.superRefine((input, context): void => {
		const expected: Record<LoadTestTarget, { scenario: boolean; endpoint: boolean; mixWeights: boolean }> = {
			SCENARIO: { scenario: true, endpoint: false, mixWeights: false },
			ENDPOINT: { scenario: false, endpoint: true, mixWeights: false },
			MIX: { scenario: false, endpoint: false, mixWeights: true },
		};
		const want = expected[input.target];
		for (const field of ["scenario", "endpoint", "mixWeights"] satisfies (keyof typeof want)[]) {
			if ((input[field] !== null) !== want[field]) {
				context.addIssue({
					code: "custom",
					path: [field],
					message: want[field] ? `A ${input.target.toLowerCase()} load test needs ${field}` : `Only set ${field} for its own kind of load test`,
				});
			}
		}
		if (input.mixWeights !== null && !Object.values(input.mixWeights).some((weight) => weight > 0)) {
			context.addIssue({ code: "custom", path: ["mixWeights"], message: "Give at least one scenario a weight" });
		}
	});
export type StartLoadTestInput = z.output<typeof StartLoadTestSchema>;

/** One load test as the list shows it. */
export const LoadTestRunSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	target: LoadTestTargetSchema,
	scenario: LoadTestScenarioSchema.nullable(),
	endpoint: z.string().nullable(),
	mixWeights: LoadTestMixWeightsSchema.nullable(),
	shape: LoadTestShapeSchema,
	virtualUsers: CountSchema,
	requestsPerSecond: CountSchema,
	durationSeconds: CountSchema,
	thresholdP95Ms: CountSchema,
	thresholdErrorPercent: NonNegativeSchema,
	status: LoadTestStatusSchema,
	requestedByName: z.string(),
	createdAt: EpochMsSchema,
	startedAt: EpochMsSchema.nullable(),
	finishedAt: EpochMsSchema.nullable(),
	abortReason: z.string().nullable(),
	totalRequests: CountSchema.nullable(),
	failedRequests: CountSchema.nullable(),
	p50Ms: NonNegativeSchema.nullable(),
	p95Ms: NonNegativeSchema.nullable(),
	p99Ms: NonNegativeSchema.nullable(),
	peakRps: NonNegativeSchema.nullable(),
	error: z.string().nullable(),
});
export type LoadTestRun = z.output<typeof LoadTestRunSchema>;

/** One second of a load test. */
export const LoadTestPointSchema = z.object({
	second: CountSchema,
	at: EpochMsSchema,
	virtualUsers: CountSchema,
	requests: CountSchema,
	failures: CountSchema,
	p50Ms: NonNegativeSchema.nullable(),
	p95Ms: NonNegativeSchema.nullable(),
	p99Ms: NonNegativeSchema.nullable(),
});
export type LoadTestPoint = z.output<typeof LoadTestPointSchema>;

/** One scenario step over the whole run. */
export const LoadTestStepStatSchema = z.object({
	step: z.string(),
	requests: CountSchema,
	failures: CountSchema,
	p50Ms: NonNegativeSchema.nullable(),
	p95Ms: NonNegativeSchema.nullable(),
	p99Ms: NonNegativeSchema.nullable(),
});
export type LoadTestStepStat = z.output<typeof LoadTestStepStatSchema>;

/** A server's CPU and memory on the run's own timeline, for the overlay. */
export const LoadTestServerOverlaySchema = z.object({
	serverId: z.uuid(),
	name: z.string(),
	points: z.array(z.object({ at: EpochMsSchema, cpuPercent: PercentSchema, memoryPercent: PercentSchema })),
});
export type LoadTestServerOverlay = z.output<typeof LoadTestServerOverlaySchema>;

/** One load test with its timeline, its steps and the servers' load over the same window. */
export const LoadTestRunDetailSchema = z.object({
	run: LoadTestRunSchema,
	points: z.array(LoadTestPointSchema),
	steps: z.array(LoadTestStepStatSchema),
	servers: z.array(LoadTestServerOverlaySchema),
});
export type LoadTestRunDetail = z.output<typeof LoadTestRunDetailSchema>;

export const LoadTestRunPathSchema = z.object({ runId: z.uuid() }).strict();
export type LoadTestRunPath = z.output<typeof LoadTestRunPathSchema>;

/** The Load tests screen in one read: whether load testing is on here, the caps, the endpoints and the runs. */
export const LoadTestOverviewSchema = z.object({
	enabled: z.boolean(),
	disabledReason: z.string().nullable(),
	caps: LoadTestCapsSchema,
	endpoints: z.array(z.string()),
	runs: z.array(LoadTestRunSchema),
	loadTestUsers: CountSchema,
});
export type LoadTestOverview = z.output<typeof LoadTestOverviewSchema>;

/** What a purge removed. */
export const LoadTestPurgeResultSchema = z.object({ deletedRows: CountSchema, tables: z.array(z.object({ table: z.string(), rows: CountSchema })) });
export type LoadTestPurgeResult = z.output<typeof LoadTestPurgeResultSchema>;

/** The second of a run (`job.updateProgress`) the load runner reports, and its per-step totals so far. */
export const LoadTestProgressSchema = z.object({
	points: z.array(LoadTestPointSchema),
	steps: z.array(LoadTestStepStatSchema),
});
export type LoadTestProgress = z.output<typeof LoadTestProgressSchema>;

/** A whole run's totals: its percentiles are over every request, not combined from seconds. */
export const LoadTestTotalsSchema = z.object({
	requests: CountSchema,
	failures: CountSchema,
	p50Ms: NonNegativeSchema.nullable(),
	p95Ms: NonNegativeSchema.nullable(),
	p99Ms: NonNegativeSchema.nullable(),
	peakRps: NonNegativeSchema.nullable(),
});
export type LoadTestTotals = z.output<typeof LoadTestTotalsSchema>;

/** How a run ended, as the load runner returns it. */
export const LoadTestOutcomeSchema = z.object({
	status: z.enum(["COMPLETED", "ABORTED", "ERROR"]),
	abortReason: z.string().nullable(),
	error: z.string().nullable(),
	points: z.array(LoadTestPointSchema),
	steps: z.array(LoadTestStepStatSchema),
	totals: LoadTestTotalsSchema,
});
export type LoadTestOutcome = z.output<typeof LoadTestOutcomeSchema>;

/** A load-test user the runner signs in as; customers carry their verified phone (claims need it). */
export const LoadTestUserCredentialsSchema = z.object({ email: z.email(), password: z.string().min(1), phone: z.string().nullable() });

/** What the load runner is handed for one run (a BullMQ job). */
export const LoadTestJobSchema = z.object({
	runId: z.uuid(),
	baseUrl: z.url(),
	target: LoadTestTargetSchema,
	scenario: LoadTestScenarioSchema.nullable(),
	endpoint: z.string().nullable(),
	mixWeights: LoadTestMixWeightsSchema.nullable(),
	shape: LoadTestShapeSchema,
	virtualUsers: CountSchema,
	requestsPerSecond: CountSchema,
	durationSeconds: CountSchema,
	tenantSlug: z.string(),
	customers: z.array(LoadTestUserCredentialsSchema),
	staff: z.array(LoadTestUserCredentialsSchema),
	abortKey: z.string(),
	/** The `Origin` each client sends (mutations are refused without an allowed one). */
	origins: z.object({ web: z.url(), merchant: z.url() }),
	/** The API's versioned path prefix (`/api/v1`). */
	apiPrefix: z.string().regex(ABSOLUTE_PATH),
	/** Sent as `X-Load-Test-Key` on every request: the run's own rate-limit bucket (valid for the run's length). */
	trafficKey: z.string().min(1),
});
export type LoadTestJob = z.output<typeof LoadTestJobSchema>;
