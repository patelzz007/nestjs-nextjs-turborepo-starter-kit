// API contract leaves owned by the `privacy` context (ADR 077). Composed into `apiContract`
// (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract, defineFileContract, EmptyInputSchema } from "../../contracts/define-contract";
import { fileResponse, singleResponse } from "../../contracts/response";
import { adminPrivacyRoutes, privacyRoutes } from "./routes";
import {
	AccountErasureResponseSchema,
	AccountErasureUserParamsSchema,
	OwnAccountErasureResponseSchema,
	RequestAccountErasureBySupportSchema,
	RequestOwnAccountErasureSchema,
} from "./schemas/account-erasure";
import { PERSONAL_DATA_EXPORT_CONTENT_TYPE } from "./schemas/personal-data";

export const privacyContract = {
	/** "Download my data": one ZIP, at most once a day — fetch it with `fetchDownload`. */
	dataExport: defineFileContract({
		method: "GET",
		path: privacyRoutes.dataExport,
		input: EmptyInputSchema,
		response: fileResponse([PERSONAL_DATA_EXPORT_CONTENT_TYPE]),
	}),
	/** "Delete my account": the open (or latest) request. */
	erasure: defineContract({ method: "GET", path: privacyRoutes.erasure, input: EmptyInputSchema, response: singleResponse(OwnAccountErasureResponseSchema) }),
	/** Ask for the account's erasure, confirmed with the password; carried out after the 30-day grace. */
	requestErasure: defineContract({
		method: "POST",
		path: privacyRoutes.erasure,
		input: RequestOwnAccountErasureSchema,
		response: singleResponse(AccountErasureResponseSchema),
	}),
	/** Change your mind during the grace period. */
	cancelErasure: defineContract({ method: "POST", path: privacyRoutes.cancelErasure, input: EmptyInputSchema, response: singleResponse(AccountErasureResponseSchema) }),
};

/** Support erasing an account on someone's behalf, with a recorded reason (ADR 077, Q13). */
export const adminPrivacyContract = {
	/** The account's open (or latest) erasure request. */
	userErasure: defineContract({
		method: "GET",
		path: adminPrivacyRoutes.userErasure,
		input: AccountErasureUserParamsSchema,
		response: singleResponse(OwnAccountErasureResponseSchema),
	}),
	requestUserErasure: defineContract({
		method: "POST",
		path: adminPrivacyRoutes.userErasure,
		input: z.intersection(AccountErasureUserParamsSchema, RequestAccountErasureBySupportSchema),
		response: singleResponse(AccountErasureResponseSchema),
	}),
	cancelUserErasure: defineContract({
		method: "POST",
		path: adminPrivacyRoutes.cancelUserErasure,
		input: AccountErasureUserParamsSchema,
		response: singleResponse(AccountErasureResponseSchema),
	}),
};
