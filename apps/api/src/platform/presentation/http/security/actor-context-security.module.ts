import { Global, Module } from "@nestjs/common";

import { RequestContextModule } from "../../../infrastructure/context/request-context.module";
import { ActorContextFactory } from "./actor-context.factory";
import { NestActorTenancyPolicy } from "./actor-tenancy.policy";

/**
 * HTTP actor resolution. `RlsInterceptor` resolves each request once and binds
 * the actor to the request context, where `@CurrentActor()` reads it.
 */
@Global()
@Module({
	imports: [RequestContextModule],
	providers: [NestActorTenancyPolicy, ActorContextFactory],
	exports: [NestActorTenancyPolicy, ActorContextFactory],
})
export class ActorContextSecurityModule {}
