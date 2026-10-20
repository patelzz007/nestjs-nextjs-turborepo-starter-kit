import {
	DEFAULT_MERCHANT_API_KEY_SCOPE,
	MerchantCreateApiKeySchema,
	MerchantErrorCodes,
	TenantApiKeyScopeSchema,
	type MerchantCreateApiKeyInput,
	type TenantApiKeyScope,
} from "@workspace/shared";
import { z } from "zod";

import type { FieldErrorMap } from "@/lib/forms/api-field-errors";

/**
 * The store a new API key is limited to is an explicit, validated form field —
 * never the page's location filter (under "All locations" that filter is
 * absent, which would silently create a tenant-wide key).
 */

/** Select value of the tenant-wide choice (store ids are UUIDs, so it can never collide). */
export const TENANT_WIDE_STORE_CHOICE = "tenant";

/** A store the member may create a key for. */
export interface ApiKeyStoreOption {
	readonly id: string;
	readonly name: string;
}

/** What the member may choose: their own stores, plus tenant-wide only for an all-locations membership. */
export interface ApiKeyStoreChoices {
	readonly stores: readonly ApiKeyStoreOption[];
	readonly allowTenantWide: boolean;
}

/** The raw form values (the store select's value is `""` until the member picks). */
export interface CreateApiKeyFormValues {
	readonly name: string;
	readonly storeChoice: string;
	/** The select's value — parsed with the shared scope schema. */
	readonly scope: string;
}

/** The fields of the create form a failure can be shown on. */
export type CreateApiKeyField = "name" | "store" | "scope";

/** The API's refusals that belong to one field of the form. */
export const CREATE_API_KEY_FIELD_ERRORS: FieldErrorMap<CreateApiKeyField> = {
	[MerchantErrorCodes.API_KEY_LOCATION_REQUIRED]: {
		field: "store",
		message: "Choose one of your stores — only members with access to every store can create a tenant-wide key.",
	},
};

/** A new key gets the least privilege unless the merchant chooses otherwise. */
export const DEFAULT_API_KEY_SCOPE_CHOICE: TenantApiKeyScope = DEFAULT_MERCHANT_API_KEY_SCOPE;

/** What each scope lets a key do, in the order the form offers them. */
export const API_KEY_SCOPE_OPTIONS: readonly { readonly scope: TenantApiKeyScope; readonly label: string; readonly description: string }[] = [
	{ scope: TenantApiKeyScopeSchema.enum.POS, label: "POS terminal", description: "Only validates and confirms redemptions at the till." },
	{
		scope: TenantApiKeyScopeSchema.enum.INTEGRATION,
		label: "Integration",
		description: "Also reads rewards, redemption history and analytics — for back-office systems.",
	},
];

/** Display label of a key's scope (the list shows it next to each key). */
export function apiKeyScopeLabel(scope: TenantApiKeyScope): string {
	return API_KEY_SCOPE_OPTIONS.find((option) => option.scope === scope)?.label ?? scope;
}

/** The key name is required in the form (the shared create schema's rule, made mandatory). */
const ApiKeyNameSchema = MerchantCreateApiKeySchema.shape.name.unwrap();

/** The choice preselected for a new key: the store in view, or the member's only store; otherwise the member must pick. */
export function defaultApiKeyStoreChoice(choices: ApiKeyStoreChoices, activeStoreId: string | undefined): string {
	if (activeStoreId !== undefined && choices.stores.some((store) => store.id === activeStoreId)) {
		return activeStoreId;
	}
	const onlyStore = choices.stores.length === 1 && !choices.allowTenantWide ? choices.stores.at(0) : undefined;
	return onlyStore?.id ?? "";
}

/**
 * The create input for the form values, validated with the shared create
 * schema, or `undefined` while the form is incomplete or names a store the
 * member may not use. (The API enforces the same scope rule on its own.)
 */
export function parseCreateApiKeyForm(values: CreateApiKeyFormValues, choices: ApiKeyStoreChoices): MerchantCreateApiKeyInput | undefined {
	const name = ApiKeyNameSchema.safeParse(values.name);
	const scope = TenantApiKeyScopeSchema.safeParse(values.scope);
	if (!name.success || !scope.success) {
		return undefined;
	}
	if (values.storeChoice === TENANT_WIDE_STORE_CHOICE) {
		return choices.allowTenantWide ? MerchantCreateApiKeySchema.parse({ name: name.data, scope: scope.data }) : undefined;
	}
	const locationId = z.uuid().safeParse(values.storeChoice);
	if (!locationId.success || !choices.stores.some((store) => store.id === locationId.data)) {
		return undefined;
	}
	return MerchantCreateApiKeySchema.parse({ name: name.data, locationId: locationId.data, scope: scope.data });
}
