import { Prisma } from "@prisma/client";
import { maskEmailAddress } from "@workspace/shared";
import { z } from "zod";

import type { TenantCustomerLinksPort, TenantCustomerPage, TenantCustomerPageRequest, TenantCustomerSummary } from "../../application/ports/tenant-customer-links.port";

const SummaryRowSchema = z.object({
	userId: z.string(),
	fullName: z.string(),
	email: z.string().nullable(),
	lastClaimedAt: z.string(),
	claimCount: z.number().int(),
});
type SummaryRow = z.output<typeof SummaryRowSchema>;
const CountSchema = z.object({ n: z.number().int() });

function toSummary(row: SummaryRow): TenantCustomerSummary {
	return {
		userId: row.userId,
		fullName: row.fullName,
		maskedEmail: row.email === null ? null : maskEmailAddress(row.email),
		lastClaimedAt: Number(row.lastClaimedAt),
		claimCount: row.claimCount,
	};
}

/** `TenantCustomer` on one producing transaction (ADR 073). */
export class TransactionTenantCustomerLinks implements TenantCustomerLinksPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async recordClaim(tenantId: string, userId: string, claimedAt: number): Promise<void> {
		const at = BigInt(claimedAt);
		// One statement (INSERT … ON CONFLICT): two concurrent first claims cannot both create the link.
		await this.db.tenantCustomer.upsert({
			where: { tenantId_userId: { tenantId, userId } },
			create: { tenantId, userId, firstClaimedAt: at, lastClaimedAt: at, claimCount: 1 },
			update: { lastClaimedAt: at, claimCount: { increment: 1 }, leftAt: null, updatedAt: at },
		});
	}

	public async recordRedemption(tenantId: string, userId: string, redeemedAt: number): Promise<void> {
		const at = BigInt(redeemedAt);
		await this.db.tenantCustomer.updateMany({ where: { tenantId, userId, isDeleted: false }, data: { lastRedeemedAt: at, updatedAt: at } });
	}

	public async customersAmong(tenantId: string, userIds: readonly string[]): Promise<readonly string[]> {
		if (userIds.length === 0) {
			return [];
		}
		const rows = await this.db.tenantCustomer.findMany({ where: { tenantId, isDeleted: false, userId: { in: [...new Set(userIds)] } }, select: { userId: true } });
		return rows.map((row) => row.userId);
	}

	public async summaries(tenantId: string, userIds: readonly string[]): Promise<readonly TenantCustomerSummary[]> {
		if (userIds.length === 0) {
			return [];
		}
		const rows = z.array(SummaryRowSchema).parse(
			await this.db.$queryRaw`
				SELECT tc."userId" AS "userId", u."fullName" AS "fullName", u.email AS email, tc."lastClaimedAt"::text AS "lastClaimedAt", tc."claimCount" AS "claimCount"
				FROM public."TenantCustomer" tc JOIN public."User" u ON u.id = tc."userId"
				WHERE tc."tenantId" = ${tenantId} AND tc."isDeleted" = false AND u."isDeleted" = false AND tc."userId" IN (${Prisma.join([...new Set(userIds)])})`,
		);
		const byId = new Map(rows.map((row): [string, SummaryRow] => [row.userId, row]));
		return userIds.flatMap((userId): TenantCustomerSummary[] => {
			const row = byId.get(userId);
			return row === undefined ? [] : [toSummary(row)];
		});
	}

	public async page(tenantId: string, request: TenantCustomerPageRequest): Promise<TenantCustomerPage> {
		const search =
			request.search === null || request.search.length === 0
				? Prisma.empty
				: Prisma.sql`AND (u."fullName" ILIKE ${`%${request.search}%`} OR u.email ILIKE ${`%${request.search}%`})`;
		const filtered = Prisma.sql`
			SELECT tc."userId" AS "userId", u."fullName" AS "fullName", u.email AS email, tc."lastClaimedAt" AS "lastClaimedAtValue", tc."lastClaimedAt"::text AS "lastClaimedAt", tc."claimCount" AS "claimCount"
			FROM public."TenantCustomer" tc JOIN public."User" u ON u.id = tc."userId"
			WHERE tc."tenantId" = ${tenantId} AND tc."isDeleted" = false AND u."isDeleted" = false ${search}`;
		const order = request.sortField === "claimCount" ? Prisma.sql`"claimCount"` : Prisma.sql`"lastClaimedAtValue"`;
		const direction = request.descending ? Prisma.sql`DESC` : Prisma.sql`ASC`;
		const offset = (request.page - 1) * request.limit;
		const rows = z
			.array(SummaryRowSchema)
			.parse(await this.db.$queryRaw`SELECT * FROM (${filtered}) customers ORDER BY ${order} ${direction}, "userId" ${direction} LIMIT ${request.limit} OFFSET ${offset}`);
		const [{ n: total }] = z.tuple([CountSchema]).parse(await this.db.$queryRaw`SELECT COUNT(*)::int AS n FROM (${filtered}) counted`);
		return { items: rows.map(toSummary), total };
	}
}
