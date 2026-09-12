import { Module } from "@nestjs/common";

import { ConfigModule } from "../../config/config.module";
import { TypedConfigService } from "../../config/typed-config.service";

import { FileUploadService } from "./application/file-upload.service";
import { ACTIVE_STORAGE_ADAPTER, OBJECT_STORAGE, PUBLIC_DELIVERY } from "./domain/storage.tokens";
import { createStorageAdapter, type StorageAdapter } from "./factory/storage-adapter.factory";

@Module({
	imports: [ConfigModule],
	providers: [
		FileUploadService,
		{
			provide: ACTIVE_STORAGE_ADAPTER,
			useFactory: (config: TypedConfigService): StorageAdapter => createStorageAdapter(config),
			inject: [TypedConfigService],
		},
		{
			provide: OBJECT_STORAGE,
			useExisting: ACTIVE_STORAGE_ADAPTER,
		},
		{
			provide: PUBLIC_DELIVERY,
			useExisting: ACTIVE_STORAGE_ADAPTER,
		},
	],
	exports: [OBJECT_STORAGE, PUBLIC_DELIVERY, FileUploadService],
})
export class StorageModule {}
