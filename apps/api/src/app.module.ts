import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";

import { ResponseInterceptor } from "./common/interceptors/response.interceptor.js";
import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { AuthGuard } from "./modules/auth/guards/auth.guard.js";
import { HealthModule } from "./modules/health/health.module.js";
import { ImpersonationModule } from "./modules/impersonation/impersonation.module.js";
import { SessionsModule } from "./modules/sessions/sessions.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
	imports: [PrismaModule, HealthModule, AuthModule, SessionsModule, ImpersonationModule],
	providers: [
		{
			provide: APP_INTERCEPTOR,
			useClass: ResponseInterceptor,
		},
		{
			provide: APP_GUARD,
			useClass: AuthGuard,
		},
	],
})
export class AppModule implements NestModule {
	public configure(consumer: MiddlewareConsumer): void {
		consumer.apply(CorrelationIdMiddleware).forRoutes("*");
	}
}
