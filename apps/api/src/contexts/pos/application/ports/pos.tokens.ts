import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** The pos unit of work (`UnitOfWork<PosScope>`). */
export const POS_UNIT_OF_WORK = Symbol("POS_UNIT_OF_WORK");

/** {@link PosIdGenerator}. */
export const POS_ID_GENERATOR = Symbol("POS_ID_GENERATOR");

/** {@link CheckoutFingerprintPort}. */
export const CHECKOUT_FINGERPRINT = Symbol("CHECKOUT_FINGERPRINT");

/** {@link PosCredentialsPort}. */
export const POS_CREDENTIALS = Symbol("POS_CREDENTIALS");

/** {@link TillTerminalsPort}. */
export const TILL_TERMINALS = Symbol("TILL_TERMINALS");

/** {@link TerminalReadPort}. */
export const TERMINAL_READS = Symbol("TERMINAL_READS");

/** {@link ApiKeyReadPort}. */
export const API_KEY_READS = Symbol("API_KEY_READS");

/** {@link RedemptionReadPort}. */
export const REDEMPTION_READS = Symbol("REDEMPTION_READS");

/** The operation the till's pairing runs under: no key exists yet, so the one-time code is the authorization. */
export const TERMINAL_PAIRING_OPERATION: SystemOperationName = "pos.terminal.pair";

/** Generates ids for new sales, terminals and keys (chosen before insert so events and responses can name them). */
export interface PosIdGenerator {
	next(): string;
}

/** The `auth.api_key.lookup` system operation, named once for every route and adapter that runs under it. */
export const AUTH_API_KEY_LOOKUP_OPERATION: SystemOperationName = "auth.api_key.lookup";
