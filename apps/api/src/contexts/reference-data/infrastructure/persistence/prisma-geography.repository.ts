import type { Prisma } from "@prisma/client";
import type {
	City,
	Country,
	CreateCityInput,
	CreateCountryInput,
	CreateRegionInput,
	CreateStateInput,
	CreateSubregionInput,
	EpochMs,
	Region,
	State,
	Subregion,
	UpdateCityInput,
	UpdateCountryInput,
	UpdateRegionInput,
	UpdateStateInput,
	UpdateSubregionInput,
} from "@workspace/shared";

import type { GeoChildLevel } from "../../domain/policies/geo-cascade.policy";
import type { GeoImportRow } from "../../domain/policies/geo-import.policy";
import type { GeoDeletionStamp, GeoNamedRow, GeographyRepository } from "../../domain/repositories/geography.repository";
import type { GeoEntityKind, GeoParentKind } from "../../domain/value-objects/geo-entity-kind.value-object";
import { GEO_CASCADE_WHERE } from "./geo-cascade.where";
import { toCityDto, toCountryDto, toRegionDto, toStateDto, toSubregionDto } from "./geo.mappers";
import {
	toPrismaCreateCity,
	toPrismaCreateCountry,
	toPrismaCreateRegion,
	toPrismaCreateState,
	toPrismaCreateSubregion,
	toPrismaUpdateCity,
	toPrismaUpdateCountry,
	toPrismaUpdateRegion,
	toPrismaUpdateState,
	toPrismaUpdateSubregion,
} from "./geo-write-input.mappers";

/** Advisory-lock key serializing geo imports (`pg_advisory_xact_lock(hashtext(...))`). */
export const GEO_IMPORT_LOCK_KEY = "geo.reference_data.import";

/** Rows per INSERT statement during an import. */
export const GEO_IMPORT_INSERT_CHUNK_SIZE = 1_000;

/** City coordinates are required columns; an imported city row carries none, so it starts at 0,0 (as before the migration). */
const IMPORTED_CITY_COORDINATE = 0;

/** Transaction client of a `geo.reference_data.write` system operation. */
export type GeoWriteTransaction = Pick<Prisma.TransactionClient, "region" | "subregion" | "country" | "state" | "city" | "$executeRaw">;

/** The live-row condition every conditional write adds. */
const LIVE = { isDeleted: false } satisfies { isDeleted: boolean };

function softDeleteData(stamp: GeoDeletionStamp): { isDeleted: true; deletedAt: bigint; deletedBy: string; updatedAt: bigint } {
	return { isDeleted: true, deletedAt: BigInt(stamp.deletedAt), deletedBy: stamp.deletedBy, updatedAt: BigInt(stamp.deletedAt) };
}

/** Where + data of an `upsert` import's "touch the matched rows" update. */
interface GeoTouchArgs {
	readonly where: { readonly id: { readonly in: number[] }; readonly isDeleted: false };
	readonly data: { readonly updatedAt: bigint };
}

const TOUCH_ROWS: Readonly<Record<GeoEntityKind, (tx: GeoWriteTransaction, args: GeoTouchArgs) => Promise<Prisma.BatchPayload>>> = {
	region: (tx, args) => tx.region.updateMany(args),
	subregion: (tx, args) => tx.subregion.updateMany(args),
	country: (tx, args) => tx.country.updateMany(args),
	state: (tx, args) => tx.state.updateMany(args),
	city: (tx, args) => tx.city.updateMany(args),
};

/** Soft-delete of one live row, per table. */
const SOFT_DELETE_ROW: Readonly<Record<GeoEntityKind, (tx: GeoWriteTransaction, id: number, stamp: GeoDeletionStamp) => Promise<Prisma.BatchPayload>>> = {
	region: (tx, id, stamp) => tx.region.updateMany({ where: { id, ...LIVE }, data: softDeleteData(stamp) }),
	subregion: (tx, id, stamp) => tx.subregion.updateMany({ where: { id, ...LIVE }, data: softDeleteData(stamp) }),
	country: (tx, id, stamp) => tx.country.updateMany({ where: { id, ...LIVE }, data: softDeleteData(stamp) }),
	state: (tx, id, stamp) => tx.state.updateMany({ where: { id, ...LIVE }, data: softDeleteData(stamp) }),
	city: (tx, id, stamp) => tx.city.updateMany({ where: { id, ...LIVE }, data: softDeleteData(stamp) }),
};

/** Live-row count of a parent entity (0 = missing or soft-deleted). */
const LIVE_PARENT_COUNT: Readonly<Record<GeoParentKind, (tx: GeoWriteTransaction, id: number) => Promise<number>>> = {
	region: (tx, id) => tx.region.count({ where: { id, ...LIVE } }),
	subregion: (tx, id) => tx.subregion.count({ where: { id, ...LIVE } }),
	country: (tx, id) => tx.country.count({ where: { id, ...LIVE } }),
	state: (tx, id) => tx.state.count({ where: { id, ...LIVE } }),
};

/** The live ids among `ids`, per parent table. */
const LIVE_IDS: Readonly<Record<GeoParentKind, (tx: GeoWriteTransaction, ids: number[]) => Promise<readonly { readonly id: number }[]>>> = {
	region: (tx, ids) => tx.region.findMany({ where: { id: { in: ids }, ...LIVE }, select: { id: true } }),
	subregion: (tx, ids) => tx.subregion.findMany({ where: { id: { in: ids }, ...LIVE }, select: { id: true } }),
	country: (tx, ids) => tx.country.findMany({ where: { id: { in: ids }, ...LIVE }, select: { id: true } }),
	state: (tx, ids) => tx.state.findMany({ where: { id: { in: ids }, ...LIVE }, select: { id: true } }),
};

/** The live rows with one of `names`, with the parent that scopes each one's natural key. */
const LIVE_NAMED_ROWS: Readonly<Record<GeoEntityKind, (tx: GeoWriteTransaction, names: string[]) => Promise<readonly GeoNamedRow[]>>> = {
	region: async (tx, names) =>
		(await tx.region.findMany({ where: { ...LIVE, name: { in: names } }, select: { id: true, name: true } })).map((row): GeoNamedRow => ({ ...row, parentId: null })),
	country: async (tx, names) =>
		(await tx.country.findMany({ where: { ...LIVE, name: { in: names } }, select: { id: true, name: true } })).map((row): GeoNamedRow => ({ ...row, parentId: null })),
	subregion: async (tx, names) =>
		(await tx.subregion.findMany({ where: { ...LIVE, name: { in: names } }, select: { id: true, name: true, regionId: true } })).map((row): GeoNamedRow => ({
			id: row.id,
			name: row.name,
			parentId: row.regionId,
		})),
	state: async (tx, names) =>
		(await tx.state.findMany({ where: { ...LIVE, name: { in: names } }, select: { id: true, name: true, countryId: true } })).map((row): GeoNamedRow => ({
			id: row.id,
			name: row.name,
			parentId: row.countryId,
		})),
	city: async (tx, names) =>
		(await tx.city.findMany({ where: { ...LIVE, name: { in: names } }, select: { id: true, name: true, stateId: true } })).map((row): GeoNamedRow => ({
			id: row.id,
			name: row.name,
			parentId: row.stateId,
		})),
};

/**
 * Geography writes, bound to ONE `geo.reference_data.write` transaction (the
 * only session the geo `*_write` RLS policies accept). Built fresh per unit of
 * work by `ReferenceDataScopeFactory`; never cached. Every update and soft
 * delete is conditional on the row being live, so a concurrent delete turns a
 * late update into "not found" instead of resurrecting the row.
 */
export class PrismaGeographyRepository implements GeographyRepository {
	public constructor(private readonly tx: GeoWriteTransaction) {}

	public async lockImports(): Promise<void> {
		await this.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${GEO_IMPORT_LOCK_KEY}))`;
	}

	public async isLive(entity: GeoParentKind, id: number): Promise<boolean> {
		return (await LIVE_PARENT_COUNT[entity](this.tx, id)) > 0;
	}

	public async createRegion(input: CreateRegionInput): Promise<Region> {
		return toRegionDto(await this.tx.region.create({ data: toPrismaCreateRegion(input) }));
	}

	public async updateRegion(id: number, input: UpdateRegionInput, updatedAt: EpochMs): Promise<Region | null> {
		const updated = await this.tx.region.updateMany({ where: { id, ...LIVE }, data: { ...toPrismaUpdateRegion(input), updatedAt: BigInt(updatedAt) } });
		return updated.count === 0 ? null : toRegionDto(await this.tx.region.findUniqueOrThrow({ where: { id } }));
	}

	public async createSubregion(input: CreateSubregionInput): Promise<Subregion> {
		return toSubregionDto(await this.tx.subregion.create({ data: toPrismaCreateSubregion(input) }));
	}

	public async updateSubregion(id: number, input: UpdateSubregionInput, updatedAt: EpochMs): Promise<Subregion | null> {
		const updated = await this.tx.subregion.updateMany({ where: { id, ...LIVE }, data: { ...toPrismaUpdateSubregion(input), updatedAt: BigInt(updatedAt) } });
		return updated.count === 0 ? null : toSubregionDto(await this.tx.subregion.findUniqueOrThrow({ where: { id } }));
	}

	public async createCountry(input: CreateCountryInput): Promise<Country> {
		return toCountryDto(await this.tx.country.create({ data: toPrismaCreateCountry(input) }));
	}

	public async updateCountry(id: number, input: UpdateCountryInput, updatedAt: EpochMs): Promise<Country | null> {
		const updated = await this.tx.country.updateMany({ where: { id, ...LIVE }, data: { ...toPrismaUpdateCountry(input), updatedAt: BigInt(updatedAt) } });
		return updated.count === 0 ? null : toCountryDto(await this.tx.country.findUniqueOrThrow({ where: { id } }));
	}

	public async createState(input: CreateStateInput): Promise<State> {
		return toStateDto(await this.tx.state.create({ data: toPrismaCreateState(input) }));
	}

	public async updateState(id: number, input: UpdateStateInput, updatedAt: EpochMs): Promise<State | null> {
		const updated = await this.tx.state.updateMany({ where: { id, ...LIVE }, data: { ...toPrismaUpdateState(input), updatedAt: BigInt(updatedAt) } });
		return updated.count === 0 ? null : toStateDto(await this.tx.state.findUniqueOrThrow({ where: { id } }));
	}

	public async createCity(input: CreateCityInput): Promise<City> {
		return toCityDto(await this.tx.city.create({ data: toPrismaCreateCity(input) }));
	}

	public async updateCity(id: number, input: UpdateCityInput, updatedAt: EpochMs): Promise<City | null> {
		const updated = await this.tx.city.updateMany({ where: { id, ...LIVE }, data: { ...toPrismaUpdateCity(input), updatedAt: BigInt(updatedAt) } });
		return updated.count === 0 ? null : toCityDto(await this.tx.city.findUniqueOrThrow({ where: { id } }));
	}

	public async softDelete(entity: GeoEntityKind, id: number, stamp: GeoDeletionStamp): Promise<boolean> {
		return (await SOFT_DELETE_ROW[entity](this.tx, id, stamp)).count > 0;
	}

	public async softDeleteDescendants(entity: GeoParentKind, id: number, level: GeoChildLevel, stamp: GeoDeletionStamp): Promise<void> {
		const where = GEO_CASCADE_WHERE[entity];
		const data = softDeleteData(stamp);
		switch (level) {
			case "cities":
				if (where.cities !== undefined) await this.tx.city.updateMany({ where: { ...LIVE, ...where.cities(id) }, data });
				return;
			case "states":
				if (where.states !== undefined) await this.tx.state.updateMany({ where: { ...LIVE, ...where.states(id) }, data });
				return;
			case "countries":
				if (where.countries !== undefined) await this.tx.country.updateMany({ where: { ...LIVE, ...where.countries(id) }, data });
				return;
			case "subregions":
				if (where.subregions !== undefined) await this.tx.subregion.updateMany({ where: { ...LIVE, ...where.subregions(id) }, data });
				return;
			default:
				return assertNever(level);
		}
	}

	public async liveIds(entity: GeoParentKind, ids: ReadonlySet<number>): Promise<ReadonlySet<number>> {
		if (ids.size === 0) {
			return new Set<number>();
		}
		return new Set<number>((await LIVE_IDS[entity](this.tx, [...ids])).map((row): number => row.id));
	}

	public async liveNamedRows(entity: GeoEntityKind, names: readonly string[]): Promise<readonly GeoNamedRow[]> {
		return names.length === 0 ? [] : LIVE_NAMED_ROWS[entity](this.tx, [...names]);
	}

	public async touch(entity: GeoEntityKind, ids: readonly number[], at: EpochMs): Promise<void> {
		if (ids.length === 0) {
			return;
		}
		await TOUCH_ROWS[entity](this.tx, { where: { id: { in: [...ids] }, isDeleted: false }, data: { updatedAt: BigInt(at) } });
	}

	/** Bulk INSERT in bounded chunks (one statement per table per chunk). */
	public async insertImportRows(rows: readonly GeoImportRow[]): Promise<void> {
		for (let start = 0; start < rows.length; start += GEO_IMPORT_INSERT_CHUNK_SIZE) {
			const chunk: readonly GeoImportRow[] = rows.slice(start, start + GEO_IMPORT_INSERT_CHUNK_SIZE);
			await this.tx.region.createMany({ data: chunk.flatMap((r): Prisma.RegionCreateManyInput[] => (r.entity === "region" ? [{ name: r.row.name }] : [])) });
			await this.tx.subregion.createMany({
				data: chunk.flatMap((r): Prisma.SubregionCreateManyInput[] => (r.entity === "subregion" ? [{ name: r.row.name, regionId: r.row.regionId }] : [])),
			});
			await this.tx.country.createMany({ data: chunk.flatMap((r): Prisma.CountryCreateManyInput[] => (r.entity === "country" ? [{ name: r.row.name }] : [])) });
			await this.tx.state.createMany({
				data: chunk.flatMap((r): Prisma.StateCreateManyInput[] =>
					r.entity === "state" ? [{ name: r.row.name, countryId: r.row.countryId, countryCode: r.row.countryCode }] : [],
				),
			});
			await this.tx.city.createMany({
				data: chunk.flatMap((r): Prisma.CityCreateManyInput[] =>
					r.entity === "city"
						? [
								{
									name: r.row.name,
									stateId: r.row.stateId,
									countryId: r.row.countryId,
									stateCode: r.row.stateCode,
									countryCode: r.row.countryCode,
									latitude: IMPORTED_CITY_COORDINATE,
									longitude: IMPORTED_CITY_COORDINATE,
								},
							]
						: [],
				),
			});
		}
	}
}

function assertNever(value: never): never {
	throw new Error(`Unhandled geo cascade level: ${JSON.stringify(value)}`);
}
