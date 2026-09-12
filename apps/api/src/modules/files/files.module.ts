import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";

import { FilesController } from "./controllers/files.controller";
import { StoredFileRepository } from "./repositories/stored-file.repository";
import { FileScanService } from "./services/file-scan.service";
import { FileService } from "./services/file.service";
import { StorageCleanupProcessor, StorageDeleteProcessor, StorageQueueScheduler } from "./services/storage-queue.processors";
import { StorageQueueModule } from "./storage-queue.module";

const redisUrl: string | undefined = process.env.REDIS_URL;
const hasRedis: boolean = redisUrl !== undefined && redisUrl.length > 0;
const storageQueueImports = hasRedis ? [StorageQueueModule] : [];
const storageQueueProviders = hasRedis ? [StorageQueueScheduler, StorageCleanupProcessor, StorageDeleteProcessor] : [];

@Module({
	imports: [PrismaModule, StorageModule, ...storageQueueImports],
	controllers: [FilesController],
	providers: [StoredFileRepository, FileService, FileScanService, ...storageQueueProviders],
	exports: [StoredFileRepository, FileService, FileScanService],
})
export class FilesModule {}
