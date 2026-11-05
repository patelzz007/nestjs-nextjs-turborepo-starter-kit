import type { StoreFeatureFlags } from "../../../feature-flags/public-api";
import type { TillRedemptionGate } from "../../application/ports/till-redemption.port";
import type { CheckoutPoint } from "../../domain/aggregates/reward-sale.aggregate";

/** The till's gate from the `till-redemption` store flag, at the till's own store (its branch when known). */
export class FeatureFlagTillRedemptionGate implements TillRedemptionGate {
	public constructor(private readonly flags: StoreFeatureFlags) {}

	public isOpen(point: CheckoutPoint): Promise<boolean> {
		return this.flags.isOnAtStore("till-redemption", { tenantId: point.tenantId, locationId: point.locationId }, null);
	}
}
