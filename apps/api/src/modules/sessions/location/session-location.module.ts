import { Module } from "@nestjs/common";

import { TypedConfigService } from "../../../config/typed-config.service";
import { createSessionLocationResolver } from "./session-location.factory";
import { SessionLocationLookupService } from "./session-location-lookup.service";
import { SESSION_LOCATION_RESOLVER } from "./session-location.port";

/** The `SessionLocationResolver` port (provider from `SESSION_LOCATION_PROVIDER`) and its bounded, never-failing lookup. */
@Module({
	providers: [{ provide: SESSION_LOCATION_RESOLVER, useFactory: createSessionLocationResolver, inject: [TypedConfigService] }, SessionLocationLookupService],
	exports: [SessionLocationLookupService],
})
export class SessionLocationModule {}
