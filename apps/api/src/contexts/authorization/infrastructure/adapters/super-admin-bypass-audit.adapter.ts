import { Injectable } from "@nestjs/common";

import { RequestContextService } from "../../../../platform/infrastructure/context/request-context";
import { PrismaService } from "../../../../prisma/prisma.service";
import type { SuperAdminBypassAuditPort } from "../../application/ports/authorization-kernel.port";
import { PrismaPermissionAuditWriter } from "../persistence/prisma-permission-audit.writer";

/**
 * The SuperAdmin platform bypass on a protected route, written to `PermissionAuditLog`. Guards run
 * inside the `request.pre_handler` bypass scope, so the pool connection may append to the bypass-only table.
 */
@Injectable()
export class SuperAdminBypassAuditAdapter implements SuperAdminBypassAuditPort {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly requestContext: RequestContextService,
	) {}

	public async recordBypass(userId: string, detail: string): Promise<void> {
		await new PrismaPermissionAuditWriter(this.prisma, this.requestContext).append({ action: "SUPER_ADMIN_BYPASS", actor: { kind: "USER", userId }, detail });
	}
}
