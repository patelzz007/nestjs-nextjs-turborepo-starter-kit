import { getQueueToken } from "@nestjs/bullmq";
import { Module, type Provider } from "@nestjs/common";
import { DiscoveryModule, DiscoveryService } from "@nestjs/core";
import type { Queue } from "bullmq";
import type { StorageCdnInvalidationJob, StorageDeleteJob, StorageScanJob } from "@workspace/shared";

import { getApiConfig } from "../../config/api-config";
import { TypedConfigService } from "../../config/typed-config.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { OrganizationModule } from "../organization/organization.module";
import type { CdnCacheInvalidator } from "../storage/domain/cdn-cache.port";
import type { ObjectStorage } from "../storage/domain/object-storage.port";
import { CDN_CACHE_INVALIDATOR, OBJECT_STORAGE } from "../storage/domain/storage.tokens";
import { StorageModule } from "../storage/storage.module";

import { FilesController } from "./controllers/files.controller";
import { LocalStorageTransferController } from "./controllers/local-storage-transfer.controller";
import { FileLifecycleListenerRegistry } from "./lifecycle/file-lifecycle-listener.registry";
import { StoredFileRepository } from "./repositories/stored-file.repository";
import { FileAuthorizationService } from "./services/file-authorization.service";
import { FileFinalizationService } from "./services/file-finalization.service";
import { FileScanService } from "./services/file-scan.service";
import { FileService } from "./services/file.service";
import { InlineStorageTaskDispatcher } from "./services/inline-storage-task-dispatcher";
import { LocalStorageTransferService } from "./services/local-storage-transfer.service";
import { QueuedStorageTaskDispatcher, STORAGE_CDN_INVALIDATE_QUEUE, STORAGE_DELETE_QUEUE, STORAGE_SCAN_QUEUE } from "./services/queued-storage-task-dispatcher";
import {
	StorageCdnInvalidationProcessor,
	StorageCleanupProcessor,
	StorageDeleteProcessor,
	StorageQueueScheduler,
	StorageScanProcessor,
} from "./services/storage-queue.processors";
import { StorageTaskDispatcher } from "./services/storage-task-dispatcher";

// Executor wiring is decided at load time from the validated config (parsed by main.ts first):
// BullMQ when Redis is configured (always in production), in-request otherwise. Never "no executor".
const hasRedis: boolean = getApiConfig().messaging.redisUrl !== undefined;
const storageTaskProviders: Provider[] = hasRedis
	? [
			{
				provide: StorageTaskDispatcher,
				useFactory: (
					config: TypedConfigService,
					scanQueue: Queue<StorageScanJob>,
					deleteQueue: Queue<StorageDeleteJob>,
					cdnInvalidationQueue: Queue<StorageCdnInvalidationJob>,
				): StorageTaskDispatcher => new QueuedStorageTaskDispatcher(config, scanQueue, deleteQueue, cdnInvalidationQueue),
				inject: [TypedConfigService, getQueueToken(STORAGE_SCAN_QUEUE), getQueueToken(STORAGE_DELETE_QUEUE), getQueueToken(STORAGE_CDN_INVALIDATE_QUEUE)],
			},
			StorageQueueScheduler,
			StorageCleanupProcessor,
			StorageDeleteProcessor,
			StorageScanProcessor,
			StorageCdnInvalidationProcessor,
		]
	: [
			{
				provide: StorageTaskDispatcher,
				useFactory: (fileScan: FileScanService, storage: ObjectStorage, cdnCache: CdnCacheInvalidator): StorageTaskDispatcher =>
					new InlineStorageTaskDispatcher(fileScan, storage, cdnCache),
				inject: [FileScanService, OBJECT_STORAGE, CDN_CACHE_INVALIDATOR],
			},
		];

@Module({
	imports: [PrismaModule, StorageModule, OrganizationModule, DiscoveryModule],
	controllers: [FilesController, LocalStorageTransferController],
	providers: [
		StoredFileRepository,
		FileService,
		FileFinalizationService,
		FileScanService,
		FileAuthorizationService,
		LocalStorageTransferService,
		{
			// Category listeners (FileLifecycleListener providers in feature modules) are discovered, never imported here.
			provide: FileLifecycleListenerRegistry,
			useFactory: (discovery: DiscoveryService): FileLifecycleListenerRegistry => new FileLifecycleListenerRegistry(discovery),
			inject: [DiscoveryService],
		},
		...storageTaskProviders,
	],
	exports: [StoredFileRepository, FileService],
})
export class FilesModule {}
