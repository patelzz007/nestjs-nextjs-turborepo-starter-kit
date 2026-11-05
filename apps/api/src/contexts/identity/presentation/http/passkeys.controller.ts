import { Controller, Delete, Get, Headers, HttpStatus, Patch, Post, Req, UseInterceptors } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type {
	AuthClientTypeQuery,
	CompletePasskeyRegistrationInput,
	LoginPasskeySecondFactorInput,
	LoginPasswordlessPasskeyInput,
	LoginRestrictedEnrollmentResponse,
	LoginServiceResponse,
	LoginVerificationPendingResponse,
	Passkey,
	PasskeyAppAssociations,
	PasskeyAuthenticationOptionsResponse,
	PasskeyList,
	PasskeyMessageResponse,
	PasskeyPath,
	PasskeyRegistrationOptionsResponse,
	PasskeySecondFactorOptionsInput,
	PasswordlessPasskeyOptionsInput,
	RenamePasskeyBody,
	StartPasskeyRegistrationInput,
} from "@workspace/shared";
import {
	apiContract,
	apiPath,
	AuthClientTypeQuerySchema,
	LoginClientResponseSchema,
	PasskeyAppAssociationsSchema,
	PasskeyAuthenticationOptionsResponseSchema,
	PasskeyListSchema,
	PasskeyMessageResponseSchema,
	PasskeyPathSchema,
	PasskeyRegistrationOptionsResponseSchema,
	PasskeySchema,
	RenamePasskeyBodySchema,
} from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { PRINCIPAL_LOOKUP_OPERATION } from "../../../../platform/application/shared-system-operations";
import { ApiErrorResponseDto } from "../../../../platform/presentation/http/dto/api-response.dto";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { GetUser } from "../../../../platform/presentation/http/security/decorators/get-user.decorator";
import { self } from "../../../../platform/presentation/http/security/decorators/permission-target";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { Public } from "../../../../platform/presentation/http/security/decorators/public.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { SetAuthCookiesInterceptor } from "../../../../platform/presentation/http/security/interceptors/set-auth-cookies.interceptor";
import { readSessionDeviceContext } from "../../../../platform/presentation/http/security/session-device-context";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { ZodBody, ZodParams, ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { CompletePasskeyRegistrationCommand } from "../../application/commands/complete-passkey-registration/complete-passkey-registration.command";
import { CompletePasskeySecondFactorCommand } from "../../application/commands/complete-passkey-second-factor/complete-passkey-second-factor.command";
import { CompletePasswordlessPasskeyLoginCommand } from "../../application/commands/complete-passwordless-passkey-login/complete-passwordless-passkey-login.command";
import { RemovePasskeyCommand } from "../../application/commands/remove-passkey/remove-passkey.command";
import { RenamePasskeyCommand } from "../../application/commands/rename-passkey/rename-passkey.command";
import { StartPasskeyRegistrationCommand } from "../../application/commands/start-passkey-registration/start-passkey-registration.command";
import { StartPasskeySecondFactorCommand } from "../../application/commands/start-passkey-second-factor/start-passkey-second-factor.command";
import { StartPasswordlessPasskeyLoginCommand } from "../../application/commands/start-passwordless-passkey-login/start-passwordless-passkey-login.command";
import { GetPasskeyAppAssociationsQuery } from "../../application/queries/get-passkey-app-associations/get-passkey-app-associations.query";
import { ListMyPasskeysQuery } from "../../application/queries/list-my-passkeys/list-my-passkeys.query";
import { TOKEN_DELIVERY_DESCRIPTION } from "./token-delivery.constants";

const PUBLIC_ACTOR = { allowAnonymous: true };

type LoginResult = LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse;

/**
 * Passkeys (WebAuthn, ADR 080): the signed-in user's own passkeys, a passkey as the second step of a
 * password sign-in, and a passwordless sign-in. Every route dispatches one command or query; changes to
 * the user's passkeys are refused during impersonation.
 */
@ApiTags("Auth")
@Controller(apiPath("/auth"))
export class PasskeysController {
	public constructor(
		private readonly commandBus: CommandBus,
		private readonly queryBus: QueryBus,
	) {}

	@Public()
	@Get("/passkeys/app-associations")
	@ApiOperation({
		summary: "The Android and iOS apps allowed to use this site's passkeys: the bodies of the web app's assetlinks.json and apple-app-site-association",
	})
	@ZodResponse(PasskeyAppAssociationsSchema, { description: "Digital Asset Links statements and the webcredentials app ids (empty when no app is configured)" })
	public async appAssociations(): Promise<PasskeyAppAssociations> {
		return this.queryBus.execute(new GetPasskeyAppAssociationsQuery());
	}

	@ApiBearerAuth()
	@Get("/passkeys")
	@RequirePermission("READ", "USER", { resourceId: self(), description: "A user lists their own passkeys" })
	@ApiOperation({ summary: "List the caller's passkeys, newest first (names, sync state and last use — never a key)" })
	@ZodResponse(PasskeyListSchema, { description: "The caller's live passkeys" })
	public async listPasskeys(@GetUser("sub") userId: string, @CurrentActor() actor: ActorContext): Promise<PasskeyList> {
		return this.queryBus.execute(new ListMyPasskeysQuery(actor, { userId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.login)
	@ApiBearerAuth()
	@Post("/passkeys/registration/options")
	@RequirePermission("UPDATE", "USER", { resourceId: self(), description: "A user starts adding a passkey to their own account" })
	@ApiOperation({
		summary: "Start adding a passkey: confirm the password, get the navigator.credentials.create() options",
		description: "Stores a single-use challenge (5 minutes). 401 for a wrong password; 403 during impersonation; 400 when the account already holds 20 passkeys.",
	})
	@ZodResponse(PasskeyRegistrationOptionsResponseSchema, { status: HttpStatus.CREATED, description: "The creation options and the id of their challenge" })
	public async startRegistration(
		@GetUser("sub") userId: string,
		@ZodBody(apiContract.auth.passkeyRegistrationOptions.input) body: StartPasskeyRegistrationInput,
		@CurrentActor() actor: ActorContext,
	): Promise<PasskeyRegistrationOptionsResponse> {
		return this.commandBus.execute(new StartPasskeyRegistrationCommand(actor, { userId, password: body.password }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiBearerAuth()
	@Post("/passkeys/registration")
	@RequirePermission("UPDATE", "USER", { resourceId: self(), description: "A user adds a passkey to their own account" })
	@ApiOperation({ summary: "Finish adding a passkey with the browser's registration response (the owner is emailed)" })
	@ZodResponse(PasskeySchema, { status: HttpStatus.CREATED, description: "The new passkey" })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "The challenge expired or was used, or the response did not verify" })
	@ApiResponse({ status: 409, type: ApiErrorResponseDto, description: "CONFLICT — this credential is already registered" })
	public async completeRegistration(
		@GetUser("sub") userId: string,
		@ZodBody(apiContract.auth.passkeyRegistration.input) body: CompletePasskeyRegistrationInput,
		@CurrentActor() actor: ActorContext,
	): Promise<Passkey> {
		return this.commandBus.execute(new CompletePasskeyRegistrationCommand(actor, { userId, challengeId: body.challengeId, name: body.name, response: body.response }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiBearerAuth()
	@Patch("/passkeys/:passkeyId")
	@RequirePermission("UPDATE", "USER", { resourceId: self(), description: "A user renames one of their own passkeys" })
	@ApiOperation({ summary: "Rename one of the caller's passkeys (404 for any id that is not one of them)" })
	@ZodResponse(PasskeySchema, { description: "The renamed passkey" })
	public async renamePasskey(
		@GetUser("sub") userId: string,
		@ZodParams(PasskeyPathSchema) params: PasskeyPath,
		@ZodBody(RenamePasskeyBodySchema) body: RenamePasskeyBody,
		@CurrentActor() actor: ActorContext,
	): Promise<Passkey> {
		return this.commandBus.execute(new RenamePasskeyCommand(actor, { userId, passkeyId: params.passkeyId, name: body.name }));
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@ApiBearerAuth()
	@Delete("/passkeys/:passkeyId")
	@RequirePermission("UPDATE", "USER", { resourceId: self(), description: "A user removes one of their own passkeys" })
	@ApiOperation({ summary: "Remove one of the caller's passkeys (soft delete; the owner is emailed; 404 for any id that is not one of them)" })
	@ZodResponse(PasskeyMessageResponseSchema, { description: "The passkey is removed" })
	public async removePasskey(
		@GetUser("sub") userId: string,
		@ZodParams(PasskeyPathSchema) params: PasskeyPath,
		@CurrentActor() actor: ActorContext,
	): Promise<PasskeyMessageResponse> {
		return this.commandBus.execute(new RemovePasskeyCommand(actor, { userId, passkeyId: params.passkeyId }));
	}

	@RateLimit(RATE_LIMIT_POLICY.sessionIssue)
	@Public()
	@PublicOperation(PRINCIPAL_LOOKUP_OPERATION)
	@Post("/login/2fa/passkey/options")
	@ApiOperation({ summary: "The navigator.credentials.get() options of a passkey second factor, for the tempToken a password sign-in answered" })
	@ZodResponse(PasskeyAuthenticationOptionsResponseSchema, {
		status: HttpStatus.CREATED,
		description: "The request options (the account's passkeys) and the id of their challenge",
	})
	public async startSecondFactor(
		@ZodBody(apiContract.auth.loginPasskeySecondFactorOptions.input) body: PasskeySecondFactorOptionsInput,
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<PasskeyAuthenticationOptionsResponse> {
		return this.commandBus.execute(new StartPasskeySecondFactorCommand(actor, { tempToken: body.tempToken }));
	}

	@RateLimit(RATE_LIMIT_POLICY.sessionIssue)
	@Public()
	@PublicOperation(PRINCIPAL_LOOKUP_OPERATION)
	@Post("/login/2fa/passkey")
	@ApiOperation({ summary: "Complete a password sign-in with a passkey instead of a TOTP or backup code" })
	@ZodResponse(LoginClientResponseSchema, { description: "Login result" + TOKEN_DELIVERY_DESCRIPTION })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async completeSecondFactor(
		@ZodBody(apiContract.auth.loginPasskeySecondFactor.input) body: LoginPasskeySecondFactorInput,
		@Req() req: FastifyRequest,
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<LoginResult> {
		return this.commandBus.execute(
			new CompletePasskeySecondFactorCommand(actor, {
				tempToken: body.tempToken,
				challengeId: body.challengeId,
				response: body.response,
				device: readSessionDeviceContext(req),
			}),
		);
	}

	@RateLimit(RATE_LIMIT_POLICY.login)
	@Public()
	@PublicOperation(PRINCIPAL_LOOKUP_OPERATION)
	@Post("/login/passkey/options")
	@ApiOperation({ summary: "The navigator.credentials.get() options of a passwordless sign-in (no account is named)" })
	@ZodResponse(PasskeyAuthenticationOptionsResponseSchema, { status: HttpStatus.CREATED, description: "The request options and the id of their challenge" })
	public async startPasswordless(
		@ZodBody(apiContract.auth.loginPasskeyOptions.input) _body: PasswordlessPasskeyOptionsInput,
		@Headers("x-client-type") headerClientType: string | undefined,
		@ZodQuery(AuthClientTypeQuerySchema) query: AuthClientTypeQuery,
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<PasskeyAuthenticationOptionsResponse> {
		return this.commandBus.execute(new StartPasswordlessPasskeyLoginCommand(actor, { clientType: headerClientType ?? query.client_type }));
	}

	@RateLimit(RATE_LIMIT_POLICY.sessionIssue)
	@Public()
	@PublicOperation(PRINCIPAL_LOOKUP_OPERATION)
	@Post("/login/passkey")
	@ApiOperation({ summary: "Sign in with a passkey alone (possession plus user verification: a multi-factor sign-in)" })
	@ApiHeader({ name: "x-client-type", required: false, description: "The app signing in, exactly as for POST /auth/login (admin and merchant apply their sign-in gates)." })
	@ZodResponse(LoginClientResponseSchema, { description: "Login result" + TOKEN_DELIVERY_DESCRIPTION })
	@ApiResponse({ status: 401, type: ApiErrorResponseDto, description: "The challenge expired or was used, or the passkey could not be verified" })
	@UseInterceptors(SetAuthCookiesInterceptor)
	public async completePasswordless(
		@ZodBody(apiContract.auth.loginPasskey.input) body: LoginPasswordlessPasskeyInput,
		@Headers("x-client-type") headerClientType: string | undefined,
		@ZodQuery(AuthClientTypeQuerySchema) query: AuthClientTypeQuery,
		@Req() req: FastifyRequest,
		@CurrentActor(PUBLIC_ACTOR) actor: ActorContext,
	): Promise<LoginResult> {
		return this.commandBus.execute(
			new CompletePasswordlessPasskeyLoginCommand(actor, {
				challengeId: body.challengeId,
				response: body.response,
				clientType: headerClientType ?? query.client_type,
				device: readSessionDeviceContext(req),
			}),
		);
	}
}
