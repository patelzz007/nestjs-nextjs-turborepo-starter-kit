import { Global, Module } from "@nestjs/common";

import { ConfigModule } from "../../../../config/config.module";
import { CookieConfigService } from "./cookies/cookie.config";

/**
 * What the platform security kit's interceptors and guards need besides identity's tokens: the auth
 * cookie configuration. Global, so `@UseInterceptors(SetAuthCookiesInterceptor)` and friends resolve in
 * every context module that declares them. Imported once by `AppModule`.
 */
@Global()
@Module({
	imports: [ConfigModule],
	providers: [CookieConfigService],
	exports: [CookieConfigService],
})
export class HttpSecurityModule {}
