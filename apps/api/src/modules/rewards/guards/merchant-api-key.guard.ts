import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { MerchantApiKeyVerificationService } from "../../api-keys/services/merchant-api-key-verification.service";
import { extractApiKeyFromRequest } from "../../api-keys/utils/extract-api-key.util";
import { readFirstHeader } from "../../../common/utils/http-headers";
import { PrismaService } from "../../../prisma/prisma.service";
import { MERCHANT_POS_CONTEXT_KEY, type MerchantPosContext } from "../types/merchant-pos-context";

/** POS redemption guard — API key plus terminal binding. */
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

		const terminalId = readFirstHeader(request.headers["x-terminal-id"]);
		if (terminalId === undefined || terminalId.length === 0) {
			throw new UnauthorizedException({ message: "X-Terminal-Id header required", error: "TERMINAL_ID_REQUIRED" });
		}

		const keyContext = await this.merchantApiKeyVerification.verify(apiKey);
		if (keyContext === null) {
			throw new UnauthorizedException({ message: "Invalid API key", error: "MERCHANT_API_KEY_INVALID" });
		}

		const terminal = await this.prisma.merchantTerminal.findFirst({
			where: {
				merchantOrgId: keyContext.merchantOrgId,
				terminalId,
				isDeleted: false,
			},
		});

		if (terminal === null) {
			throw new UnauthorizedException({ message: "Invalid terminal", error: "TERMINAL_INVALID" });
		}

		const posContext: MerchantPosContext = {
			merchantOrgId: keyContext.merchantOrgId,
			terminalId,
			apiKeyId: keyContext.apiKeyId,
		};

		Object.assign(request, { [MERCHANT_POS_CONTEXT_KEY]: posContext });

		return true;
	}
}
