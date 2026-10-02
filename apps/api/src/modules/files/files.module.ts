import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { OrganizationModule } from "../organization/organization.module";
import { StorageModule } from "../storage/storage.module";

import { FilesController } from "./controllers/files.controller";
import { StoredFileRepository } from "./repositories/stored-file.repository";
import { FileAuthorizationService } from "./services/file-authorization.service";
import { FileService } from "./services/file.service";
import { StorageCleanupProcessor, StorageDeleteProcessor, StorageQueueScheduler } from "./services/storage-queue.processors";
import { StorageQueueModule } from "./storage-queue.module";
import { getApiConfig } from "../../config/api-config";

// Queue wiring is decided at load time from the validated config (parsed by main.ts first).
const redisUrl: string | undefined = getApiConfig().messaging.redisUrl;
const hasRedis: boolean = redisUrl !== undefined;
const storageQueueImports = hasRedis ? [StorageQueueModule] : [];
const storageQueueProviders = hasRedis ? [StorageQueueScheduler, StorageCleanupProcessor, StorageDeleteProcessor] : [];

@Module({
	imports: [PrismaModule, StorageModule, OrganizationModule, ...storageQueueImports],
	controllers: [FilesController],
	providers: [StoredFileRepository, FileService, FileAuthorizationService, ...storageQueueProviders],
	exports: [StoredFileRepository, FileService],
})
export class FilesModule {}
