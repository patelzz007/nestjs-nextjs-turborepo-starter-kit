import { API_VERSION_PREFIX } from "@workspace/shared";

import { toAuditLogCreateInput } from "../../src/common/audit/audit-log.mapper";
import { toAuditPayload } from "../../src/common/audit/http-audit-entry";

import { prisma } from "./client";
import { entry, NO_MACHINE_PRINCIPAL, NO_TENANT } from "./http-audit";

// ---------------------------------------------------------------------------
// Geo reference-data history a SuperAdmin leaves behind — demo rows.
//
// The upstream dataset (dr5hn/countries-states-cities-database) is the baseline; this adds what only
// the geo write API produces, through the same shapes the repository writes:
//
//   - a whole retired subtree (region > subregion > country > state > city) soft-deleted in ONE
//     stamp exactly as `DELETE /geo/regions/:id` cascades it (`GeoRepository.deleteRegion`):
//     `is_deleted`, `deleted_at` and `deleted_by` on every level;
//   - a city a SuperAdmin enriched with `native`, `translations` and `wikiDataId` through
//     `PATCH /geo/cities/:id` — the upstream city list carries only id/name/coordinates/timezone,
//     so these three columns are only ever written by the API.
//
// Each change has its `audit_logs` row (redacted payloads, the app's row mapping). Idempotent: rows
// are found by their natural key and written once; audit rows are upserted on deterministic ids.
// ---------------------------------------------------------------------------

/** Fixed demo clock of the soft delete — the cascade stamps every level with this instant. */
const DEMO_DELETED_AT_MS = 1_788_253_200_000 + 10 * 60_000;
/** Audit-row indices of `entry()` (each number is used once across the seed modules; 0-6 are taken). */
const REGION_DELETE_AUDIT_INDEX = 10;
const CITY_ENRICH_AUDIT_INDEX = 11;

const DEMO_REGION_NAME = "Demo Archipelago (soft-deleted)";
const DEMO_SUBREGION_NAME = "Demo Archipelago North (soft-deleted)";
const DEMO_COUNTRY_NAME = "Demo Archipelago Republic (soft-deleted)";
/** ISO 3166-1 user-assigned alpha-2 / alpha-3 / numeric codes: guaranteed never to name a real country. */
const DEMO_COUNTRY_ISO2 = "ZZ";
const DEMO_COUNTRY_ISO3 = "ZZZ";
const DEMO_COUNTRY_NUMERIC_CODE = "999";
const DEMO_STATE_NAME = "Demo Archipelago Central Province (soft-deleted)";
const DEMO_CITY_NAME = "Demo Archipelago Harbour (soft-deleted)";

/** The upstream Kuala Lumpur city the SuperAdmin enriched (Wikidata item of the city). */
const ENRICHED_CITY = { name: "Kuala Lumpur", countryCode: "MY" };
const ENRICHED_CITY_NATIVE = "Kuala Lumpur";
const ENRICHED_CITY_WIKIDATA_ID = "Q1865";
const ENRICHED_CITY_TRANSLATIONS = {
	ms: "Kuala Lumpur",
	zh: "吉隆坡",
	ta: "கோலாலம்பூர்",
	ja: "クアラルンプール",
	ko: "쿠알라룸푸르",
};

export interface GeoDemoSummary {
	readonly softDeletedRows: number;
	readonly enrichedCities: number;
	readonly auditRows: number;
}

interface SoftDeleteStamp {
	readonly isDeleted: true;
	readonly deletedAt: bigint;
	readonly deletedBy: string;
}

/** The retired subtree, written already soft-deleted (the cascade of `deleteRegion` leaves exactly this). Returns the region id. */
async function ensureRetiredSubtree(stamp: SoftDeleteStamp): Promise<number> {
	const region =
		(await prisma.region.findFirst({ where: { name: DEMO_REGION_NAME } })) ??
		(await prisma.region.create({ data: { name: DEMO_REGION_NAME, translations: { ms: "Kepulauan Demo" }, wikiDataId: null, ...stamp } }));
	const subregion =
		(await prisma.subregion.findFirst({ where: { name: DEMO_SUBREGION_NAME, regionId: region.id } })) ??
		(await prisma.subregion.create({ data: { name: DEMO_SUBREGION_NAME, regionId: region.id, translations: { ms: "Kepulauan Demo Utara" }, ...stamp } }));
	const country =
		(await prisma.country.findFirst({ where: { iso2: DEMO_COUNTRY_ISO2 } })) ??
		(await prisma.country.create({
			data: {
				name: DEMO_COUNTRY_NAME,
				iso2: DEMO_COUNTRY_ISO2,
				iso3: DEMO_COUNTRY_ISO3,
				numericCode: DEMO_COUNTRY_NUMERIC_CODE,
				phonecode: "999",
				capital: "Demo Harbour",
				currency: "DAD",
				currencyName: "Demo dollar",
				currencySymbol: "D$",
				tld: ".zz",
				native: "Republik Kepulauan Demo",
				nationality: "Demonian",
				region: DEMO_REGION_NAME,
				subregion: DEMO_SUBREGION_NAME,
				timezones: [{ zoneName: "Etc/UTC", gmtOffset: 0, gmtOffsetName: "UTC+00:00", abbreviation: "UTC", tzName: "Coordinated Universal Time" }],
				translations: { ms: "Republik Kepulauan Demo" },
				latitude: 1.5,
				longitude: 103.5,
				regionId: region.id,
				subregionId: subregion.id,
				...stamp,
			},
		}));
	const state =
		(await prisma.state.findFirst({ where: { name: DEMO_STATE_NAME, countryId: country.id } })) ??
		(await prisma.state.create({
			data: {
				name: DEMO_STATE_NAME,
				countryId: country.id,
				countryCode: DEMO_COUNTRY_ISO2,
				iso2: "CP",
				iso3166_2: `${DEMO_COUNTRY_ISO2}-CP`,
				type: "province",
				native: "Wilayah Tengah Kepulauan Demo",
				timezone: "Etc/UTC",
				latitude: 1.5,
				longitude: 103.5,
				...stamp,
			},
		}));
	const existingCity = await prisma.city.findFirst({ where: { name: DEMO_CITY_NAME, stateId: state.id } });
	if (existingCity === null) {
		await prisma.city.create({
			data: {
				name: DEMO_CITY_NAME,
				stateId: state.id,
				countryId: country.id,
				stateCode: "CP",
				countryCode: DEMO_COUNTRY_ISO2,
				latitude: 1.5,
				longitude: 103.5,
				timezone: "Etc/UTC",
				...stamp,
			},
		});
	}
	return region.id;
}

/** The SuperAdmin's `PATCH /geo/cities/:id`: fills the three columns the upstream list never carries. Returns the city id, or null when the dataset has no such city. */
async function ensureEnrichedCity(): Promise<number | null> {
	const city = await prisma.city.findFirst({ where: { ...ENRICHED_CITY, isDeleted: false }, orderBy: { id: "asc" } });
	if (city === null) {
		return null;
	}
	if (city.native === null || city.wikiDataId === null) {
		await prisma.city.update({
			where: { id: city.id },
			data: { native: ENRICHED_CITY_NATIVE, translations: ENRICHED_CITY_TRANSLATIONS, wikiDataId: ENRICHED_CITY_WIKIDATA_ID },
		});
	}
	return city.id;
}

export async function seedGeoDemo(superAdminId: string): Promise<GeoDemoSummary> {
	const stamp: SoftDeleteStamp = { isDeleted: true, deletedAt: BigInt(DEMO_DELETED_AT_MS), deletedBy: superAdminId };
	const regionId = await ensureRetiredSubtree(stamp);
	const cityId = await ensureEnrichedCity();

	const regionPath = `${API_VERSION_PREFIX}/geo/regions/${String(regionId)}`;
	const rows = [
		entry(REGION_DELETE_AUDIT_INDEX, {
			method: "DELETE",
			endpoint: `${API_VERSION_PREFIX}/geo/regions/:id`,
			path: regionPath,
			outcome: "SUCCEEDED",
			responseStatus: 200,
			errorCode: null,
			actorUserId: superAdminId,
			impersonatorUserId: null,
			...NO_MACHINE_PRINCIPAL,
			...NO_TENANT,
			requestParams: toAuditPayload({ params: { id: String(regionId) }, query: {} }),
			requestBody: null,
			responseBody: toAuditPayload({ message: `Region #${String(regionId)} deleted` }),
			systemOperations: ["platform.superadmin", "geo.reference_data.write"],
		}),
	];
	if (cityId !== null) {
		rows.push(
			entry(CITY_ENRICH_AUDIT_INDEX, {
				method: "PATCH",
				endpoint: `${API_VERSION_PREFIX}/geo/cities/:id`,
				path: `${API_VERSION_PREFIX}/geo/cities/${String(cityId)}`,
				outcome: "SUCCEEDED",
				responseStatus: 200,
				errorCode: null,
				actorUserId: superAdminId,
				impersonatorUserId: null,
				...NO_MACHINE_PRINCIPAL,
				...NO_TENANT,
				requestParams: toAuditPayload({ params: { id: String(cityId) }, query: {} }),
				requestBody: toAuditPayload({ native: ENRICHED_CITY_NATIVE, translations: ENRICHED_CITY_TRANSLATIONS, wikiDataId: ENRICHED_CITY_WIKIDATA_ID }),
				responseBody: toAuditPayload({ success: true, data: { id: cityId, name: ENRICHED_CITY.name, wikiDataId: ENRICHED_CITY_WIKIDATA_ID } }),
				systemOperations: ["platform.superadmin", "geo.reference_data.write"],
			}),
		);
	}
	for (const { id, row } of rows) {
		await prisma.auditLog.upsert({ where: { id }, create: { id, ...toAuditLogCreateInput(row) }, update: {} });
	}
	return { softDeletedRows: 5, enrichedCities: cityId === null ? 0 : 1, auditRows: rows.length };
}
