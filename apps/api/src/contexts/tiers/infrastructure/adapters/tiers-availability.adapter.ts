import type { ApiFeatureFlags } from "../../../feature-flags/public-api";
import type { TiersAvailabilityPort } from "../../application/ports/tiers-availability.port";

/** Tiers are on exactly while the `customer-tiers` flag is (ADR 085). */
export class TiersAvailabilityAdapter implements TiersAvailabilityPort {
	public constructor(private readonly flags: ApiFeatureFlags) {}

	public isOn(): Promise<boolean> {
		return this.flags.isOn("customer-tiers");
	}
}
