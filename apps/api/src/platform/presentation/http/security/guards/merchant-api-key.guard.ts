import { HttpException, HttpStatus, Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { PosTerminalIdSchema } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { API_KEY_VERIFICATION, type ApiKeyVerificationPort } from "../../../../application/ports/api-key-verification.port";
import { TILL_RESOLVER, type TillRefusal, type TillResolverPort } from "../../../../application/ports/till-resolution.port";
import { RequestContextService } from "../../../../infrastructure/context/request-context";
import { rejectMachineTenantSelector } from "../../../../infrastructure/tenancy/machine-tenant-selector";
import { extractApiKeyFromRequest, requestHeader, setTillPointOnRequest } from "../api-keys/api-key-request";

/** One wire answer: status, stable code and message. */
interface TillGuardAnswer {
	readonly status: HttpStatus;
	readonly error: string;
	readonly message: string;
}

/** The answer for each refusal, byte-identical to what POS clients already handle. */
const REFUSALS: Readonly<Record<TillRefusal, TillGuardAnswer>> = {
	TERMINAL_KEY_MISMATCH: { status: HttpStatus.FORBIDDEN, error: "TERMINAL_KEY_MISMATCH", message: "This API key belongs to a different terminal" },
	TERMINAL_ID_REQUIRED: { status: HttpStatus.UNAUTHORIZED, error: "TERMINAL_ID_REQUIRED", message: "X-Terminal-Id header required" },
	TERMINAL_NOT_REGISTERED: { status: HttpStatus.UNAUTHORIZED, error: "TERMINAL_NOT_REGISTERED", message: "This terminal is not registered with the merchant" },
	TERMINAL_LOCATION_MISMATCH: { status: HttpStatus.FORBIDDEN, error: "TERMINAL_LOCATION_MISMATCH", message: "This API key belongs to a different store than this terminal" },
};

const KEY_REQUIRED: TillGuardAnswer = { status: HttpStatus.UNAUTHORIZED, error: "MERCHANT_API_KEY_REQUIRED", message: "Merchant API key required" };
const KEY_INVALID: TillGuardAnswer = { status: HttpStatus.UNAUTHORIZED, error: "MERCHANT_API_KEY_INVALID", message: "Invalid API key" };
const TERMINAL_ID_INVALID: TillGuardAnswer = { status: HttpStatus.BAD_REQUEST, error: "TERMINAL_ID_INVALID", message: "Invalid X-Terminal-Id header" };

function refuse(answer: TillGuardAnswer): HttpException {
	return new HttpException({ message: answer.message, error: answer.error }, answer.status);
}

/**
 * POS redemption guard. The merchant API key authenticates the call (it is the only secret, checked
 * through pos's `ApiKeyVerificationPort`); pos's `TillResolverPort` resolves the till it redeems from.
 * The key (and its terminal) becomes the request's principal (ADR 017): the RLS scope, idempotency and
 * the audit trail read it. Routes read the till with `@TillPoint()`.
 */
@Injectable()
export class MerchantApiKeyGuard implements CanActivate {
	public constructor(
		@Inject(API_KEY_VERIFICATION) private readonly apiKeys: ApiKeyVerificationPort,
		@Inject(TILL_RESOLVER) private readonly tills: TillResolverPort,
		private readonly requestContext: RequestContextService,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<FastifyRequest>();
		const apiKey = extractApiKeyFromRequest(request);
		if (apiKey === undefined) {
			throw refuse(KEY_REQUIRED);
		}
		const requestedTerminalId = this.readTerminalId(request);
		const key = await this.apiKeys.verify(apiKey);
		if (key === null) {
			throw refuse(KEY_INVALID);
		}
		const till = await this.tills.resolve(key, requestedTerminalId);
		if (till.kind === "refused") {
			throw refuse(REFUSALS[till.refusal]);
		}
		setTillPointOnRequest(request, till.point);
		rejectMachineTenantSelector(request);
		this.requestContext.bindApiKey({ apiKeyId: key.apiKeyId, tenantId: key.tenantId, terminalId: till.point.terminalId, locationId: key.locationId });
		return true;
	}

	/** The `X-Terminal-Id` header, validated when present (`undefined` when absent). */
	private readTerminalId(request: FastifyRequest): string | undefined {
		const raw = requestHeader(request, "x-terminal-id");
		if (raw === undefined || raw.length === 0) {
			return undefined;
		}
		const parsed = PosTerminalIdSchema.safeParse(raw);
		if (!parsed.success) {
			throw refuse(TERMINAL_ID_INVALID);
		}
		return parsed.data;
	}
}
