/** Whether tiers are on for this deployment (the `customer-tiers` flag, ADR 085). */
export interface TiersAvailabilityPort {
	isOn(): Promise<boolean>;
}
