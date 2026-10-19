import { Controller, Get } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
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

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { ZodListQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { GetMySignupReferralDashboardQuery } from "../../application/queries/get-my-signup-referral-dashboard/get-my-signup-referral-dashboard.query";
import { ListMyRefereesQuery } from "../../application/queries/list-my-referees/list-my-referees.query";

/** The referrer's own signup referrals (ADR 035). The route paths are unchanged from the auth module they came from. */
@ApiTags("Auth")
@ApiBearerAuth()
@Controller(apiPath("/auth/signup-referrals"))
export class SignupReferralController {
	public constructor(private readonly queryBus: QueryBus) {}

	@Get("/dashboard")
	@ApiOperation({ summary: "Referrer dashboard: current code and shareability" })
	@ZodResponse(SignupReferralDashboardSchema, { description: "Signup referral code state" })
	public async dashboard(@CurrentActor() actor: ActorContext): Promise<SignupReferralDashboard> {
		return this.queryBus.execute(new GetMySignupReferralDashboardQuery(actor));
	}

	@Get("/referees")
	@ApiOperation({ summary: "People who registered with the caller's referral code" })
	@ZodPaginatedResponse(SignupReferralRefereeItemSchema, { description: "Signup referral referees" })
	public async referees(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.auth.signupReferralsReferees.input) query: SignupReferralRefereeListQuery,
	): Promise<PaginatedServiceResult<SignupReferralRefereeItem>> {
		return this.queryBus.execute(new ListMyRefereesQuery(actor, query));
	}
}
