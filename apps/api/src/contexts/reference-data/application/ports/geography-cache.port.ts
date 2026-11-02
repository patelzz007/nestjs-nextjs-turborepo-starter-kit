/** Drops cached geography after a write commits (ADR 072). */
export interface GeographyCachePort {
	invalidateAll(): Promise<void>;
}
