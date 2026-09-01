import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { PrismaService } from "../../../prisma/prisma.service";
import { readFirstHeader } from "../../../common/utils/http-headers";
import { sha256Hex } from "../utils/reward-crypto.util";
import { MERCHANT_POS_CONTEXT_KEY, type MerchantPosContext } from "../types/merchant-pos-context";

@Injectable()
export class MerchantApiKeyGuard implements CanActivate {
	public constructor(private readonly prisma: PrismaService) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<FastifyRequest>();

		const authorization = request.headers.authorization;
		const apiKey = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;

		if (apiKey === undefined || apiKey.length === 0) {
			throw new UnauthorizedException({ message: "Merchant API key required", error: "MERCHANT_API_KEY_REQUIRED" });
		}

		const terminalId = readFirstHeader(request.headers["x-terminal-id"]);
		if (terminalId === undefined || terminalId.length === 0) {
			throw new UnauthorizedException({ message: "X-Terminal-Id header required", error: "TERMINAL_ID_REQUIRED" });
		}

		const keyHash = sha256Hex(apiKey);
		const keyRecord = await this.prisma.merchantApiKey.findFirst({
			where: {
				keyHash,
				isDeleted: false,
				revokedAt: null,
			},
		});

		if (keyRecord === null) {
			throw new UnauthorizedException({ message: "Invalid API key", error: "MERCHANT_API_KEY_INVALID" });
		}

		const terminal = await this.prisma.merchantTerminal.findFirst({
			where: {
				merchantOrgId: keyRecord.merchantOrgId,
				terminalId,
				isDeleted: false,
			},
		});

		if (terminal === null) {
			throw new UnauthorizedException({ message: "Invalid terminal", error: "TERMINAL_INVALID" });
		}

		const posContext: MerchantPosContext = {
			merchantOrgId: keyRecord.merchantOrgId,
			terminalId,
			apiKeyId: keyRecord.id,
		};

		Object.assign(request, { [MERCHANT_POS_CONTEXT_KEY]: posContext });

		await this.prisma.merchantApiKey.update({
			where: { id: keyRecord.id },
			data: { lastUsedAt: Date.now() },
		});

		return true;
	}
}
