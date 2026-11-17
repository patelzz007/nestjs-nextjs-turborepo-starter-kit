import { DEPLOYMENT_WIDE, type FeatureFlags } from "../../../feature-flags/public-api";
import type { TiersAvailabilityPort } from "../../application/ports/tiers-availability.port";

/** Tiers are on exactly while the `customer-tiers` flag is (ADR 085), decided for everyone at once. */
export class TiersAvailabilityAdapter implements TiersAvailabilityPort {
	public constructor(private readonly flags: FeatureFlags) {}

	public isOn(): Promise<boolean> {
		return this.flags.isOn("customer-tiers", DEPLOYMENT_WIDE);
	}
}
