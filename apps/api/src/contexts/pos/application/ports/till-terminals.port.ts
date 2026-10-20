import type { EpochMs } from "@workspace/shared";

/** A registered till, as a POS request names it (`X-Terminal-Id`). */
export interface RegisteredTill {
	readonly id: string;
	readonly locationId: string;
}

/** The till lookups the POS guard makes before the request's own scope exists (the pre-handler phase). */
export interface TillTerminalsPort {
	/** A live terminal of the tenant by the id the till sends, or null. */
	findLive(tenantId: string, terminalId: string): Promise<RegisteredTill | null>;
	/** Records that a registered till just called the POS API. */
	touchLastSeen(terminalRowId: string, at: EpochMs): Promise<void>;
}
