import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";

import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { AuthGuard } from "./common/guards/auth.guard.js";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor.js";
import { CorrelationIdMiddleware } from "./common/middleware/correlation-id.middleware.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({
	imports: [PrismaModule, AuthModule],
	controllers: [AppController],
	providers: [
		AppService,
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
