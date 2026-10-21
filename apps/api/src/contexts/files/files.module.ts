import { getQueueToken } from "@nestjs/bullmq";
import { Module, type Provider } from "@nestjs/common";
import type { Prisma, StoredFile } from "@prisma/client";
import type { Queue } from "bullmq";
import type { StorageCdnInvalidationJob, StorageDeleteJob, StorageScanJob } from "@workspace/shared";

import { getApiConfig } from "../../config/api-config";
import { TypedConfigService } from "../../config/typed-config.service";
import { CLOCK, type Clock } from "../../platform/application/clock.port";
import type { UnitOfWork } from "../../platform/application/unit-of-work.port";
import { LocalTransferTokenService } from "../../platform/infrastructure/storage/adapters/local/local-transfer-token.service";
import type { CdnCacheInvalidator } from "../../platform/infrastructure/storage/domain/cdn-cache.port";
import type { MalwareScanner } from "../../platform/infrastructure/storage/domain/malware-scanner.port";
import type { ObjectStorage } from "../../platform/infrastructure/storage/domain/object-storage.port";
import type { PublicDelivery } from "../../platform/infrastructure/storage/domain/public-delivery.port";
import { CDN_CACHE_INVALIDATOR, MALWARE_SCANNER, OBJECT_STORAGE, PUBLIC_DELIVERY } from "../../platform/infrastructure/storage/domain/storage.tokens";
import { StorageModule } from "../../platform/infrastructure/storage/storage.module";
import { SystemCommandModule } from "../../platform/infrastructure/system-command.module";
import type { AfterCommitPublisher } from "../../platform/infrastructure/unit-of-work/after-commit-publisher";
import { USER_OWNED_DATA_SCOPE } from "../../platform/infrastructure/unit-of-work/actor-to-rls-context";
import { PrismaReadExecutor } from "../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { PrismaUnitOfWork } from "../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { TransactionalEventDispatcher } from "../../platform/infrastructure/unit-of-work/transactional-event-dispatcher";
import { AFTER_COMMIT_PUBLISHER, UnitOfWorkModule } from "../../platform/infrastructure/unit-of-work/unit-of-work.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { ApplyFileProcessingResultHandler } from "./application/commands/apply-file-processing-result/apply-file-processing-result.handler";
import { CleanUpStaleUploadsHandler } from "./application/commands/clean-up-stale-uploads/clean-up-stale-uploads.handler";
import { CompleteFileUploadHandler } from "./application/commands/complete-file-upload/complete-file-upload.handler";
import { DeleteFileHandler } from "./application/commands/delete-file/delete-file.handler";
import { FileDeletion } from "./application/commands/delete-file/file-deletion";
import { InvalidateFileCdnHandler } from "./application/commands/invalidate-file-cdn/invalidate-file-cdn.handler";
import { PurgeFileObjectHandler } from "./application/commands/purge-file-object/purge-file-object.handler";
import { RequestFileUploadHandler } from "./application/commands/request-file-upload/request-file-upload.handler";
import { ScanFileHandler } from "./application/commands/scan-file/scan-file.handler";
import { PurgeDeletedFileObjectsHandler } from "./application/event-handlers/after-commit/purge-deleted-file-objects.event-handler";
import type { FilesScope } from "./application/files-scope";
import { FileCategoryAccessRegistry } from "./application/ports/file-category-access.port";
import type { FileObjectStoragePort } from "./application/ports/file-object-storage.port";
import type { CdnInvalidationPort, FileProcessingPort } from "./application/ports/file-processing.port";
import { FileReferenceGuardRegistry } from "./application/ports/file-reference.port";
import {
	CDN_INVALIDATION,
	FILE_OBJECT_STORAGE,
	FILE_PROCESSING,
	FILES_SCAN_VERDICT_OPERATION,
	FILES_UNIT_OF_WORK,
	LOCAL_STORAGE_TRANSFER,
	PROCESSING_CALLBACK_AUTHENTICATOR,
	STORED_FILE_READS,
} from "./application/ports/files.tokens";
import { StorageTaskDispatcher } from "./application/ports/storage-task-dispatcher.port";
import { GetFileDownloadUrlHandler } from "./application/queries/get-file-download-url/get-file-download-url.handler";
import { GetFileHandler } from "./application/queries/get-file/get-file.handler";
import { CdnInvalidationAdapter } from "./infrastructure/adapters/cdn-invalidation.adapter";
import { FileProcessingAdapter } from "./infrastructure/adapters/file-processing.adapter";
import { StoredFileAccess } from "./infrastructure/adapters/stored-file-access";
import { ImageRenditionService } from "./infrastructure/adapters/image-rendition.service";
import { InlineStorageTaskDispatcher } from "./infrastructure/adapters/inline-storage-task-dispatcher";
import { LocalStorageTransferService } from "./infrastructure/adapters/local-storage-transfer.service";
import { SharedSecretCallbackAuthenticator } from "./infrastructure/adapters/processing-callback-authenticator.adapter";
import { QueuedStorageTaskDispatcher, STORAGE_CDN_INVALIDATE_QUEUE, STORAGE_DELETE_QUEUE, STORAGE_SCAN_QUEUE } from "./infrastructure/adapters/queued-storage-task-dispatcher";
import { StorageFileObjectAdapter } from "./infrastructure/adapters/storage-file-object.adapter";
import { FilesScopeFactory } from "./infrastructure/persistence/files-scope.factory";
import { FilesQueueModule } from "./infrastructure/queue/files-queue.module";
import { PrismaStoredFileReadRepository } from "./infrastructure/persistence/prisma-stored-file.read-repository";
import { FilesController, TenantFilesController } from "./presentation/http/files.controller";
import { LocalStorageTransferController } from "./presentation/http/local-storage-transfer.controller";

// Executor wiring is decided at load time from the validated config (parsed by main.ts first):
// BullMQ when Redis is configured (always in production), in-request otherwise. Never "no executor".
const hasRedis: boolean = getApiConfig().messaging.redisUrl !== undefined;
/** The storage workers exist only with Redis (they inject its queues). */
const storageQueueImports = hasRedis ? [FilesQueueModule] : [];
const storageTaskProviders: Provider[] = hasRedis
	? [
			{
				provide: StorageTaskDispatcher,
				useFactory: (
					config: TypedConfigService,
					scanQueue: Queue<StorageScanJob>,
					deleteQueue: Queue<StorageDeleteJob>,
					cdnInvalidationQueue: Queue<StorageCdnInvalidationJob>,
				): StorageTaskDispatcher => new QueuedStorageTaskDispatcher(config.storage.physicalDeleteDelayMs, scanQueue, deleteQueue, cdnInvalidationQueue),
				inject: [TypedConfigService, getQueueToken(STORAGE_SCAN_QUEUE), getQueueToken(STORAGE_DELETE_QUEUE), getQueueToken(STORAGE_CDN_INVALIDATE_QUEUE)],
			},
		]
	: [
			{
				provide: StorageTaskDispatcher,
				useFactory: (processing: FileProcessingPort, storage: FileObjectStoragePort, cdn: CdnInvalidationPort): StorageTaskDispatcher =>
					new InlineStorageTaskDispatcher(processing, storage, cdn),
				inject: [FILE_PROCESSING, FILE_OBJECT_STORAGE, CDN_INVALIDATION],
			},
		];

/**
 * The files context (§6.1): generic file lifecycle — upload, scan, verdict,
 * renditions, delete. The owner of each category (tenants, rewards,
 * identity, integrations-github, catalog) plugs in through the access-rule and
 * reference-guard registries and the in-transaction event registry from its own
 * module; files never imports the contexts that use it.
 */
@Module({
	imports: [PrismaModule, StorageModule, UnitOfWorkModule, SystemCommandModule, ...storageQueueImports],
	controllers: [FilesController, TenantFilesController, LocalStorageTransferController],
	providers: [
		{ provide: FileCategoryAccessRegistry, useFactory: (): FileCategoryAccessRegistry => new FileCategoryAccessRegistry() },
		{
			provide: FileReferenceGuardRegistry,
			useFactory: (): FileReferenceGuardRegistry<Prisma.TransactionClient> => new FileReferenceGuardRegistry<Prisma.TransactionClient>(),
		},
		{
			provide: FILES_UNIT_OF_WORK,
			inject: [TenantTransactionService, FileReferenceGuardRegistry, TransactionalEventDispatcher, AFTER_COMMIT_PUBLISHER],
			useFactory: (
				transactions: TenantTransactionService,
				guards: FileReferenceGuardRegistry<Prisma.TransactionClient>,
				dispatcher: TransactionalEventDispatcher<Prisma.TransactionClient>,
				publisher: AfterCommitPublisher,
			): UnitOfWork<FilesScope> => new PrismaUnitOfWork(transactions, new FilesScopeFactory(guards), dispatcher, publisher, USER_OWNED_DATA_SCOPE),
		},
		{
			provide: STORED_FILE_READS,
			inject: [TenantTransactionService, TypedConfigService],
			useFactory: (transactions: TenantTransactionService, config: TypedConfigService): PrismaStoredFileReadRepository =>
				new PrismaStoredFileReadRepository(new PrismaReadExecutor<Prisma.TransactionClient>(transactions, USER_OWNED_DATA_SCOPE), config.http.publicUrl),
		},
		ImageRenditionService,
		{
			provide: FILE_OBJECT_STORAGE,
			inject: [TypedConfigService, OBJECT_STORAGE, PUBLIC_DELIVERY, ImageRenditionService],
			useFactory: (config: TypedConfigService, storage: ObjectStorage, publicDelivery: PublicDelivery, renditions: ImageRenditionService): FileObjectStoragePort =>
				new StorageFileObjectAdapter(config, storage, publicDelivery, renditions),
		},
		{
			provide: CDN_INVALIDATION,
			inject: [CDN_CACHE_INVALIDATOR],
			useFactory: (cdnCache: CdnCacheInvalidator): CdnInvalidationPort => new CdnInvalidationAdapter(cdnCache),
		},
		{
			provide: FILE_PROCESSING,
			inject: [FILES_UNIT_OF_WORK, TenantTransactionService, OBJECT_STORAGE, PUBLIC_DELIVERY, MALWARE_SCANNER, ImageRenditionService, CLOCK],
			useFactory: (
				uow: UnitOfWork<FilesScope>,
				transactions: TenantTransactionService,
				storage: ObjectStorage,
				publicDelivery: PublicDelivery,
				scanner: MalwareScanner,
				renditions: ImageRenditionService,
				clock: Clock,
			): FileProcessingPort =>
				new FileProcessingAdapter({
					uow,
					rows: {
						findLive: (fileId: string): Promise<StoredFile | null> =>
							transactions.withSystemOperation(
								{ operation: FILES_SCAN_VERDICT_OPERATION, reason: "Load a file awaiting its scan verdict", actorUserId: null },
								(tx): Promise<StoredFile | null> => tx.storedFile.findFirst({ where: { id: fileId, isDeleted: false } }),
							),
					},
					storage,
					publicDelivery,
					scanner,
					renditions,
					clock,
				}),
		},
		{
			provide: PROCESSING_CALLBACK_AUTHENTICATOR,
			inject: [TypedConfigService],
			useFactory: (config: TypedConfigService): SharedSecretCallbackAuthenticator => new SharedSecretCallbackAuthenticator(config.storage.processingCallbackSecret),
		},
		{
			provide: LOCAL_STORAGE_TRANSFER,
			inject: [TypedConfigService, TenantTransactionService, LocalTransferTokenService, OBJECT_STORAGE],
			useFactory: (
				config: TypedConfigService,
				transactions: TenantTransactionService,
				tokens: LocalTransferTokenService,
				storage: ObjectStorage,
			): LocalStorageTransferService => new LocalStorageTransferService(config, transactions, tokens, storage),
		},
		...storageTaskProviders,
		FileDeletion,
		RequestFileUploadHandler,
		CompleteFileUploadHandler,
		ApplyFileProcessingResultHandler,
		DeleteFileHandler,
		ScanFileHandler,
		CleanUpStaleUploadsHandler,
		PurgeFileObjectHandler,
		InvalidateFileCdnHandler,
		GetFileHandler,
		GetFileDownloadUrlHandler,
		PurgeDeletedFileObjectsHandler,
		{
			provide: StoredFileAccess,
			inject: [TypedConfigService, TenantTransactionService, FILE_OBJECT_STORAGE, OBJECT_STORAGE, StorageTaskDispatcher, FileDeletion],
			useFactory: (
				config: TypedConfigService,
				transactions: TenantTransactionService,
				storage: FileObjectStoragePort,
				objects: ObjectStorage,
				dispatcher: StorageTaskDispatcher,
				deletion: FileDeletion,
			): StoredFileAccess => new StoredFileAccess({ config, transactions, storage, objects, dispatcher, deletion }),
		},
	],
	exports: [FileCategoryAccessRegistry, FileReferenceGuardRegistry, StoredFileAccess, ImageRenditionService],
})
export class FilesModule {}
