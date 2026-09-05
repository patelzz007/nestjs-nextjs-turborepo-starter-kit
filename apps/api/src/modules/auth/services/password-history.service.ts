import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";
import { CryptoService } from "./crypto.service";

const PASSWORD_HISTORY_LIMIT = 5;

/**
 * Prevents password reuse by checking the last N stored password hashes.
 */
@Injectable()
export class PasswordHistoryService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly cryptoService: CryptoService,
	) {}

	public async isPasswordReused(userId: string, plainPassword: string): Promise<boolean> {
		const history = await this.prisma.passwordHistory.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
			take: PASSWORD_HISTORY_LIMIT,
			select: { passwordHash: true },
		});

		for (const record of history) {
			const matches = await this.cryptoService.compare(plainPassword, record.passwordHash);
			if (matches) {
				return true;
			}
		}

		return false;
	}

	public async recordPassword(userId: string, passwordHash: string): Promise<void> {
		await this.prisma.passwordHistory.create({
			data: {
				userId,
				passwordHash,
			},
		});
	}
}
