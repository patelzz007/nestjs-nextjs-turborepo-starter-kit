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

import type { GeoChildLevel } from "../../../domain/policies/geo-cascade.policy";
import type { GeoImportRow } from "../../../domain/policies/geo-import.policy";
import type { GeoDeletionStamp, GeoNamedRow, GeographyRepository } from "../../../domain/repositories/geography.repository";
import type { GeoEntityKind, GeoParentKind } from "../../../domain/value-objects/geo-entity-kind.value-object";

/** Creation instant of every row the fake creates (the fake has no clock of its own). */
const FAKE_CREATED_AT = 1_790_812_800_000;
/** City coordinates the fake gives an imported city (the real repository uses 0,0 too). */
const IMPORTED_COORDINATE = 0;

/** One row of any geo table: its name, the parents it links to, and its lifecycle columns. */
export interface FakeGeoRow {
	readonly id: number;
	readonly name: string;
	readonly regionId: number | null;
	readonly subregionId: number | null;
	readonly countryId: number | null;
	readonly stateId: number | null;
	readonly isDeleted: boolean;
	readonly deletedBy: string | null;
	readonly deletedAt: number | null;
	readonly updatedAt: number;
}

type FakeTable = Map<number, FakeGeoRow>;

const CHILD_TABLE: Readonly<Record<GeoChildLevel, GeoEntityKind>> = { subregions: "subregion", countries: "country", states: "state", cities: "city" };

/**
 * A real, in-memory {@link GeographyRepository}: five tables, conditional
 * (live-only) updates and soft deletes, and the same cascade links as the
 * database (a region reaches states through their country, cities through
 * their state's country). `calls` records every port call in order, so a test
 * can assert the import lock came first. Updates apply the name and parent
 * links only (the columns these rules depend on).
 */
export class InMemoryGeographyRepository implements GeographyRepository {
	public readonly calls: string[] = [];
	public readonly inserted: GeoImportRow[] = [];
	private readonly tables: Readonly<Record<GeoEntityKind, FakeTable>> = {
		region: new Map(),
		subregion: new Map(),
		country: new Map(),
		state: new Map(),
		city: new Map(),
	};
	private nextId = 1;

	/** Seeds a row (live unless `isDeleted`), returning its id. */
	public seed(entity: GeoEntityKind, row: Partial<Omit<FakeGeoRow, "id">> & { readonly name: string }): number {
		const id = this.nextId;
		this.nextId += 1;
		this.tables[entity].set(id, {
			id,
			regionId: null,
			subregionId: null,
			countryId: null,
			stateId: null,
			isDeleted: false,
			deletedBy: null,
			deletedAt: null,
			updatedAt: FAKE_CREATED_AT,
			...row,
		});
		return id;
	}

	public row(entity: GeoEntityKind, id: number): FakeGeoRow | undefined {
		return this.tables[entity].get(id);
	}

	public lockImports(): Promise<void> {
		this.calls.push("lockImports");
		return Promise.resolve();
	}

	public isLive(entity: GeoParentKind, id: number): Promise<boolean> {
		this.calls.push(`isLive:${entity}:${String(id)}`);
		return Promise.resolve(this.live(entity, id) !== undefined);
	}

	public createRegion(input: CreateRegionInput): Promise<Region> {
		this.calls.push("createRegion");
		return Promise.resolve(regionDto(this.insert("region", { name: input.name })));
	}

	public updateRegion(id: number, input: UpdateRegionInput, updatedAt: EpochMs): Promise<Region | null> {
		this.calls.push("updateRegion");
		const row = this.update("region", id, { ...(input.name === undefined ? {} : { name: input.name }) }, updatedAt);
		return Promise.resolve(row === null ? null : regionDto(row));
	}

	public createSubregion(input: CreateSubregionInput): Promise<Subregion> {
		this.calls.push("createSubregion");
		return Promise.resolve(subregionDto(this.insert("subregion", { name: input.name, regionId: input.regionId })));
	}

	public updateSubregion(id: number, input: UpdateSubregionInput, updatedAt: EpochMs): Promise<Subregion | null> {
		this.calls.push("updateSubregion");
		const row = this.update(
			"subregion",
			id,
			{
				...(input.name === undefined ? {} : { name: input.name }),
				...(input.regionId === undefined ? {} : { regionId: input.regionId }),
			},
			updatedAt,
		);
		return Promise.resolve(row === null ? null : subregionDto(row));
	}

	public createCountry(input: CreateCountryInput): Promise<Country> {
		this.calls.push("createCountry");
		return Promise.resolve(countryDto(this.insert("country", { name: input.name, regionId: input.regionId ?? null, subregionId: input.subregionId ?? null })));
	}

	public updateCountry(id: number, input: UpdateCountryInput, updatedAt: EpochMs): Promise<Country | null> {
		this.calls.push("updateCountry");
		const row = this.update(
			"country",
			id,
			{
				...(input.name === undefined ? {} : { name: input.name }),
				...(input.regionId === undefined ? {} : { regionId: input.regionId }),
				...(input.subregionId === undefined ? {} : { subregionId: input.subregionId }),
			},
			updatedAt,
		);
		return Promise.resolve(row === null ? null : countryDto(row));
	}

	public createState(input: CreateStateInput): Promise<State> {
		this.calls.push("createState");
		return Promise.resolve(stateDto(this.insert("state", { name: input.name, countryId: input.countryId })));
	}

	public updateState(id: number, input: UpdateStateInput, updatedAt: EpochMs): Promise<State | null> {
		this.calls.push("updateState");
		const row = this.update(
			"state",
			id,
			{
				...(input.name === undefined ? {} : { name: input.name }),
				...(input.countryId === undefined ? {} : { countryId: input.countryId }),
			},
			updatedAt,
		);
		return Promise.resolve(row === null ? null : stateDto(row));
	}

	public createCity(input: CreateCityInput): Promise<City> {
		this.calls.push("createCity");
		return Promise.resolve(cityDto(this.insert("city", { name: input.name, stateId: input.stateId, countryId: input.countryId })));
	}

	public updateCity(id: number, input: UpdateCityInput, updatedAt: EpochMs): Promise<City | null> {
		this.calls.push("updateCity");
		const row = this.update(
			"city",
			id,
			{
				...(input.name === undefined ? {} : { name: input.name }),
				...(input.stateId === undefined ? {} : { stateId: input.stateId }),
				...(input.countryId === undefined ? {} : { countryId: input.countryId }),
			},
			updatedAt,
		);
		return Promise.resolve(row === null ? null : cityDto(row));
	}

	public softDelete(entity: GeoEntityKind, id: number, stamp: GeoDeletionStamp): Promise<boolean> {
		this.calls.push(`softDelete:${entity}:${String(id)}`);
		const row = this.live(entity, id);
		if (row === undefined) {
			return Promise.resolve(false);
		}
		this.tables[entity].set(id, deleted(row, stamp));
		return Promise.resolve(true);
	}

	public softDeleteDescendants(entity: GeoParentKind, id: number, level: GeoChildLevel, stamp: GeoDeletionStamp): Promise<void> {
		this.calls.push(`softDeleteDescendants:${entity}:${level}`);
		const child = CHILD_TABLE[level];
		for (const row of this.tables[child].values()) {
			if (!row.isDeleted && this.descendsFrom(child, row, entity, id)) {
				this.tables[child].set(row.id, deleted(row, stamp));
			}
		}
		return Promise.resolve();
	}

	public liveIds(entity: GeoParentKind, ids: ReadonlySet<number>): Promise<ReadonlySet<number>> {
		this.calls.push(`liveIds:${entity}`);
		return Promise.resolve(new Set([...ids].filter((id) => this.live(entity, id) !== undefined)));
	}

	public liveNamedRows(entity: GeoEntityKind, names: readonly string[]): Promise<readonly GeoNamedRow[]> {
		this.calls.push(`liveNamedRows:${entity}`);
		const parentOf = (row: FakeGeoRow): number | null => (entity === "subregion" ? row.regionId : entity === "state" ? row.countryId : entity === "city" ? row.stateId : null);
		return Promise.resolve(
			[...this.tables[entity].values()]
				.filter((row) => !row.isDeleted && names.includes(row.name))
				.map((row): GeoNamedRow => ({ id: row.id, name: row.name, parentId: parentOf(row) })),
		);
	}

	public touch(entity: GeoEntityKind, ids: readonly number[], at: EpochMs): Promise<void> {
		this.calls.push(`touch:${entity}`);
		for (const id of ids) {
			const row = this.live(entity, id);
			if (row !== undefined) {
				this.tables[entity].set(id, { ...row, updatedAt: at });
			}
		}
		return Promise.resolve();
	}

	public insertImportRows(rows: readonly GeoImportRow[]): Promise<void> {
		this.calls.push("insertImportRows");
		for (const imported of rows) {
			this.inserted.push(imported);
			const { entity, row } = imported;
			this.insert(entity, {
				name: row.name,
				...(imported.entity === "subregion" ? { regionId: imported.row.regionId } : {}),
				...(imported.entity === "state" ? { countryId: imported.row.countryId } : {}),
				...(imported.entity === "city" ? { stateId: imported.row.stateId, countryId: imported.row.countryId } : {}),
			});
		}
		return Promise.resolve();
	}

	private live(entity: GeoEntityKind, id: number): FakeGeoRow | undefined {
		const row = this.tables[entity].get(id);
		return row === undefined || row.isDeleted ? undefined : row;
	}

	private insert(entity: GeoEntityKind, fields: Partial<Omit<FakeGeoRow, "id">> & { readonly name: string }): FakeGeoRow {
		const id = this.seed(entity, fields);
		const row = this.tables[entity].get(id);
		if (row === undefined) {
			throw new Error("fake insert lost its row");
		}
		return row;
	}

	private update(entity: GeoEntityKind, id: number, fields: Partial<Omit<FakeGeoRow, "id">>, updatedAt: EpochMs): FakeGeoRow | null {
		const row = this.live(entity, id);
		if (row === undefined) {
			return null;
		}
		const next: FakeGeoRow = { ...row, ...fields, updatedAt };
		this.tables[entity].set(id, next);
		return next;
	}

	/** Whether `row` of table `child` sits under root `entity` #`id` — the database's cascade links. */
	private descendsFrom(child: GeoEntityKind, row: FakeGeoRow, entity: GeoParentKind, id: number): boolean {
		const countryOf = (countryId: number | null): FakeGeoRow | undefined => (countryId === null ? undefined : this.tables.country.get(countryId));
		const stateOf = (stateId: number | null): FakeGeoRow | undefined => (stateId === null ? undefined : this.tables.state.get(stateId));
		const linkField = entity === "region" ? "regionId" : entity === "subregion" ? "subregionId" : entity === "country" ? "countryId" : "stateId";
		if (child === "subregion" || child === "country") {
			return row[linkField] === id;
		}
		if (child === "state") {
			return entity === "country" ? row.countryId === id : countryOf(row.countryId)?.[linkField] === id;
		}
		if (entity === "country" || entity === "state") {
			return row[linkField] === id;
		}
		return countryOf(stateOf(row.stateId)?.countryId ?? null)?.[linkField] === id;
	}
}

function deleted(row: FakeGeoRow, stamp: GeoDeletionStamp): FakeGeoRow {
	return { ...row, isDeleted: true, deletedBy: stamp.deletedBy, deletedAt: stamp.deletedAt, updatedAt: stamp.deletedAt };
}

function requireLink(value: number | null, field: string): number {
	if (value === null) {
		throw new Error(`fake row has no ${field}`);
	}
	return value;
}

const COMMON = { translations: null, wikiDataId: null, flag: true, createdAt: FAKE_CREATED_AT } satisfies Partial<Region>;

function regionDto(row: FakeGeoRow): Region {
	return { id: row.id, name: row.name, ...COMMON, updatedAt: row.updatedAt };
}

function subregionDto(row: FakeGeoRow): Subregion {
	return { id: row.id, name: row.name, ...COMMON, regionId: requireLink(row.regionId, "regionId"), updatedAt: row.updatedAt };
}

function countryDto(row: FakeGeoRow): Country {
	return {
		id: row.id,
		name: row.name,
		iso3: null,
		numericCode: null,
		iso2: null,
		phonecode: null,
		capital: null,
		currency: null,
		currencyName: null,
		currencySymbol: null,
		tld: null,
		native: null,
		population: null,
		gdp: null,
		region: null,
		subregion: null,
		nationality: null,
		timezones: null,
		latitude: null,
		longitude: null,
		emoji: null,
		emojiU: null,
		...COMMON,
		regionId: row.regionId,
		subregionId: row.subregionId,
		updatedAt: row.updatedAt,
	};
}

function stateDto(row: FakeGeoRow): State {
	return {
		id: row.id,
		name: row.name,
		countryCode: "",
		fipsCode: null,
		iso2: null,
		iso3166_2: null,
		type: null,
		level: null,
		parentId: null,
		native: null,
		latitude: null,
		longitude: null,
		timezone: null,
		...COMMON,
		countryId: requireLink(row.countryId, "countryId"),
		updatedAt: row.updatedAt,
	};
}

function cityDto(row: FakeGeoRow): City {
	return {
		id: row.id,
		name: row.name,
		stateCode: "",
		countryCode: "",
		latitude: IMPORTED_COORDINATE,
		longitude: IMPORTED_COORDINATE,
		native: null,
		timezone: null,
		...COMMON,
		stateId: requireLink(row.stateId, "stateId"),
		countryId: requireLink(row.countryId, "countryId"),
		updatedAt: row.updatedAt,
	};
}
