import type { JsonValue } from "@workspace/shared";

/** Writes the current request's HTTP audit row inside the unit of work, so it commits or rolls back with the change. */
export interface RequestAuditPort {
	recordSuccess(responseBody: JsonValue): Promise<void>;
}
