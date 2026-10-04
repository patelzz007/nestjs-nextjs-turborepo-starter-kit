import { Module } from "@nestjs/common";

import { ConfigModule } from "../../config/config.module";
import { TypedConfigService } from "../../config/typed-config.service";

import { LocalTransferTokenService } from "./adapters/local/local-transfer-token.service";
import { createMalwareScanner } from "./adapters/scanners/malware-scanner.factory";
import type { CdnCacheInvalidator } from "./domain/cdn-cache.port";
import type { MalwareScanner } from "./domain/malware-scanner.port";
import { ACTIVE_STORAGE_ADAPTER, CDN_CACHE_INVALIDATOR, MALWARE_SCANNER, OBJECT_STORAGE, PUBLIC_DELIVERY } from "./domain/storage.tokens";
import { createCdnCacheInvalidator } from "./factory/cdn-cache-invalidator.factory";
import { createStorageAdapter, type StorageAdapter } from "./factory/storage-adapter.factory";

@Module({
	imports: [ConfigModule],
	providers: [
		{
			// One signing key per process, shared by the local adapter (signs) and the local transfer endpoints (verify).
			provide: LocalTransferTokenService,
			useFactory: (): LocalTransferTokenService => new LocalTransferTokenService(),
		},
		{
			provide: ACTIVE_STORAGE_ADAPTER,
			useFactory: (config: TypedConfigService, tokens: LocalTransferTokenService): StorageAdapter => createStorageAdapter(config, tokens),
			inject: [TypedConfigService, LocalTransferTokenService],
		},
		{
			provide: OBJECT_STORAGE,
			useExisting: ACTIVE_STORAGE_ADAPTER,
		},
		{
			provide: PUBLIC_DELIVERY,
			useExisting: ACTIVE_STORAGE_ADAPTER,
		},
		{
			provide: MALWARE_SCANNER,
			useFactory: (config: TypedConfigService): MalwareScanner => createMalwareScanner(config.malwareScanner),
			inject: [TypedConfigService],
		},
		{
			provide: CDN_CACHE_INVALIDATOR,
			useFactory: (config: TypedConfigService): CdnCacheInvalidator => createCdnCacheInvalidator(config),
			inject: [TypedConfigService],
		},
	],
	exports: [OBJECT_STORAGE, PUBLIC_DELIVERY, MALWARE_SCANNER, CDN_CACHE_INVALIDATOR, LocalTransferTokenService],
})
export class StorageModule {}
