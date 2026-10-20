// API contract leaves owned by the `audit` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { auditLogsRoutes, auditTrailRoutes, dataChangesRoutes } from "./routes";
import { AuditTrailEntrySchema, AuditTrailListQuerySchema } from "./schemas/audit-trail";
import { DataChangeLogDetailSchema, DataChangeLogIdParamSchema, DataChangeLogListQuerySchema, DataChangeLogSummarySchema } from "./schemas/data-change-log";
import { HttpAuditLogDetailSchema, HttpAuditLogIdParamSchema, HttpAuditLogListQuerySchema, HttpAuditLogSummarySchema } from "./schemas/http-audit-log";

// ── Global HTTP audit trail ─────────────────────────────────────────
// Read-only admin viewer over `audit_logs` (ADR 025). Every read is
// itself recorded as a sensitive read.

/** Contract leaves composed into `apiContract.auditLogs`. */
export const auditLogsContract = {
	list: defineContract({ method: "GET", path: auditLogsRoutes.list, input: HttpAuditLogListQuerySchema, response: paginatedResponse(HttpAuditLogSummarySchema) }),
	detail: defineContract({ method: "GET", path: auditLogsRoutes.detail, input: HttpAuditLogIdParamSchema, response: singleResponse(HttpAuditLogDetailSchema) }),
};

// ── The audit log's timeline ────────────────────────────────────────
// HTTP requests (with the rows each changed) and database writes no
// request made, as one list (ADR 051). Every read is itself recorded.

/** Contract leaves composed into `apiContract.auditTrail`. */
export const auditTrailContract = {
	list: defineContract({ method: "GET", path: auditTrailRoutes.list, input: AuditTrailListQuerySchema, response: paginatedResponse(AuditTrailEntrySchema) }),
};

// ── Row-level data-change trail ─────────────────────────────────────
// Read-only admin viewer over `data_change_logs` (ADR 051): every row
// INSERT / UPDATE / DELETE / TRUNCATE with redacted before / after images.
// Every read is itself recorded as a sensitive read.

/** Contract leaves composed into `apiContract.dataChanges`. */
export const dataChangesContract = {
	list: defineContract({ method: "GET", path: dataChangesRoutes.list, input: DataChangeLogListQuerySchema, response: paginatedResponse(DataChangeLogSummarySchema) }),
	detail: defineContract({ method: "GET", path: dataChangesRoutes.detail, input: DataChangeLogIdParamSchema, response: singleResponse(DataChangeLogDetailSchema) }),
};
