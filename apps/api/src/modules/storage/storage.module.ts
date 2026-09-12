import { Module } from "@nestjs/common";

import { ConfigModule } from "../../config/config.module";
import { TypedConfigService } from "../../config/typed-config.service";

import { FileUploadService } from "./file-upload.service";
import { LocalObjectStorageService } from "./local-object-storage.service";
import { S3ObjectStorageService } from "./s3-object-storage.service";
import { OBJECT_STORAGE } from "./storage.tokens";
import type { ObjectStorageService } from "./storage.types";

@Module({
	imports: [ConfigModule],
	providers: [
		LocalObjectStorageService,
		S3ObjectStorageService,
		FileUploadService,
		{
			provide: OBJECT_STORAGE,
			useFactory: (config: TypedConfigService, local: LocalObjectStorageService, s3: S3ObjectStorageService): ObjectStorageService => {
				return config.useS3Storage ? s3 : local;
			},
			inject: [TypedConfigService, LocalObjectStorageService, S3ObjectStorageService],
		},
	],
	exports: [OBJECT_STORAGE, FileUploadService],
})
export class StorageModule {}
