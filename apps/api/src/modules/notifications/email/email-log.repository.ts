import { Injectable } from "@nestjs/common";
import type { EmailLog } from "@prisma/client";

import type { EmailLogCreate, EmailLogStatus } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

@Injectable()
export class EmailLogRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async create(input: EmailLogCreate): Promise<{ readonly id: string }> {
		const row = await this.prisma.emailLog.create({
			data: {
				templateKey: input.templateKey,
				to: input.to,
				subject: input.subject,
				status: input.status,
				resendId: input.resendId,
				error: input.error,
				metadata: input.metadata ?? undefined,
			},
			select: { id: true },
		});
		return { id: row.id };
	}

	public async updateStatusByResendId(resendId: string, status: EmailLogStatus, allowedCurrentStatuses: readonly EmailLogStatus[], error?: string): Promise<number> {
		const result = await this.prisma.emailLog.updateMany({
			where: { resendId, status: { in: [...allowedCurrentStatuses] } },
			data: { status, error, updatedAt: Date.now() },
		});
		return result.count;
	}

	public async countByResendId(resendId: string): Promise<number> {
		return this.prisma.emailLog.count({ where: { resendId } });
	}

	public async listRecent(limit: number): Promise<EmailLog[]> {
		return this.prisma.emailLog.findMany({
			orderBy: { createdAt: "desc" },
			take: limit,
		});
	}
}
