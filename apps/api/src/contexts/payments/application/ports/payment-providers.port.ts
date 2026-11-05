import type { PaymentProviderName } from "@workspace/shared";

import type { PaymentProviderPort } from "./payment-provider.port";

/** The gateways this deployment is configured for (ADR 020), by name. */
export interface PaymentProvidersPort {
	/** The gateway's adapter, or null when this deployment isn't configured for it. */
	get(name: PaymentProviderName): PaymentProviderPort | null;
	/** The names of the gateways this deployment is configured for, in `PaymentProviderNameSchema` order. */
	configured(): readonly PaymentProviderName[];
}
