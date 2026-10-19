import { Injectable } from "@nestjs/common";
import type { EpochMs } from "@workspace/shared";

import { PrismaService } from "../../../../prisma/prisma.service";
import type { RegisteredTill, TillTerminalsPort } from "../../application/ports/till-terminals.port";

/** The POS guard's till lookups, in the guards' pre-handler phase (its own named system-operation scope). */
@Injectable()
export class PrismaTillTerminals implements TillTerminalsPort {
	public constructor(private readonly prisma: PrismaService) {}

	public async findLive(organizationId: string, terminalId: string): Promise<RegisteredTill | null> {
		return this.prisma.organizationTerminal.findFirst({ where: { organizationId, terminalId, isDeleted: false }, select: { id: true, locationId: true } });
	}

	public async touchLastSeen(terminalRowId: string, at: EpochMs): Promise<void> {
		await this.prisma.organizationTerminal.update({ where: { id: terminalRowId }, data: { lastSeenAt: at }, select: { id: true } });
	}
}
