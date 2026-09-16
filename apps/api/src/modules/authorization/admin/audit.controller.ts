import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

import { RequirePermission } from "../../auth/decorators/require-permission.decorator";
import { apiPath } from "@workspace/shared";
import { PrismaService } from "../../../prisma/prisma.service";

interface AuditQueryParams {
	/** Page number (1-indexed). */
	readonly page?: string;
	/** Items per page. */
	readonly limit?: string;
	/** Filter by action type. */
	readonly action?: string;
	/** Filter by actor user ID. */
	readonly actorId?: string;
	/** Filter by target user ID. */
	readonly targetUserId?: string;
}

/**
 * Controller for querying authorization audit logs.
 *
 * All queries require `AUDIT_LOG:READ` permission.
 */
@Controller(apiPath("/admin/audit"))
@ApiTags("Audit Log")
export class AuditController {
	public constructor(private readonly prisma: PrismaService) {}

	@Get()
	@RequirePermission("READ", "AUDIT_LOG")
	@ApiOkResponse({ description: "Paginated audit log entries" })
	public async list(@Query() query: AuditQueryParams): Promise<unknown> {
		const page: number = Math.max(1, Number(query.page ?? "1"));
		const limit: number = Math.min(100, Math.max(1, Number(query.limit ?? "20")));
		const skip: number = (page - 1) * limit;

		const where = {
			...(query.action !== undefined ? { action: query.action } : {}),
			...(query.actorId !== undefined ? { actorId: query.actorId } : {}),
			...(query.targetUserId !== undefined ? { targetUserId: query.targetUserId } : {}),
		};

		const [items, total] = await Promise.all([
			this.prisma.permissionAuditLog.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
			}),
			this.prisma.permissionAuditLog.count({ where }),
		]);

		return {
			items,
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		};
	}
}
