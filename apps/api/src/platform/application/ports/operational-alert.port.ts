/** Something an operator must look at, although the work it came from completed. */
export interface OperationalAlert {
	/** Stable event name, e.g. `system_command.audit_write_failed`. */
	readonly event: string;
	readonly message: string;
	/** Log-safe identifiers only (ids, names, error codes). Never secrets or personal data. */
	readonly facts: Readonly<Record<string, string | number | boolean | null>>;
}

/** Raises an alert-level operational event. Never throws: an alert must not fail the work that raised it. */
export interface OperationalAlertPort {
	raise(alert: OperationalAlert): void;
}

export const OPERATIONAL_ALERTS = Symbol("OPERATIONAL_ALERTS");
