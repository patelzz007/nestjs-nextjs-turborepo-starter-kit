import type { Prisma } from "@prisma/client";
import type { EpochMs, MerchantTerminalSummary } from "@workspace/shared";

import type { TerminalViewPort } from "../../application/ports/pos-read.port";
import { TERMINAL_SUMMARY_INCLUDE, toTerminalSummary } from "./terminal-row.mapper";

/** A terminal as the console shows it, read in the command's own transaction (it just wrote the row). */
export class PrismaTerminalView implements TerminalViewPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async getSummary(id: string, now: EpochMs): Promise<MerchantTerminalSummary> {
		const row = await this.db.tenantTerminal.findUniqueOrThrow({ where: { id }, include: TERMINAL_SUMMARY_INCLUDE });
		return toTerminalSummary(row, now);
	}
}
