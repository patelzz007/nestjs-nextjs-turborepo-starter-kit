import { MerchantCreateTerminalSchema, MerchantErrorCodes, type MerchantCreateTerminalInput } from "@workspace/shared";

import type { FieldErrorMap } from "@/lib/forms/api-field-errors";

/** The raw "Add terminal" form values — `terminalId` is optional (blank = the API generates one). */
export interface CreateTerminalFormValues {
	readonly name: string;
	readonly storeId: string;
	readonly terminalId: string;
}

/** The fields of the "Add terminal" form a failure can be shown on. */
export type CreateTerminalField = "name" | "store" | "terminalId";

/** The API's refusals that belong to one field of the form. */
export const CREATE_TERMINAL_FIELD_ERRORS: FieldErrorMap<CreateTerminalField> = {
	[MerchantErrorCodes.TERMINAL_ID_TAKEN]: { field: "terminalId", message: "Another terminal already uses this terminal ID — choose a different one." },
	[MerchantErrorCodes.ORGANIZATION_LOCATION_FORBIDDEN]: { field: "store", message: "You can't register a till at this store." },
};

/**
 * The create input for the form values, parsed by the shared create schema
 * (the API validates with the same one), or `undefined` while incomplete. A
 * blank terminal id is omitted, so the API generates a `TERM-…` id.
 */
export function parseCreateTerminalForm(values: CreateTerminalFormValues): MerchantCreateTerminalInput | undefined {
	const terminalId = values.terminalId.trim();
	const parsed = MerchantCreateTerminalSchema.safeParse({ name: values.name, locationId: values.storeId, ...(terminalId.length === 0 ? {} : { terminalId }) });
	return parsed.success ? parsed.data : undefined;
}
