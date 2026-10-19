import { NotFoundError } from "../../../platform/application/errors/app-error";
import type { SystemOperationName } from "../../../platform/application/system-operation-names";

/** Read the bypass-only `AuditLog` table for the admin audit viewer (system-operation.registry.ts). */
export const AUDIT_READ_OPERATION: SystemOperationName = "audit.http_request.read";

/** Read the bypass-only `DataChangeLog` table for the admin data-change viewer. */
export const DATA_CHANGE_READ_OPERATION: SystemOperationName = "audit.data_change.read";

/** Read both audit stores as one timeline for the admin audit log. */
export const AUDIT_TRAIL_READ_OPERATION: SystemOperationName = "audit.trail.read";

/** Same client message and details the old `ResourceNotFoundError` answered with for an unknown record id. */
export function missingAuditRecord(id: string): NotFoundError {
	return new NotFoundError({ message: "The requested resource was not found.", details: { resourceId: id } });
}
