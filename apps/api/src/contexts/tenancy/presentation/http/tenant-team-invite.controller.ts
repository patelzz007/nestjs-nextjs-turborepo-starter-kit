import { Controller, Headers, HttpStatus, Post, Req, UseInterceptors } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	LoginClientResponseSchema,
	TenantTeamInviteAcceptResponseSchema,
	TenantTeamInvitePreviewSchema,
	TenantTeamInviteRegisterAcceptSchema,
	TenantTeamInviteTokenSchema,
	type LoginRestrictedEnrollmentResponse,
	type LoginServiceResponse,
	type AccessTokenPayload,
	type LoginVerificationPendingResponse,
	type TenantTeamInviteAcceptResponse,
	type TenantTeamInvitePreview,
	type TenantTeamInviteRegisterAcceptInput,
	type TenantTeamInviteTokenInput,
} from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { GetUser } from "../../../../platform/presentation/http/security/decorators/get-user.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { SetAuthCookiesInterceptor } from "../../../../platform/presentation/http/security/interceptors/set-auth-cookies.interceptor";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { readSessionDeviceContext } from "../../../../platform/presentation/http/security/session-device-context";
import { AcceptTeamInviteCommand } from "../../application/commands/accept-team-invite/accept-team-invite.command";
import { RegisterAndAcceptTeamInviteCommand } from "../../application/commands/register-and-accept-team-invite/register-and-accept-team-invite.command";
import { PreviewTeamInviteQuery } from "../../application/queries/preview-team-invite/preview-team-invite.query";
import { TENANT_INVITATION_REGISTER_AND_ACCEPT_OPERATION, TENANT_INVITATION_RESOLVE_TOKEN_OPERATION } from "../../application/ports/tenants.tokens";

/** Who the registration's sign-in is for when the client did not say (the merchant app sends the invite link). */
const DEFAULT_STAFF_CLIENT_TYPE = "merchant";

@ApiTags("Tenants")
@Controller(apiPath("/tenants/invites"))
export class TenantTeamInviteController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Public()
	@PublicOperation(TENANT_INVITATION_RESOLVE_TOKEN_OPERATION)
	@Post("validate")
	@ZodResponse(TenantTeamInvitePreviewSchema, { status: HttpStatus.CREATED, description: "Team invite preview when the token is valid" })
	public validateTeamInvite(
		@CurrentActor({ allowAnonymous: true }) actor: ActorContext,
		@ZodBody(TenantTeamInviteTokenSchema) body: TenantTeamInviteTokenInput,
	): Promise<TenantTeamInvitePreview> {
		return this.queryBus.execute(new PreviewTeamInviteQuery(actor, body));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Post("accept")
	@ZodResponse(TenantTeamInviteAcceptResponseSchema, { status: HttpStatus.CREATED, description: "Team invite accepted and membership created" })
	public acceptTeamInvite(
		@CurrentActor() actor: ActorContext,
		@GetUser() user: AccessTokenPayload,
		@ZodBody(TenantTeamInviteTokenSchema) body: TenantTeamInviteTokenInput,
	): Promise<TenantTeamInviteAcceptResponse> {
		return this.commandBus.execute(new AcceptTeamInviteCommand(actor, { token: body.token, email: user.email }));
	}

	/**
	 * Creates the account, accepts and signs in as one command: the session is
	 * issued for the identity just created by identity's post-credential step
	 * (login-verification policy applies); the plaintext password is never
	 * replayed through the login path.
	 */
	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@Public()
	@PublicOperation(TENANT_INVITATION_REGISTER_AND_ACCEPT_OPERATION)
	@UseInterceptors(SetAuthCookiesInterceptor)
	@Post("register-and-accept")
	@ZodResponse(LoginClientResponseSchema, { status: HttpStatus.CREATED, description: "Create a staff account from a team invite and sign in" })
	public async registerAndAcceptTeamInvite(
		@CurrentActor({ allowAnonymous: true }) actor: ActorContext,
		@ZodBody(TenantTeamInviteRegisterAcceptSchema) body: TenantTeamInviteRegisterAcceptInput,
		@Headers("x-client-type") headerClientType: string | undefined,
		@Req() req: FastifyRequest,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
		return this.commandBus.execute(
			new RegisterAndAcceptTeamInviteCommand(actor, { body, clientType: headerClientType ?? DEFAULT_STAFF_CLIENT_TYPE, device: readSessionDeviceContext(req) }),
		);
	}
}
