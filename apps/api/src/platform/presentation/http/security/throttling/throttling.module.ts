import { type DynamicModule, Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";

import { ConfigModule } from "../../../../../config/config.module";
import { TypedConfigService } from "../../../../../config/typed-config.service";
import { RedisThrottlerStorage } from "../../../../infrastructure/throttling/redis-throttler.storage";
import { ThrottlerStorageModule } from "../../../../infrastructure/throttling/throttler-storage.module";
import { PreAuthThrottlerGuard, PrincipalThrottlerGuard } from "./scoped-throttler.guards";
import { throttlerOptionsFactory } from "./throttler-options.factory";

/**
 * The only `ThrottlerModule` registration in the app (named `strict`, `default`
 * and `webhook` throttlers). `ThrottlerModule` is global, so a second
 * registration anywhere would compete for `THROTTLER_OPTIONS` and the global
 * `ThrottlerGuard` could pick up the wrong one (review finding 1).
 */
const throttlerRegistration: DynamicModule = ThrottlerModule.forRootAsync({
	imports: [ConfigModule, ThrottlerStorageModule],
	inject: [TypedConfigService, RedisThrottlerStorage],
	useFactory: throttlerOptionsFactory,
});

/** Imported once from `AppModule`. The two scoped guards run as `APP_GUARD`s (`APP_GUARD_ORDER`). */
@Module({
	imports: [throttlerRegistration],
	providers: [PreAuthThrottlerGuard, PrincipalThrottlerGuard],
	exports: [throttlerRegistration, PreAuthThrottlerGuard, PrincipalThrottlerGuard],
})
export class ThrottlingModule {}
