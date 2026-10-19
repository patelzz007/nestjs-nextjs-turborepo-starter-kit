import { Global, Module } from "@nestjs/common";

import { RequestContextService } from "./request-context";

/** Makes the single request-context accessor injectable everywhere (ADR 017). */
@Global()
@Module({
	providers: [RequestContextService],
	exports: [RequestContextService],
})
export class RequestContextModule {}
