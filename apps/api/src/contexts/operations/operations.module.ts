import { hostname } from "node:os";

import { getQueueToken } from "@nestjs/bullmq";
import { Module, type Provider } from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import type { Prisma } from "@prisma/client";
import { ALL_QUEUE_NAMES, epochMs, OPS_HOUR_MS, PLATFORM_DISPLAY_REGION, QUEUE_NAMES, type LoadTestJob } from "@workspace/shared";
import { KafkaProducerService, REDIS_PUBLISHER } from "@workspace/messaging/nest";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";

import { getApiConfig } from "../../config/api-config";
import { TypedConfigService } from "../../config/typed-config.service";
import { systemActor } from "../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../platform/application/clock.port";
import type { UnitOfWork } from "../../platform/application/unit-of-work.port";
import { HEALTH_PROBE_PATHS } from "../../platform/infrastructure/http/probe-routes";
import { OBJECT_STORAGE, StorageModule, type ObjectStorage } from "../../platform/infrastructure/storage";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import { LoadTestTrafficKeys } from "../../platform/infrastructure/throttling/load-test-traffic-keys";
import { ThrottlerStorageModule } from "../../platform/infrastructure/throttling/throttler-storage.module";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { USER_OWNED_DATA_SCOPE } from "../../platform/infrastructure/unit-of-work/actor-to-rls-context";
import { PrismaReadExecutor } from "../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../platform/infrastructure/unit-of-work/unit-of-work.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { NotificationsModule, NotificationsTransactionalPortsFactory } from "../notifications/public-api";
import {
	CreateOpsBackupHandler,
	DeleteOpsBackupHandler,
	IssueOpsBackupDownloadHandler,
	PinOpsBackupHandler,
	UpdateOpsBackupScheduleHandler,
} from "./application/commands/backups/backup.handlers";
import { AbortLoadTestHandler, PurgeLoadTestDataHandler, StartLoadTestHandler, UpdateLoadTestCapsHandler } from "./application/commands/load-tests/load-test.handlers";
import { RecordAgentReportHandler } from "./application/commands/record-agent-report/record-agent-report.handler";
import { RegisterOpsServerHandler } from "./application/commands/register-ops-server/register-ops-server.handler";
import { RevokeOpsServerHandler } from "./application/commands/revoke-ops-server/revoke-ops-server.handler";
import { RotateOpsServerTokenHandler } from "./application/commands/rotate-ops-server-token/rotate-ops-server-token.handler";
import { UpdateOpsAlertSettingsHandler } from "./application/commands/update-ops-alert-settings/update-ops-alert-settings.handler";
import type { OperationsScope } from "./application/operations-scope";
import { BACKUP_QUEUE, BACKUP_STORAGE, DATABASE_DUMP, type BackupQueuePort, type BackupStoragePort, type DatabaseDumpPort } from "./application/ports/backup.ports";
import { CLOUD_SERVER_FACTS, type CloudServerFactsPort } from "./application/ports/cloud-server-facts.port";
import { DEPENDENCY_PROBES, type DependencyProbe } from "./application/ports/dependency-probe.port";
import { LOAD_TEST_PASSWORDS, LOAD_TEST_QUEUE, LOAD_TEST_TRAFFIC, type LoadTestPasswordPort, type LoadTestQueuePort } from "./application/ports/load-test.ports";
import type { OperationsReads } from "./application/ports/operations-reads.port";
import {
	BACKUP_RUNNER,
	HISTORY_MAINTAINER,
	INSTANCE_REPORTER,
	LOAD_TEST_RECORDER,
	LOAD_TEST_RECORD_OPERATION,
	OPERATIONS_MONITOR,
	OPERATIONS_READ,
	OPS_BACKUP_RUN_OPERATION,
	OPS_HISTORY_MAINTAIN_OPERATION,
	OPS_INSTANCE_RECORD_OPERATION,
	OPS_MONITOR_COLLECT_OPERATION,
	OPS_READS,
	OPS_UNIT_OF_WORK,
} from "./application/ports/operations.tokens";
import { OPS_LIVE_STORE, type OpsLiveStore } from "./application/ports/ops-live-store.port";
import { BackupRunner } from "./application/services/backup-runner";
import { HistoryMaintainer } from "./application/services/history-maintainer";
import { InstanceReporter } from "./application/services/instance-reporter";
import { LoadTestRecorder } from "./application/services/load-test-recorder";
import { OperationsMonitor } from "./application/services/operations-monitor";
import { OperationsReadService } from "./application/services/operations-read.service";
import { OperationsQueueModule } from "./infrastructure/backup/operations-queue.module";
import { BullBackupQueue, InlineBackupQueue, type OpsBackupJob } from "./infrastructure/backup/backup-queue";
import { ObjectStorageBackupAdapter } from "./infrastructure/backup/object-storage-backup.adapter";
import { PgDumpAdapter } from "./infrastructure/backup/pg-dump.adapter";
import { CloudServerFactsRegistry } from "./infrastructure/cloud/cloud-server-facts.registry";
import { ProcessMetricsSampler } from "./infrastructure/instance/process-metrics.sampler";
import { RequestMetricsRecorder } from "./infrastructure/instance/request-metrics.recorder";
import { InMemoryOpsLiveStore, RedisOpsLiveStore } from "./infrastructure/live/redis-ops-live.store";
import { BullLoadTestQueue, LoadTestEventsListener, RandomLoadTestPasswords, UnavailableLoadTestQueue } from "./infrastructure/load-test/load-test-queue";
import { OperationsScheduler } from "./infrastructure/operations.scheduler";
import { OperationsScopeFactory } from "./infrastructure/persistence/operations-scope.factory";
import { PrismaOperationsReads } from "./infrastructure/persistence/prisma-operations.reads";
import { EndpointsProbe, KafkaProbe, PostgresProbe, QueuesProbe, RabbitMqProbe, RedisProbe, type CountableQueue } from "./infrastructure/probes/dependency-probes";
import { OperationsAgentController } from "./presentation/http/operations-agent.controller";
import { OperationsBackupFileController, OperationsBackupsController } from "./presentation/http/operations-backups.controller";
import { OperationsController } from "./presentation/http/operations.controller";
import { OperationsLoadTestsController } from "./presentation/http/operations-load-tests.controller";

// Queue wiring is decided at load time from the validated config (like the files context): BullMQ
// when Redis is configured (always in production), in this process otherwise.
const hasRedis: boolean = getApiConfig().messaging.redisUrl !== undefined;
const HOURS_PER_DAY = 24;

const COMMAND_HANDLERS: readonly Provider[] = [
	RegisterOpsServerHandler,
	RotateOpsServerTokenHandler,
	RevokeOpsServerHandler,
	UpdateOpsAlertSettingsHandler,
	RecordAgentReportHandler,
	CreateOpsBackupHandler,
	PinOpsBackupHandler,
	DeleteOpsBackupHandler,
	UpdateOpsBackupScheduleHandler,
	IssueOpsBackupDownloadHandler,
	StartLoadTestHandler,
	AbortLoadTestHandler,
	UpdateLoadTestCapsHandler,
	PurgeLoadTestDataHandler,
];

/** The job queues' adapters: BullMQ with Redis, in-process (backups) or unavailable (load tests) without. */
const QUEUE_PROVIDERS: readonly Provider[] = hasRedis
	? [
			{
				provide: BACKUP_QUEUE,
				inject: [getQueueToken(QUEUE_NAMES.operationsBackup)],
				useFactory: (queue: Queue<OpsBackupJob>): BackupQueuePort => new BullBackupQueue(queue),
			},
			{
				provide: LOAD_TEST_QUEUE,
				inject: [getQueueToken(QUEUE_NAMES.operationsLoadTest)],
				useFactory: (queue: Queue<LoadTestJob>): LoadTestQueuePort => new BullLoadTestQueue(queue),
			},
			{
				provide: LoadTestEventsListener,
				inject: [LOAD_TEST_RECORDER, TypedConfigService],
				useFactory: (recorder: LoadTestRecorder, config: TypedConfigService): LoadTestEventsListener =>
					new LoadTestEventsListener(recorder, config.messaging.redisUrl ?? "", config.messaging.bullPrefix),
			},
		]
	: [
			{
				provide: BACKUP_QUEUE,
				inject: [ModuleRef],
				// The runner is resolved when a backup is queued (the runner itself needs this queue).
				useFactory: (moduleRef: ModuleRef): BackupQueuePort => new InlineBackupQueue((backupId) => moduleRef.get<BackupRunner>(BACKUP_RUNNER).run(backupId)),
			},
			{ provide: LOAD_TEST_QUEUE, useFactory: (): LoadTestQueuePort => new UnavailableLoadTestQueue() },
		];

/** The probe of every dependency the instances need (Strategy: one class each). */
function dependencyProbes(
	config: TypedConfigService,
	reads: OperationsReads,
	transactions: TenantTransactionService,
	redis: Redis | null,
	kafka: KafkaProducerService,
	moduleRef: ModuleRef,
	clock: Clock,
): DependencyProbe[] {
	const actor = systemActor(OPS_MONITOR_COLLECT_OPERATION, "job", null, "Check the database's statistics", null);
	const queues: CountableQueue[] | null = hasRedis ? ALL_QUEUE_NAMES.map((name) => moduleRef.get<Queue>(getQueueToken(name), { strict: false })) : null;
	return [
		new PostgresProbe(
			(work) => transactions.withSystemOperation({ operation: OPS_MONITOR_COLLECT_OPERATION, reason: "Read the database's statistics", actorUserId: null }, (db) => work(db)),
			async () => {
				const dayAgo = epochMs(Math.max(0, clock.now() - HOURS_PER_DAY * OPS_HOUR_MS));
				const points = await reads.read(actor, (scope) => scope.history.dependencyPoints("POSTGRES", "MINUTE", dayAgo, epochMs(dayAgo + OPS_HOUR_MS)));
				return points.at(0)?.sizeBytes ?? null;
			},
		),
		new RedisProbe(redis),
		new QueuesProbe(queues),
		new KafkaProbe(kafka, config.messaging.kafkaBrokers?.length ?? 0),
		new RabbitMqProbe(config.messaging.rabbitmqUrl),
		new EndpointsProbe([`${config.http.publicUrl}/${HEALTH_PROBE_PATHS.liveness}`, config.clientApps.webUrl, config.clientApps.adminUrl, config.clientApps.merchantUrl]),
	];
}

/**
 * The operations context (ADR 068): the platform's servers (reported by their server agents),
 * instances (each API process reports itself), dependencies, metric history and alerts; database
 * backups; and load tests, which the separate load runner drives. Every table is bypass-only under
 * RLS and reached through named `operations.*` / `load_test.*` system operations.
 */
@Module({
	imports: [PrismaModule, UnitOfWorkModule, SystemCommandModule, NotificationsModule, StorageModule, ThrottlerStorageModule, ...(hasRedis ? [OperationsQueueModule] : [])],
	controllers: [OperationsController, OperationsBackupsController, OperationsBackupFileController, OperationsLoadTestsController, OperationsAgentController],
	providers: [
		{
			provide: OPS_LIVE_STORE,
			inject: [REDIS_PUBLISHER, TypedConfigService],
			useFactory: (redis: Redis | null, config: TypedConfigService): OpsLiveStore =>
				redis === null ? new InMemoryOpsLiveStore() : new RedisOpsLiveStore(redis, config.redisNamespace),
		},
		{
			provide: OPS_UNIT_OF_WORK,
			inject: [TenantTransactionService, NotificationsTransactionalPortsFactory, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER],
			useFactory: (
				transactions: TenantTransactionService,
				notifications: NotificationsTransactionalPortsFactory,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
			): UnitOfWork<OperationsScope> => new PrismaUnitOfWork(transactions, new OperationsScopeFactory(notifications), dispatcher, publisher, USER_OWNED_DATA_SCOPE),
		},
		{
			provide: OPS_READS,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): OperationsReads =>
				new PrismaOperationsReads(new PrismaReadExecutor<Prisma.TransactionClient>(transactions, USER_OWNED_DATA_SCOPE)),
		},
		{
			provide: CLOUD_SERVER_FACTS,
			inject: [TypedConfigService],
			useFactory: (config: TypedConfigService): CloudServerFactsPort => CloudServerFactsRegistry.fromTokens(config.operations.cloudTokens, (url, init) => fetch(url, init)),
		},
		{
			provide: DEPENDENCY_PROBES,
			inject: [TypedConfigService, OPS_READS, TenantTransactionService, REDIS_PUBLISHER, KafkaProducerService, ModuleRef, CLOCK],
			useFactory: dependencyProbes,
		},
		{
			provide: DATABASE_DUMP,
			inject: [TypedConfigService],
			useFactory: (config: TypedConfigService): DatabaseDumpPort =>
				new PgDumpAdapter(config.operations.backupDatabaseUrl, config.operations.pgDumpDockerImage, config.operations.executableSearchPath),
		},
		{
			provide: BACKUP_STORAGE,
			inject: [OBJECT_STORAGE, TypedConfigService],
			useFactory: (storage: ObjectStorage, config: TypedConfigService): BackupStoragePort =>
				new ObjectStorageBackupAdapter(storage, config.storage.provider, config.storage.privateContainer),
		},
		{
			provide: LOAD_TEST_PASSWORDS,
			inject: [TypedConfigService],
			useFactory: (config: TypedConfigService): LoadTestPasswordPort => new RandomLoadTestPasswords(config.auth.bcryptSaltRounds),
		},
		{ provide: LOAD_TEST_TRAFFIC, useExisting: LoadTestTrafficKeys },
		RequestMetricsRecorder,
		{
			provide: INSTANCE_REPORTER,
			inject: [CLOCK, OPS_LIVE_STORE, OPS_UNIT_OF_WORK, RequestMetricsRecorder, PrismaService],
			useFactory: (clock: Clock, live: OpsLiveStore, uow: UnitOfWork<OperationsScope>, requests: RequestMetricsRecorder, prisma: PrismaService): InstanceReporter => {
				const sampler = new ProcessMetricsSampler();
				sampler.start();
				return new InstanceReporter({
					service: "api",
					hostname: hostname(),
					pid: process.pid,
					clock,
					live,
					uow,
					actor: systemActor(OPS_INSTANCE_RECORD_OPERATION, "job", null, "Record this instance's finished minute", null),
					sample: () => sampler.sample(),
					takeMinuteRequests: () => requests.takeMinute(),
					dbPool: () => {
						const pool = prisma.connectionPool();
						return { inUse: pool.totalCount - pool.idleCount, waiting: pool.waitingCount };
					},
				});
			},
		},
		{
			provide: OPERATIONS_MONITOR,
			inject: [OPS_UNIT_OF_WORK, OPS_LIVE_STORE, DEPENDENCY_PROBES, CLOCK, TypedConfigService],
			useFactory: (uow: UnitOfWork<OperationsScope>, live: OpsLiveStore, probes: DependencyProbe[], clock: Clock, config: TypedConfigService): OperationsMonitor =>
				new OperationsMonitor({
					uow,
					live,
					probes,
					clock,
					actor: systemActor(OPS_MONITOR_COLLECT_OPERATION, "cron", null, "Collect the minute and evaluate the alert rules", null),
					adminAppUrl: config.clientApps.adminUrl,
				}),
		},
		{
			provide: HISTORY_MAINTAINER,
			inject: [OPS_UNIT_OF_WORK, OPS_LIVE_STORE, CLOCK],
			useFactory: (uow: UnitOfWork<OperationsScope>, live: OpsLiveStore, clock: Clock): HistoryMaintainer =>
				new HistoryMaintainer(uow, live, clock, systemActor(OPS_HISTORY_MAINTAIN_OPERATION, "cron", null, "Roll up and prune the metric history", null)),
		},
		{
			provide: BACKUP_RUNNER,
			inject: [OPS_UNIT_OF_WORK, DATABASE_DUMP, BACKUP_STORAGE, BACKUP_QUEUE, CLOCK],
			useFactory: (uow: UnitOfWork<OperationsScope>, dump: DatabaseDumpPort, storage: BackupStoragePort, queue: BackupQueuePort, clock: Clock): BackupRunner =>
				new BackupRunner({
					uow,
					dump,
					storage,
					queue,
					clock,
					actor: systemActor(OPS_BACKUP_RUN_OPERATION, "job", null, "Take a database backup", null),
					timeZone: PLATFORM_DISPLAY_REGION.timeZone,
				}),
		},
		{
			provide: LOAD_TEST_RECORDER,
			inject: [OPS_UNIT_OF_WORK, OPS_LIVE_STORE, CLOCK],
			useFactory: (uow: UnitOfWork<OperationsScope>, live: OpsLiveStore, clock: Clock): LoadTestRecorder =>
				new LoadTestRecorder(uow, live, clock, systemActor(LOAD_TEST_RECORD_OPERATION, "consumer", null, "Record a load test's progress", null)),
		},
		{
			provide: OPERATIONS_READ,
			inject: [OPS_READS, OPS_LIVE_STORE, CLOUD_SERVER_FACTS, CLOCK, DATABASE_DUMP, BACKUP_STORAGE, LOAD_TEST_QUEUE, TypedConfigService],
			useFactory: (
				reads: OperationsReads,
				live: OpsLiveStore,
				cloud: CloudServerFactsPort,
				clock: Clock,
				dump: DatabaseDumpPort,
				backupStorage: BackupStoragePort,
				loadTestQueue: LoadTestQueuePort,
				config: TypedConfigService,
			): OperationsReadService =>
				new OperationsReadService({
					reads,
					live,
					cloud,
					clock,
					dump,
					backupStorage,
					loadTesting: {
						enabled: config.operations.loadTesting.enabled,
						allowProduction: config.operations.loadTesting.allowProduction,
						isProduction: config.runtime.isProduction,
						queueAvailable: loadTestQueue.available,
					},
				}),
		},
		OperationsScheduler,
		...QUEUE_PROVIDERS,
		...COMMAND_HANDLERS,
	],
	exports: [RequestMetricsRecorder],
})
export class OperationsModule {}
