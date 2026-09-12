import { Module } from "@nestjs/common";

import { PrismaModule } from "../../prisma/prisma.module";
import { StorageModule } from "../storage/storage.module";

import { StorageQueueService } from "./services/storage-queue.service";

@Module({
	imports: [PrismaModule, StorageModule],
	providers: [StorageQueueService],
	exports: [StorageQueueService],
})
export class StorageQueueModule {}
