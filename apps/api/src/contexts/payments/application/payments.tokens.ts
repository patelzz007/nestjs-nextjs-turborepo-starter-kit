import type { SystemOperationName } from "../../../platform/application/system-operation-names";

export const PAYMENTS_UNIT_OF_WORK = Symbol("PAYMENTS_UNIT_OF_WORK");
/** `PaymentProvidersPort`: the configured gateways. */
export const PAYMENT_PROVIDERS = Symbol("PAYMENT_PROVIDERS");

export const PAYMENT_CREATE_OPERATION: SystemOperationName = "payments.intent.create";
export const PAYMENT_CALLBACK_OPERATION: SystemOperationName = "payments.callback.apply";
export const PAYMENT_RECONCILE_OPERATION: SystemOperationName = "payments.reconcile";
export const PAYMENT_REFUND_OPERATION: SystemOperationName = "payments.refund";
/** `PaymentsService`. */
export const PAYMENTS_SERVICE = Symbol("PAYMENTS_SERVICE");
/** `PaymentIdsPort`. */
export const PAYMENT_IDS = Symbol("PAYMENT_IDS");
/** `PaymentCallbackVerifiersPort`: each configured gateway's callback signature check (ADR 081). */
export const PAYMENT_CALLBACK_VERIFIERS = Symbol("PAYMENT_CALLBACK_VERIFIERS");
/** `PaymentCallbackReception`: a gateway callback through the shared inbound-webhook path (ADR 081). */
export const PAYMENT_CALLBACK_RECEPTION = Symbol("PAYMENT_CALLBACK_RECEPTION");
