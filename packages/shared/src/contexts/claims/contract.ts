// API contract leaves owned by the `claims` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { UuidParamSchema } from "../../schemas/domain/platform/param-schemas";
import {
	CreateRewardClaimSchema,
	RequestClaimOtpResponseSchema,
	RequestClaimOtpSchema,
	RewardClaimCreatedResponseSchema,
	RewardClaimListQuerySchema,
	RewardClaimQrResponseSchema,
	RewardClaimResponseSchema,
} from "./schemas/claim";
import { claimsRoutes } from "./routes";

/** Contract leaves composed into `apiContract.claims`. */
export const claimsContract = {
	otp: defineContract({ method: "POST", path: claimsRoutes.otp, input: RequestClaimOtpSchema, response: singleResponse(RequestClaimOtpResponseSchema) }),
	create: defineContract({ method: "POST", path: claimsRoutes.create, input: CreateRewardClaimSchema, response: singleResponse(RewardClaimCreatedResponseSchema) }),
	list: defineContract({ method: "GET", path: claimsRoutes.list, input: RewardClaimListQuerySchema, response: paginatedResponse(RewardClaimResponseSchema) }),
	/** One of the caller's own claims (read model for the server-rendered wallet QR page; never carries codes). */
	get: defineContract({
		method: "GET",
		path: claimsRoutes.detail,
		input: z.object({ claimId: UuidParamSchema }).strict(),
		response: singleResponse(RewardClaimResponseSchema),
	}),
	/** Issues fresh QR + backup codes for a PENDING claim (a command: it rotates the stored code hashes). */
	qr: defineContract({
		method: "POST",
		path: claimsRoutes.qr,
		input: z.object({ claimId: UuidParamSchema }).strict(),
		response: singleResponse(RewardClaimQrResponseSchema),
	}),
};
