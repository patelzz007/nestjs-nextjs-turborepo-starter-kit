// The payments context's public surface (ADR 020): its module, and the event other contexts may react to
// (outgoing webhooks, ADR 082).
export { PaymentsModule } from "./payments.module";
export { PaymentStatusChanged, type SettledPaymentStatus } from "./domain/events/payment.events";
