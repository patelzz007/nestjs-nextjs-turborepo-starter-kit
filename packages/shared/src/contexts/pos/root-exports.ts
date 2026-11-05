// What the root `@workspace/shared` barrel exposes of the `pos` context (enhancement 8.2): a curated subset of
// this context's index. Its own contract object and route map stay behind the aggregated `apiContract` /
// `apiRoutes`, and its building-block schemas stay internal. Add a name here to make it part of the package's
// public surface (the export snapshot in src/contracts/__tests__/api-contract-shape.test.ts records it).

export {
	AdminApiKeySchema,
	API_KEY_RATE_LIMIT_TIERS,
	API_KEY_SCOPES,
	ApiKeyMessageResponseSchema,
	ApiKeyQuerySchema,
	CreateApiKeySchema,
	SafeApiKeySchema,
	UpdateApiKeySchema,
	UsageLogEntrySchema,
	UsageLogQuerySchema,
	UsageStatsResponseSchema,
	VerifiedApiKeySchema,
} from "./schemas/api-keys";
export type {
	AdminApiKey,
	ApiKeyMessageResponse,
	ApiKeyQueryInput,
	CreateApiKeyInput,
	SafeApiKey,
	UpdateApiKeyInput,
	UsageLogEntry,
	UsageLogQueryInput,
	UsageStatsResponse,
	VerifiedApiKey,
} from "./schemas/api-keys";
export {
	MerchantApiKeyCreatedSchema,
	MerchantApiKeyListQuerySchema,
	merchantApiKeyListQuery,
	MERCHANT_API_KEYS_PAGE_SIZE,
	MerchantApiKeySummarySchema,
	MerchantCreateApiKeySchema,
	TenantApiKeyScopeSchema,
	DEFAULT_MERCHANT_API_KEY_SCOPE,
	MERCHANT_API_KEY_NAME_MAX_LENGTH,
} from "./schemas/merchant-api-keys";
export {
	MERCHANT_TERMINALS_PAGE_SIZE,
	MerchantCreateTerminalSchema,
	MerchantTerminalListQuerySchema,
	MerchantTerminalPairingSchema,
	MerchantTerminalSettingsSchema,
	MerchantTerminalSettingsResponseSchema,
	MerchantTerminalSummarySchema,
	MerchantTerminalStatusSummaryQuerySchema,
	MerchantTerminalStatusCountsSchema,
	MerchantTerminalStatusSummarySchema,
	merchantTerminalListQuery,
	POS_PAIRING_CODE_TTL_MS,
	POS_TERMINAL_NAME_MAX_LENGTH,
	PosPairedTerminalSchema,
	PosPairingCodeSchema,
	PosPairTerminalSchema,
	PosTerminalStatusSchema,
} from "./schemas/terminals";
export { PosPairingQrPayloadSchema, POS_PAIRING_QR_PREFIX, buildPosPairingQrPayload } from "./schemas/pos-pairing-qr";
export {
	MerchantRedemptionListItemSchema,
	MerchantRedemptionListQuerySchema,
	merchantRedemptionListQuery,
	DEFAULT_SALE_CURRENCY,
	SALE_CURRENCY_MINOR_UNIT_EXPONENTS,
	MAX_BILL_TOTAL_MINOR,
	MAX_CHECKOUT_REWARDS,
	MINOR_UNITS_PER_MAJOR,
	POS_TERMINAL_ID_MAX_LENGTH,
	PosTerminalIdSchema,
	RedemptionCheckoutItemSchema,
	RedemptionCheckoutResponseSchema,
	RedemptionCheckoutSchema,
	RedemptionCodeSchema,
	RedemptionInvalidReasonSchema,
	RedemptionOfferSchema,
	RedemptionPreviewResponseSchema,
	RedemptionValidateSchema,
	SaleCurrencySchema,
} from "./schemas/redemption";
export { RewardRedemptionMethodSchema, RewardTerminalIdHeaderSchema } from "./schemas/pos-enums";
export type {
	MerchantApiKeyCreated,
	MerchantApiKeyListQuery,
	MerchantApiKeyListSortField,
	MerchantApiKeySummary,
	MerchantCreateApiKeyInput,
	TenantApiKeyScope,
} from "./schemas/merchant-api-keys";
export type {
	MerchantCreateTerminalInput,
	MerchantTerminalListQuery,
	MerchantTerminalListSortField,
	MerchantTerminalPairing,
	MerchantTerminalSettings,
	MerchantTerminalSummary,
	MerchantTerminalStatusSummaryQuery,
	MerchantTerminalStatusCounts,
	MerchantTerminalStatusSummary,
	PosPairedTerminal,
	PosPairingCode,
	PosPairTerminalInput,
	PosTerminalStatus,
} from "./schemas/terminals";
export type {
	PosTerminalId,
	MerchantRedemptionListItem,
	MerchantRedemptionListQuery,
	MerchantRedemptionListSortField,
	RedemptionCheckoutInput,
	RedemptionCheckoutItem,
	RedemptionCheckoutResponse,
	RedemptionCode,
	RedemptionInvalidReason,
	RedemptionOffer,
	RedemptionPreviewResponse,
	SaleCurrency,
	RedemptionValidateInput,
} from "./schemas/redemption";
export type { RewardRedemptionMethod } from "./schemas/pos-enums";
