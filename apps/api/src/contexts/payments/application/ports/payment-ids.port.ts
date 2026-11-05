/** New payment and event ids (UUID v7), chosen before insert so events can reference their payment. */
export interface PaymentIdsPort {
	next(): string;
}
