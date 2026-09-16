import { Body, Controller, Headers, Post, Req, UseInterceptors } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	OrganizationTeamInviteRegisterAcceptSchema,
	OrganizationTeamInviteTokenSchema,
	type LoginRestrictedEnrollmentResponse,
	type LoginServiceResponse,
	type LoginTwoFactorPendingResponse,
	type LoginVerificationPendingResponse,
	type OrganizationTeamInviteAcceptResponse,
	type OrganizationTeamInvitePreview,
	type OrganizationTeamInviteRegisterAcceptInput,
	type OrganizationTeamInviteTokenInput,
} from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { extractClientInfo } from "../../../common/utils/client-info";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { AuthService } from "../../auth/auth.service";
import { GetUser } from "../../auth/decorators/get-user.decorator";
import { Public } from "../../auth/decorators/public.decorator";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import { SetAuthCookiesInterceptor } from "../../auth/interceptors/set-auth-cookies.interceptor";
import type { AccessTokenPayload } from "../../auth/services/token.service";
import { KernelIntegrationHelper } from "../../authorization/kernel/kernel-integration.helper";
import { OrganizationMembershipService } from "../services/organization-membership.service";

@ApiTags("Organizations")
@Controller(apiPath("/orgs/invites"))
export class OrganizationTeamInviteController {
	public constructor(
		private readonly membership: OrganizationMembershipService,
		private readonly authService: AuthService,
		private readonly kernelHelper: KernelIntegrationHelper,
	) {}

	@Public()
	@RlsBypass()
	@Post("validate")
	@ApiOkResponse({ description: "Team invite preview when the token is valid" })
	public async validateTeamInvite(
		@Body(new ZodValidationPipe(OrganizationTeamInviteTokenSchema)) body: OrganizationTeamInviteTokenInput,
	): Promise<OrganizationTeamInvitePreview> {
		return this.membership.validateTeamInvite(body.token);
	}

	@Post("accept")
	@ApiOkResponse({ description: "Team invite accepted and membership created" })
	public async acceptTeamInvite(
		@GetUser() user: AccessTokenPayload,
		@Body(new ZodValidationPipe(OrganizationTeamInviteTokenSchema)) body: OrganizationTeamInviteTokenInput,
	): Promise<OrganizationTeamInviteAcceptResponse> {
		await this.kernelHelper.requireAction(user.sub, "CREATE", "ORGANIZATION");
		
		return this.membership.acceptTeamInvite(user.sub, user.email, body.token);
	}

	@Public()
	@RlsBypass()
	@UseInterceptors(SetAuthCookiesInterceptor)
	@Post("register-and-accept")
	@ApiOkResponse({ description: "Create a staff account from a team invite and sign in" })
	public async registerAndAcceptTeamInvite(
		@Body(new ZodValidationPipe(OrganizationTeamInviteRegisterAcceptSchema)) body: OrganizationTeamInviteRegisterAcceptInput,
		@Headers("x-client-type") headerClientType: string | undefined,
		@Req() req: FastifyRequest,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginTwoFactorPendingResponse | LoginVerificationPendingResponse> {
		const accepted = await this.membership.registerAndAcceptTeamInvite(body);
		const clientType = headerClientType ?? "merchant";
		const { deviceInfo, ipAddress } = extractClientInfo(req);
		return this.authService.login({ email: accepted.email, password: body.password }, clientType, deviceInfo, ipAddress);
	}
}
