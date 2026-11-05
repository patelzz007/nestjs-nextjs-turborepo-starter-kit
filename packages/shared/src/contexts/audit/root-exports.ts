// What the root `@workspace/shared` barrel exposes of the `audit` context (enhancement 8.2): a curated subset of
// this context's index. Its own contract object and route map stay behind the aggregated `apiContract` /
// `apiRoutes`, and its building-block schemas stay internal. Add a name here to make it part of the package's
// public surface (the export snapshot in src/contracts/__tests__/api-contract-shape.test.ts records it).

export { IpAddressScopeSchema } from "./schemas/audit-enums";
export type { IpAddressScope } from "./schemas/audit-enums";
export {
	AUDIT_ERROR_CAUSES_MAX_COUNT,
	AUDIT_ERROR_DETAIL_CODE_MAX_LENGTH,
	AUDIT_ERROR_MESSAGE_MAX_LENGTH,
	AUDIT_ERROR_STACK_FRAME_MAX_LENGTH,
	AUDIT_ERROR_STACK_MAX_FRAMES,
	AUDIT_ERROR_TYPE_MAX_LENGTH,
	AUDIT_REQUEST_HEADER_NAME_MAX_LENGTH,
	AUDIT_REQUEST_HEADER_VALUE_MAX_LENGTH,
	AUDIT_REQUEST_HEADERS_MAX_COUNT,
	AUDIT_TRUNCATION_MARK,
	AuditErrorDetailSchema,
	AuditErrorLinkSchema,
	AuditRequestHeadersSchema,
} from "./schemas/audit-request-facts";
export type { AuditErrorDetail, AuditErrorLink, AuditRequestHeaders } from "./schemas/audit-request-facts";
export {
	AuditAuthMethodSchema,
	AuditHttpMethodSchema,
	AuditLogTenantSchema,
	AuditLogUserSchema,
	AuditOutcomeSchema,
	HttpAuditLogDetailSchema,
	HttpAuditLogIdParamSchema,
	HttpAuditLogListQuerySchema,
	HttpAuditLogSummarySchema,
	httpAuditLogListQuery,
} from "./schemas/http-audit-log";
export type {
	AuditAuthMethod,
	AuditHttpMethod,
	AuditLogTenant,
	AuditLogUser,
	AuditOutcome,
	HttpAuditLogDetail,
	HttpAuditLogIdParam,
	HttpAuditLogListQuery,
	HttpAuditLogListSortField,
	HttpAuditLogSummary,
} from "./schemas/http-audit-log";
export {
	AUDIT_TRAIL_MAX_LISTED_TABLES,
	AuditTrailBackgroundEntrySchema,
	AuditTrailEntryKindSchema,
	AuditTrailEntrySchema,
	AuditTrailListQuerySchema,
	AuditTrailRequestEntrySchema,
	auditTrailListQuery,
} from "./schemas/audit-trail";
export type {
	AuditTrailBackgroundEntry,
	AuditTrailEntry,
	AuditTrailEntryKind,
	AuditTrailListQuery,
	AuditTrailListSortField,
	AuditTrailRequestEntry,
} from "./schemas/audit-trail";
export {
	DataChangeActorKindSchema,
	DataChangeLogDetailSchema,
	DataChangeLogIdParamSchema,
	DataChangeLogListQuerySchema,
	DataChangeLogSummarySchema,
	DataChangeOperationSchema,
	dataChangeLogListQuery,
} from "./schemas/data-change-log";
export type {
	DataChangeActorKind,
	DataChangeLogDetail,
	DataChangeLogIdParam,
	DataChangeLogListQuery,
	DataChangeLogListSortField,
	DataChangeLogSummary,
	DataChangeOperation,
} from "./schemas/data-change-log";
