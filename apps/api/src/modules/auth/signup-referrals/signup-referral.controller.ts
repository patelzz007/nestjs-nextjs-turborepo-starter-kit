import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import {
	apiContract,
	apiPath,
	SignupReferralDashboardSchema,
	SignupReferralRefereeItemSchema,
	type PaginatedServiceResult,
	type SignupReferralDashboard,
	type SignupReferralRefereeItem,
	type SignupReferralRefereeListQuery,
} from "@workspace/shared";

import { ZodListQuery } from "../../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { CurrentUser, type AuthenticatedUser } from "../../authorization/decorators/current-user.decorator";
import { SignupReferralService } from "./signup-referral.service";

@ApiTags("Auth")
@ApiBearerAuth()
@Controller(apiPath("/auth/signup-referrals"))
export class SignupReferralController {
	public constructor(private readonly signupReferrals: SignupReferralService) {}

	@Get("/dashboard")
	@ApiOperation({ summary: "Referrer dashboard: current code and shareability" })
	@ZodResponse(SignupReferralDashboardSchema, { description: "Signup referral code state" })
	public async dashboard(@CurrentUser() user: AuthenticatedUser): Promise<SignupReferralDashboard> {
		return this.signupReferrals.getDashboard(user.id);
	}

	@Get("/referees")
	@ApiOperation({ summary: "People who registered with the caller's referral code" })
	@ZodPaginatedResponse(SignupReferralRefereeItemSchema, { description: "Signup referral referees" })
	public async referees(
		@CurrentUser() user: AuthenticatedUser,
		@ZodListQuery(apiContract.auth.signupReferralsReferees.input) query: SignupReferralRefereeListQuery,
	): Promise<PaginatedServiceResult<SignupReferralRefereeItem>> {
		return this.signupReferrals.listReferees(user.id, query);
	}
}
