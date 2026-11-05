export {
	ApiErrorBodySchema,
	ApiErrorCodes,
	ApiErrorCodeSchema,
	ApiErrorDetailsSchema,
	ApiErrorObjectSchema,
	ApiErrorResponseSchema,
	ApiValidationIssueSchema,
	StandardApiErrorCodeSchema,
} from "./api/api-error";
export type { ApiErrorBody, ApiErrorCode, ApiErrorDetails, ApiErrorObject, ApiErrorResponse, ApiValidationIssue, StandardApiErrorCode } from "./api/api-error";
export {
	ApiPaginatedMetaSchema,
	ApiResponseMetaSchema,
	ApiSuccessResponseSchema,
	createApiPaginatedEnvelopeSchema,
	createApiSuccessEnvelopeSchema,
	createPaginatedServiceResultSchema,
	DeleteSuccessDataSchema,
	PaginatedServiceFieldsSchema,
	PaginatedServiceResultSchema,
} from "./api/api-response";
export type { ApiPaginatedMeta, ApiResponseMeta, ApiSuccessResponse, DeleteSuccessData, Envelope, PaginatedServiceResult } from "./api/api-response";
export { BULK_MUTATION_MAX_ITEMS, BulkDeleteIdsSchema, BulkDeleteResultSchema } from "./api/bulk-mutation";
export type { BulkDeleteIdsInput, BulkDeleteResult } from "./api/bulk-mutation";
export { BaseResponseSchema, EpochMsSchema, epochMs, nowEpochMs, DataValueSchema } from "./api/common";
export type { BaseResponse, EpochMs, DataPrimitive, DataValue } from "./api/common";
export { CanonicalEmailSchema, canonicalEmailSchema, EMAIL_ADDRESS_MAX_LENGTH } from "./api/email-address";
export type { CanonicalEmail } from "./api/email-address";
export { ApiVersionManifestSchema } from "./api/version";
export { APP_VERSION_MAX_LENGTH, AppVersionSchema, compareAppVersions } from "./api/app-version";
export type { AppVersion, AppVersionOrder } from "./api/app-version";
export type { ApiVersionManifest } from "./api/version";
export { EmailTemplateKeyParamSchema, UuidParamSchema, VerifyEmailTokenParamSchema } from "./domain/platform/param-schemas";
export type { EmailTemplateKeyParam, UuidParam, VerifyEmailTokenParam } from "./domain/platform/param-schemas";
export {
	DeepHealthResponseSchema,
	HealthProbeStatusSchema,
	HealthResponseSchema,
	LivenessResponseSchema,
	ModuleHealthDetailValueSchema,
	ModuleHealthSchema,
	PingResponseSchema,
	ReadinessCheckSchema,
	ReadinessResponseSchema,
} from "./api/health.schema";
export type {
	DeepHealthResponse,
	HealthProbeStatus,
	HealthResponse,
	LivenessResponse,
	ModuleHealth,
	ModuleHealthDetailValue,
	PingResponse,
	ReadinessCheck,
	ReadinessResponse,
} from "./api/health.schema";
export { LogLevelSchema, LogServiceOptionsSchema, MetadataValueSchema } from "./domain/platform/logs";
export type { LogLevel, LogServiceOptions } from "./domain/platform/logs";
export { ErrorResponseSchema, MessageResponseSchema, OkResponseSchema, SuccessAckResponseSchema } from "./api/message";
export type { ErrorResponse, MessageResponse, OkResponse, SuccessAckResponse } from "./api/message";
export { PaginationSchema } from "./api/pagination";
export type { PaginationInput } from "./api/pagination";
export { BooleanQueryParamSchema } from "./api/query-params";
export {
	defineListQuery,
	FilterBooleanValueSchema,
	FilterEpochMsValueSchema,
	FilterNumberValueSchema,
	FilterTextValueSchema,
	FilterUuidValueSchema,
	flattenQueryParams,
	formatSortParam,
	InvalidListSortError,
	LIST_DEFAULT_LIMIT,
	LIST_FIRST_PAGE,
	LIST_FILTER_OPERATORS,
	LIST_MAX_CURSOR_LENGTH,
	LIST_MAX_FILTER_PARAMS,
	LIST_MAX_FILTER_TEXT_LENGTH,
	LIST_MAX_FILTER_VALUES,
	LIST_MAX_LIMIT,
	LIST_MAX_PAGE,
	LIST_MAX_SEARCH_LENGTH,
	LIST_MAX_SORT_LENGTH,
	LIST_MAX_SORT_TERMS,
	LIST_VALUE_SEPARATOR,
	listFilter,
	listFilterKey,
	ListSearchSchema,
	nestBracketQueryParams,
	parseSortParam,
	SORT_DESCENDING_PREFIX,
} from "./api/list-query";
export type {
	BooleanFilterValues,
	ComparableFilterValues,
	ComparisonOperator,
	EqualityFilterValues,
	FilterValueListSchema,
	ListFilterFieldSchema,
	ListFilterOperator,
	ListQueryDefinition,
	ListQueryOptions,
	ListQuerySchema,
	NestBracketQueryResult,
	NullOperator,
	RawQueryRecord,
	ResolvedSort,
	SetOperator,
	SortDirection,
	SortParseResult,
	SortTerm,
	StringFilterValues,
	TextOperator,
} from "./api/list-query";
export type { BooleanQueryParam } from "./api/query-params";
export { CaughtValueSchema, ResendLikeErrorSchema } from "./runtime/caught-error";
export type { CaughtValue, ResendLikeError } from "./runtime/caught-error";
export {
	FastifyQuerySchema,
	ForwardedForHeaderSchema,
	HeadersRecordSchema,
	HttpHeaderValueSchema,
	OptionalStringHeaderSchema,
	ReplyHeaderValueSchema,
	RequestLikeSchema,
	RouteParamsSchema,
} from "./runtime/http-headers";
export type {
	FastifyQuery,
	ForwardedForHeader,
	HeadersRecord,
	HttpHeaderValue,
	OptionalStringHeader,
	ReplyHeaderValue,
	RequestLike,
	RouteParams,
} from "./runtime/http-headers";
export { JsonObjectSchema, JsonPrimitiveSchema, JsonRecordSchema, JsonValueSchema } from "./runtime/json";
export type { JsonObject, JsonObjectNode, JsonPrimitive, JsonValue, JsonValueInput, JsonValueNode } from "./runtime/json";
export { PrismaQueryEventSchema, PrismaQuerySubscriberSchema } from "./runtime/prisma-query";
export type { PrismaQueryEvent } from "./runtime/prisma-query";
export { NonEmptyStringSchema, StringRecordNullableSchema, StringRecordSchema, StringValueSchema, ThrownErrorSchema } from "./runtime/primitives";
export type { NonEmptyString, StringRecord, StringRecordNullable, StringValue, ThrownError } from "./runtime/primitives";
export { SystemOperationContextSchema, TenantJobContextSchema } from "./infrastructure/tenant-job-context";
export type { SystemOperationContext, TenantJobContext } from "./infrastructure/tenant-job-context";
export {
	KAFKA_TOPICS,
	KafkaTopicSchema,
	PLATFORM_EVENT_TOPICS,
	PlatformEventEnvelopeSchema,
	PlatformEventIdSchema,
	PlatformEventInputSchema,
	PlatformEventMessageSchema,
	PlatformEventTenantIdSchema,
	readPlatformEventTenantId,
} from "./infrastructure/kafka";
export type {
	KafkaTopic,
	PlatformEventEnvelope,
	PlatformEventId,
	PlatformEventInput,
	PlatformEventMessage,
	PlatformEventTenantId,
	PlatformEventPayload,
	PlatformEventType,
} from "./infrastructure/kafka";
export {
	EmailJobPropValueSchema,
	EmailSendJobSchema,
	ALL_QUEUE_NAMES,
	QUEUE_NAMES,
	QueueNameSchema,
	RewardsMaintenanceJobSchema,
	StorageCdnInvalidationJobSchema,
	StorageCleanupJobSchema,
	StorageDeleteJobSchema,
	StorageScanJobSchema,
	TransactionLogWriteJobSchema,
} from "./infrastructure/queue";
export type {
	EmailJobPropValue,
	EmailSendJob,
	QueueName,
	RewardsMaintenanceJob,
	StorageCdnInvalidationJob,
	StorageCleanupJob,
	StorageDeleteJob,
	StorageScanJob,
	TransactionLogWriteJob,
} from "./infrastructure/queue";
export { QUEUE_JOB_OPTIONS } from "./infrastructure/queue-job-options";
export {
	NOTIFICATION_EMAIL_OUTBOX_TOPIC,
	NOTIFICATION_EMAIL_REQUESTED_EVENT_TYPE,
	NotificationEmailRequestedEnvelopeSchema,
	NotificationEmailRequestedPayloadSchema,
	OutboxEnqueueInputSchema,
	OutboxEventRecordSchema,
	OutboxEventStatusSchema,
	OUTBOX_EVENT_STATUSES,
} from "./infrastructure/outbox";
export type { NotificationEmailRequestedEnvelope, NotificationEmailRequestedPayload, OutboxEnqueueInput, OutboxEventRecord, OutboxEventStatus } from "./infrastructure/outbox";

// Each bounded context's own share of this barrel (8.2): the context keeps its list (contexts/<ctx>/root-exports.ts).
export * from "../contexts/audit/root-exports";
export * from "../contexts/authorization/root-exports";
export * from "../contexts/catalog/root-exports";
export * from "../contexts/claims/root-exports";
export * from "../contexts/files/root-exports";
export * from "../contexts/identity/root-exports";
export * from "../contexts/integrations-github/root-exports";
export * from "../contexts/kanban/root-exports";
export * from "../contexts/notifications/root-exports";
export * from "../contexts/operations/root-exports";
export * from "../contexts/pos/root-exports";
export * from "../contexts/reference-data/root-exports";
export * from "../contexts/referrals/root-exports";
export * from "../contexts/reporting/root-exports";
export * from "../contexts/rewards/root-exports";
export * from "../contexts/tenancy/root-exports";
export * from "../contexts/webhooks/root-exports";
