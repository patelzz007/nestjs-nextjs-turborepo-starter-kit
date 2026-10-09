import type { SessionLocationProvider } from "../../../config/api-env.fields";
import { TypedConfigService } from "../../../config/typed-config.service";
import { NoneSessionLocationResolver } from "./none-session-location.resolver";
import type { SessionLocationResolver } from "./session-location.port";

/** One factory per provider — a `Record`, so adding a provider to the schema fails to compile until it has an adapter. */
const PROVIDER_FACTORIES: Readonly<Record<SessionLocationProvider, (config: TypedConfigService) => SessionLocationResolver>> = {
	none: (): SessionLocationResolver => new NoneSessionLocationResolver(),
};

/** Builds the resolver `SESSION_LOCATION_PROVIDER` selects (validated at boot). */
export function createSessionLocationResolver(config: TypedConfigService): SessionLocationResolver {
	return PROVIDER_FACTORIES[config.sessions.locationProvider](config);
}
