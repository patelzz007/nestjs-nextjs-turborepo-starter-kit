import { Global, Module } from "@nestjs/common";

import { CorrelationContextInterceptor } from "./correlation-context.interceptor";
import { CorrelationContextService } from "./correlation-context.service";

@Global()
@Module({
	providers: [CorrelationContextService, CorrelationContextInterceptor],
	exports: [CorrelationContextService, CorrelationContextInterceptor],
})
export class CorrelationContextModule {}
