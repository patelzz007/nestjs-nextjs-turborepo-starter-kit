import { Global, Module } from "@nestjs/common";

import { getApiConfig } from "./api-config";
import { TenancyConfigService } from "./tenancy.config";
import { TypedConfigService } from "./typed-config.service";

/**
 * Global configuration context.
 *
 * `TypedConfigService` wraps the `ApiConfig` parsed ONCE from the environment
 * (`api-config.ts`, validated by `api-config.schema.ts`). `main.ts` parses it
 * before Nest bootstraps, so by the time this factory runs the memoized config
 * is already valid.
 *
 * `TypedConfigService` must be resolvable from ANY module's DI container —
 * including inside `ThrottlerModule.forRootAsync({ inject: [TypedConfigService] })`.
 * Imported modules instantiate BEFORE the importing module's own providers, so a
 * locally-provided `TypedConfigService` is never visible to a dynamic module's
 * options factory. Making this module `@Global()` (same pattern as `PrismaModule`)
 * lets every dynamic-module `inject` resolve it regardless of wiring order.
 */
@Global()
@Module({
	providers: [{ provide: TypedConfigService, useFactory: (): TypedConfigService => new TypedConfigService(getApiConfig()) }, TenancyConfigService],
	exports: [TypedConfigService, TenancyConfigService],
})
export class ConfigModule {}
