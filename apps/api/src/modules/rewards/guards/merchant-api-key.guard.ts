import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PosTerminalIdSchema } from "@workspace/shared";
import type { FastifyRequest } from "fastify";

import { MerchantApiKeyVerificationService } from "../../api-keys/services/merchant-api-key-verification.service";
import type { MerchantApiKeyAuthContext, PairedTerminal } from "../../api-keys/types/api-key-auth.types";
import { extractApiKeyFromRequest } from "../../api-keys/utils/extract-api-key.util";
import { readFirstHeader } from "../../../common/utils/http-headers";
import { PrismaService } from "../../../prisma/prisma.service";
import { MERCHANT_POS_CONTEXT_KEY, type MerchantPosContext } from "../types/merchant-pos-context";

/**
 * POS redemption guard. The merchant API key authenticates the call (it is the
 * only secret).
 *
 * - **Paired key** (issued by `POST /pos/terminals/pair`): the key IS the
 *   terminal. `X-Terminal-Id` is optional; if sent it must be that terminal's
 *   id. The store is the terminal's store.
 * - **Manually created key**: `X-Terminal-Id` is required. Store resolution:
 *   a store-scoped key's store wins; otherwise a registered terminal's store;
 *   otherwise unknown (`null`). A store-scoped key on a terminal registered to
 *   a DIFFERENT store is refused, and when the merchant turned on "only allow
 *   registered terminals", an unregistered id is refused.
 *
 * Every call from a registered terminal updates its `lastSeenAt`.
 */
@Injectable()
export class MerchantApiKeyGuard implements CanActivate {
	public constructor(
		private readonly merchantApiKeyVerification: MerchantApiKeyVerificationService,
		private readonly prisma: PrismaService,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<FastifyRequest>();

		const apiKey = extractApiKeyFromRequest(request);
		if (apiKey === undefined || apiKey.length === 0) {
			throw new UnauthorizedException({ message: "Merchant API key required", error: "MERCHANT_API_KEY_REQUIRED" });
		}

		const requestedTerminalId = this.readTerminalId(request);

		const keyContext = await this.merchantApiKeyVerification.verify(apiKey);
		if (keyContext === null) {
			throw new UnauthorizedException({ message: "Invalid API key", error: "MERCHANT_API_KEY_INVALID" });
		}

		const posContext: MerchantPosContext =
			keyContext.terminal === null
				? await this.resolveManualKey(keyContext, requestedTerminalId)
				: await this.resolvePairedKey(keyContext, keyContext.terminal, requestedTerminalId);

		Object.assign(request, { [MERCHANT_POS_CONTEXT_KEY]: posContext });

		return true;
	}

	/** The `X-Terminal-Id` header, validated when present (`undefined` when absent). */
	private readTerminalId(request: FastifyRequest): string | undefined {
		const raw = readFirstHeader(request.headers["x-terminal-id"]);
		if (raw === undefined || raw.length === 0) {
			return undefined;
		}
		const parsed = PosTerminalIdSchema.safeParse(raw);
		if (!parsed.success) {
			throw new BadRequestException({ message: "Invalid X-Terminal-Id header", error: "TERMINAL_ID_INVALID" });
		}
		return parsed.data;
	}

	private async resolvePairedKey(keyContext: MerchantApiKeyAuthContext, terminal: PairedTerminal, requestedTerminalId: string | undefined): Promise<MerchantPosContext> {
		if (requestedTerminalId !== undefined && requestedTerminalId !== terminal.terminalId) {
			throw new ForbiddenException({ message: "This API key belongs to a different terminal", error: "TERMINAL_KEY_MISMATCH" });
		}
		await this.touchLastSeen(terminal.id);
		return { organizationId: keyContext.organizationId, terminalId: terminal.terminalId, apiKeyId: keyContext.apiKeyId, locationId: terminal.locationId };
	}

	private async resolveManualKey(keyContext: MerchantApiKeyAuthContext, requestedTerminalId: string | undefined): Promise<MerchantPosContext> {
		if (requestedTerminalId === undefined) {
			throw new UnauthorizedException({ message: "X-Terminal-Id header required", error: "TERMINAL_ID_REQUIRED" });
		}

		const terminal = await this.prisma.organizationTerminal.findFirst({
			where: { organizationId: keyContext.organizationId, terminalId: requestedTerminalId, isDeleted: false },
			select: { id: true, locationId: true },
		});

		if (terminal === null && keyContext.requireRegisteredTerminals) {
			throw new UnauthorizedException({ message: "This terminal is not registered with the merchant", error: "TERMINAL_NOT_REGISTERED" });
		}
		if (terminal !== null && keyContext.locationId !== null && terminal.locationId !== keyContext.locationId) {
			throw new ForbiddenException({ message: "This API key belongs to a different store than this terminal", error: "TERMINAL_LOCATION_MISMATCH" });
		}
		if (terminal !== null) {
			await this.touchLastSeen(terminal.id);
		}

		return {
			organizationId: keyContext.organizationId,
			terminalId: requestedTerminalId,
			apiKeyId: keyContext.apiKeyId,
			locationId: keyContext.locationId ?? terminal?.locationId ?? null,
		};
	}

	private async touchLastSeen(terminalRowId: string): Promise<void> {
		await this.prisma.organizationTerminal.update({ where: { id: terminalRowId }, data: { lastSeenAt: Date.now() } });
	}
}
