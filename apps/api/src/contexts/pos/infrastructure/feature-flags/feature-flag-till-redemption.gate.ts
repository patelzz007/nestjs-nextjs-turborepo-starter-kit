import type { FeatureFlags } from "../../../feature-flags/public-api";
import type { TillRedemptionGate } from "../../application/ports/till-redemption.port";
import type { CheckoutPoint } from "../../domain/aggregates/reward-sale.aggregate";

/**
 * The till's gate from the `till-redemption` flag, decided at the till's own store: its location's override, then
 * its tenant's, then the flag's rules (ADR 087).
 */
export class FeatureFlagTillRedemptionGate implements TillRedemptionGate {
	public constructor(private readonly flags: FeatureFlags) {}

	public isOpen(point: CheckoutPoint): Promise<boolean> {
		return this.flags.isOn("till-redemption", { userId: null, tenantId: point.tenantId, locationId: point.locationId });
	}
}
