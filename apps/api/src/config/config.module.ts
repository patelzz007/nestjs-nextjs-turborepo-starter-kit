import { Global, Module } from "@nestjs/common";

import { TypedConfigService } from "./typed-config.service.js";

/**
 * Global configuration context.
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
	providers: [TypedConfigService],
	exports: [TypedConfigService],
})
export class ConfigModule {}
