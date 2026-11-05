import type { Prisma, StatusIncident as StatusIncidentRow, StatusIncidentUpdate as StatusIncidentUpdateRow } from "@prisma/client";
import { epochMs, StatusComponentKeySchema } from "@workspace/shared";
import { z } from "zod";

import type {
	NewStatusIncident,
	NewStatusIncidentUpdate,
	StatusIncidentAudience,
	StatusIncidentRecord,
	StatusIncidentRepository,
} from "../../application/ports/status-incident.repository.port";

type Db = Prisma.TransactionClient;
type IncidentWithUpdates = StatusIncidentRow & { readonly updates: readonly StatusIncidentUpdateRow[] };

const LIVE = { isDeleted: false };
const WITH_UPDATES = { updates: { where: LIVE, orderBy: [{ postedAt: "desc" }, { id: "desc" }] } } satisfies Prisma.StatusIncidentInclude;
const NEWEST_FIRST = [{ startedAt: "desc" }, { id: "desc" }] satisfies Prisma.StatusIncidentOrderByWithRelationInput[];
const ComponentsSchema = z.array(StatusComponentKeySchema);

function toRecord(row: IncidentWithUpdates, names: ReadonlyMap<string, string>): StatusIncidentRecord {
	return {
		id: row.id,
		title: row.title,
		impact: row.impact,
		state: row.state,
		components: ComponentsSchema.parse(row.components),
		startedAt: epochMs(Number(row.startedAt)),
		resolvedAt: row.resolvedAt === null ? null : epochMs(Number(row.resolvedAt)),
		openedById: row.openedById,
		openedByName: names.get(row.openedById) ?? null,
		updates: row.updates.map((update) => ({
			id: update.id,
			state: update.state,
			message: update.message,
			postedById: update.postedById,
			postedByName: names.get(update.postedById) ?? null,
			postedAt: epochMs(Number(update.postedAt)),
		})),
	};
}

/**
 * The status page's incidents. The public page's read never touches `User` (its system operation doesn't
 * reach it): who posted is named only on staff reads.
 */
export class PrismaStatusIncidentRepository implements StatusIncidentRepository {
	public constructor(
		private readonly db: Db,
		private readonly audience: StatusIncidentAudience,
	) {}

	public async forPublicPage(resolvedSince: number): Promise<readonly StatusIncidentRecord[]> {
		const rows = await this.db.statusIncident.findMany({
			where: { ...LIVE, OR: [{ resolvedAt: null }, { resolvedAt: { gte: BigInt(resolvedSince) } }] },
			include: WITH_UPDATES,
			orderBy: NEWEST_FIRST,
		});
		return this.withNames(rows);
	}

	public async list(limit: number): Promise<readonly StatusIncidentRecord[]> {
		return this.withNames(await this.db.statusIncident.findMany({ where: LIVE, include: WITH_UPDATES, orderBy: NEWEST_FIRST, take: limit }));
	}

	public async find(id: string): Promise<StatusIncidentRecord | null> {
		const row = await this.db.statusIncident.findFirst({ where: { ...LIVE, id }, include: WITH_UPDATES });
		return row === null ? null : ((await this.withNames([row])).at(0) ?? null);
	}

	public async open(incident: NewStatusIncident): Promise<StatusIncidentRecord> {
		const at = BigInt(incident.at);
		const row = await this.db.statusIncident.create({
			data: {
				title: incident.title,
				impact: incident.impact,
				state: "INVESTIGATING",
				components: [...incident.components],
				startedAt: at,
				openedById: incident.openedById,
				createdBy: incident.openedById,
				updatedBy: incident.openedById,
				updates: {
					create: {
						state: "INVESTIGATING",
						message: incident.message,
						postedById: incident.openedById,
						postedAt: at,
						createdBy: incident.openedById,
						updatedBy: incident.openedById,
					},
				},
			},
			include: WITH_UPDATES,
		});
		return (await this.withNames([row])).at(0) ?? toRecord(row, new Map());
	}

	public async postUpdate(id: string, update: NewStatusIncidentUpdate): Promise<StatusIncidentRecord | null> {
		const at = BigInt(update.at);
		const moved = await this.db.statusIncident.updateMany({
			where: { ...LIVE, id, resolvedAt: null },
			data: { state: update.state, resolvedAt: update.state === "RESOLVED" ? at : null, updatedAt: at, updatedBy: update.postedById },
		});
		if (moved.count === 0) {
			return null;
		}
		await this.db.statusIncidentUpdate.create({
			data: {
				incidentId: id,
				state: update.state,
				message: update.message,
				postedById: update.postedById,
				postedAt: at,
				createdBy: update.postedById,
				updatedBy: update.postedById,
			},
		});
		return this.find(id);
	}

	private async withNames(rows: readonly IncidentWithUpdates[]): Promise<readonly StatusIncidentRecord[]> {
		if (this.audience === "public" || rows.length === 0) {
			return rows.map((row) => toRecord(row, new Map()));
		}
		const ids = [...new Set(rows.flatMap((row) => [row.openedById, ...row.updates.map((update) => update.postedById)]))];
		const users = await this.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
		const names = new Map(users.map((user): [string, string] => [user.id, user.fullName]));
		return rows.map((row) => toRecord(row, names));
	}
}
