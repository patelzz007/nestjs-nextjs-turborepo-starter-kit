import {
	CityListQuerySchema,
	epochMs,
	type CreateCityInput,
	type CreateCountryInput,
	type CreateRegionInput,
	type CreateStateInput,
	type CreateSubregionInput,
} from "@workspace/shared";
import { beforeEach, describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { AuthenticationError, NotFoundError, ValidationError } from "../../../../platform/application/errors/app-error";
import { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import { GEO_WRITE_OPERATION } from "../ports/reference-data.tokens";
import type { ReferenceDataScope } from "../reference-data-scope";
import { GeographyApplicationService } from "../services/geography.application-service";
import { InMemoryGeographyRead, rootKey } from "./fakes/in-memory-geography-read";
import { InMemoryGeographyRepository } from "./fakes/in-memory-geography.repository";
import { RecordingRequestAudit } from "./fakes/recording-request-audit";

const NOW = epochMs(1_790_812_800_000);
const SUPERADMIN_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST = { requestId: "req-1", ip: "203.0.113.7", userAgent: null, deviceLabel: null, endpoint: "/api/v1/geo/regions" };

const SUPERADMIN: ActorContext = {
	kind: "user",
	userId: SUPERADMIN_ID,
	sessionId: "session-1",
	organizationId: null,
	isSuperAdmin: true,
	accessScope: "superadmin",
	impersonatorUserId: null,
	request: REQUEST,
	routeRlsBypass: false,
};
const API_KEY: ActorContext = { kind: "api_key", apiKeyId: "key-1", organizationId: "org-1", locationId: null, terminalId: null, request: REQUEST, routeRlsBypass: false };
const ANONYMOUS: ActorContext = { kind: "anonymous", organizationId: null, request: REQUEST, routeRlsBypass: false };
const SYSTEM: ActorContext = { kind: "system", operation: GEO_WRITE_OPERATION, origin: "cli", organizationId: null, actorUserId: SUPERADMIN_ID, reason: "seed" };

const REGION_INPUT: CreateRegionInput = { name: " <b>Asia</b> ", flag: true };

function subregionInput(regionId: number): CreateSubregionInput {
	return { name: "South-Eastern Asia", regionId, flag: true };
}
function countryInput(fields: Partial<CreateCountryInput>): CreateCountryInput {
	return { name: "Malaysia", flag: true, ...fields };
}
function stateInput(countryId: number): CreateStateInput {
	return { name: "Selangor", countryCode: "MY", countryId, flag: true };
}
function cityInput(stateId: number, countryId: number): CreateCityInput {
	return { name: "Klang", stateCode: "10", countryCode: "MY", stateId, countryId, latitude: 3, longitude: 101, flag: true };
}

describe("GeographyApplicationService", () => {
	let geography: InMemoryGeographyRepository;
	let audit: RecordingRequestAudit;
	let unitOfWork: InMemoryUnitOfWork<ReferenceDataScope>;
	let reads: InMemoryGeographyRead;
	let service: GeographyApplicationService;

	beforeEach(() => {
		geography = new InMemoryGeographyRepository();
		audit = new RecordingRequestAudit();
		unitOfWork = new InMemoryUnitOfWork<ReferenceDataScope>({ geography, requestAudit: audit, events: new TransactionalEventCollector() });
		reads = new InMemoryGeographyRead();
		service = new GeographyApplicationService(unitOfWork, reads, new FixedClock(NOW));
	});

	describe("writes", () => {
		it("run under geo.reference_data.write as the actor, and audit the result in the same unit of work", async () => {
			const region = await service.createRegion(SUPERADMIN, REGION_INPUT);

			expect(unitOfWork.committed).toEqual([{ actor: SUPERADMIN, operation: GEO_WRITE_OPERATION }]);
			expect(audit.recorded).toEqual([region]);
		});

		it("sanitise the name before it is stored", async () => {
			expect((await service.createRegion(SUPERADMIN, REGION_INPUT)).name).toBe("Asia");
		});

		it.each<[string, ActorContext]>([
			["an API key", API_KEY],
			["an anonymous caller", ANONYMOUS],
			["a system actor", SYSTEM],
		])("refuse %s before opening a transaction", async (_label, actor) => {
			await expect(service.createRegion(actor, REGION_INPUT)).rejects.toThrow(new AuthenticationError({ message: "Geo writes require an authenticated SuperAdmin." }));
			expect(unitOfWork.committed).toEqual([]);
			expect(unitOfWork.rolledBack).toEqual([]);
			expect(geography.calls).toEqual([]);
		});

		it("roll back — and answer the error — when the audit row cannot be written", async () => {
			audit.failWith = new Error("audit_logs unavailable");

			await expect(service.createRegion(SUPERADMIN, REGION_INPUT)).rejects.toThrow("audit_logs unavailable");
			expect(unitOfWork.committed).toEqual([]);
			expect(unitOfWork.rolledBack).toEqual([SUPERADMIN]);
		});

		it("roll back, and write no audit row, when the change itself fails", async () => {
			await expect(service.updateRegion(SUPERADMIN, 404, { name: "Nowhere" })).rejects.toBeInstanceOf(NotFoundError);
			expect(audit.recorded).toEqual([]);
			expect(unitOfWork.rolledBack).toEqual([SUPERADMIN]);
		});
	});

	describe("updates", () => {
		it.each<["region" | "subregion" | "country" | "state" | "city", string]>([
			["region", "Region #404 not found"],
			["subregion", "Subregion #404 not found"],
			["country", "Country #404 not found"],
			["state", "State #404 not found"],
			["city", "City #404 not found"],
		])("answer 404 for a missing %s", async (entity, message) => {
			const update = {
				region: (): Promise<object> => service.updateRegion(SUPERADMIN, 404, {}),
				subregion: (): Promise<object> => service.updateSubregion(SUPERADMIN, 404, {}),
				country: (): Promise<object> => service.updateCountry(SUPERADMIN, 404, {}),
				state: (): Promise<object> => service.updateState(SUPERADMIN, 404, {}),
				city: (): Promise<object> => service.updateCity(SUPERADMIN, 404, {}),
			}[entity];
			await expect(update()).rejects.toThrow(new NotFoundError({ message }));
		});

		it("answer 404 for a soft-deleted row (never resurrect it)", async () => {
			const id = geography.seed("region", { name: "Gone", isDeleted: true });

			await expect(service.updateRegion(SUPERADMIN, id, { name: "Back" })).rejects.toBeInstanceOf(NotFoundError);
			expect(geography.row("region", id)).toMatchObject({ name: "Gone", isDeleted: true });
		});

		it("rename a live row, sanitised", async () => {
			const id = geography.seed("region", { name: "Asia" });

			expect(await service.updateRegion(SUPERADMIN, id, { name: "<i>Asia Pacific</i>" })).toMatchObject({ id, name: "Asia Pacific", updatedAt: NOW });
		});

		it("check a new parent only when the update names one", async () => {
			const id = geography.seed("subregion", { name: "SEA", regionId: 1 });

			await service.updateSubregion(SUPERADMIN, id, { name: "SE Asia" });

			expect(geography.calls.some((call) => call.startsWith("isLive"))).toBe(false);
		});
	});

	describe("parents", () => {
		it("refuse a subregion of a soft-deleted region with the missing-parent validation error", async () => {
			const regionId = geography.seed("region", { name: "Gone", isDeleted: true });

			const failure = service.createSubregion(SUPERADMIN, subregionInput(regionId));

			await expect(failure).rejects.toBeInstanceOf(ValidationError);
			await expect(failure).rejects.toMatchObject({
				message: "regionId does not reference an existing region",
				details: { issues: [{ path: "regionId", message: `region #${String(regionId)} does not exist`, code: "VALIDATION_ERROR" }] },
			});
			expect(geography.calls).not.toContain("createSubregion");
		});

		it("accept a subregion of a live region", async () => {
			const regionId = geography.seed("region", { name: "Asia" });

			expect(await service.createSubregion(SUPERADMIN, subregionInput(regionId))).toMatchObject({ regionId });
		});

		it("check a country's region and subregion, and allow detaching both with null", async () => {
			await expect(service.createCountry(SUPERADMIN, countryInput({ regionId: 404 }))).rejects.toMatchObject({ message: "regionId does not reference an existing region" });
			await expect(service.createCountry(SUPERADMIN, countryInput({ subregionId: 404 }))).rejects.toMatchObject({
				message: "subregionId does not reference an existing subregion",
			});
			const id = geography.seed("country", { name: "Malaysia", regionId: 1 });
			expect(await service.updateCountry(SUPERADMIN, id, { regionId: null, subregionId: null })).toMatchObject({ regionId: null, subregionId: null });
		});

		it("check a state's country", async () => {
			await expect(service.createState(SUPERADMIN, stateInput(404))).rejects.toMatchObject({ message: "countryId does not reference an existing country" });
		});

		it("check a city's state first, then its country", async () => {
			const stateId = geography.seed("state", { name: "Selangor", countryId: 999 });

			await expect(service.createCity(SUPERADMIN, cityInput(404, 999))).rejects.toMatchObject({ message: "stateId does not reference an existing state" });
			await expect(service.createCity(SUPERADMIN, cityInput(stateId, 999))).rejects.toMatchObject({ message: "countryId does not reference an existing country" });
		});
	});

	describe("deletes", () => {
		function seedTree(): {
			readonly region: number;
			readonly subregion: number;
			readonly country: number;
			readonly state: number;
			readonly city: number;
			readonly otherCity: number;
		} {
			const region = geography.seed("region", { name: "Asia" });
			const subregion = geography.seed("subregion", { name: "SEA", regionId: region });
			const country = geography.seed("country", { name: "Malaysia", regionId: region, subregionId: subregion });
			const state = geography.seed("state", { name: "Selangor", countryId: country });
			const city = geography.seed("city", { name: "Klang", stateId: state, countryId: country });
			const otherCountry = geography.seed("country", { name: "Japan" });
			const otherState = geography.seed("state", { name: "Tokyo", countryId: otherCountry });
			const otherCity = geography.seed("city", { name: "Shinjuku", stateId: otherState, countryId: otherCountry });
			return { region, subregion, country, state, city, otherCity };
		}

		it("soft-delete a region and everything under it, stamped with the actor and the clock, bottom-up", async () => {
			const tree = seedTree();

			expect(await service.deleteRegion(SUPERADMIN, tree.region)).toEqual({ message: `Region #${String(tree.region)} deleted` });

			const stamp = { isDeleted: true, deletedBy: SUPERADMIN_ID, deletedAt: NOW };
			expect(geography.row("region", tree.region)).toMatchObject(stamp);
			expect(geography.row("subregion", tree.subregion)).toMatchObject(stamp);
			expect(geography.row("country", tree.country)).toMatchObject(stamp);
			expect(geography.row("state", tree.state)).toMatchObject(stamp);
			expect(geography.row("city", tree.city)).toMatchObject(stamp);
			expect(geography.row("city", tree.otherCity)).toMatchObject({ isDeleted: false });
			expect(geography.calls.filter((call) => call.startsWith("softDelete"))).toEqual([
				`softDelete:region:${String(tree.region)}`,
				"softDeleteDescendants:region:cities",
				"softDeleteDescendants:region:states",
				"softDeleteDescendants:region:countries",
				"softDeleteDescendants:region:subregions",
			]);
		});

		it("soft-delete a state and only its cities", async () => {
			const tree = seedTree();

			await service.deleteState(SUPERADMIN, tree.state);

			expect(geography.row("city", tree.city)).toMatchObject({ isDeleted: true });
			expect(geography.row("country", tree.country)).toMatchObject({ isDeleted: false });
			expect(geography.calls.filter((call) => call.startsWith("softDeleteDescendants"))).toEqual(["softDeleteDescendants:state:cities"]);
		});

		it("soft-delete a city with no cascade", async () => {
			const tree = seedTree();

			expect(await service.deleteCity(SUPERADMIN, tree.city)).toEqual({ message: `City #${String(tree.city)} deleted` });
			expect(geography.calls.filter((call) => call.startsWith("softDeleteDescendants"))).toEqual([]);
		});

		it("answer 404 for an already deleted row and cascade nothing", async () => {
			const tree = seedTree();
			await service.deleteCountry(SUPERADMIN, tree.country);
			geography.calls.length = 0;

			await expect(service.deleteCountry(SUPERADMIN, tree.country)).rejects.toThrow(new NotFoundError({ message: `Country #${String(tree.country)} not found` }));
			expect(geography.calls).toEqual([`softDelete:country:${String(tree.country)}`]);
		});

		it("audit the delete's answer in the same unit of work", async () => {
			const tree = seedTree();

			const answer = await service.deleteSubregion(SUPERADMIN, tree.subregion);

			expect(audit.recorded).toEqual([answer]);
			expect(geography.row("country", tree.country)).toMatchObject({ isDeleted: true });
			expect(geography.row("region", tree.region)).toMatchObject({ isDeleted: false });
		});
	});

	describe("import", () => {
		it("takes the advisory lock before anything else", async () => {
			await service.importData(SUPERADMIN, { entity: "subregion", upsert: true, data: [{ name: "A", regionId: 1 }] });

			const [first] = geography.calls;
			expect(first).toBe("lockImports");
		});

		it("creates new rows, matches live ones by natural key with upsert, and reports bad rows in order", async () => {
			const asia = geography.seed("region", { name: "Asia" });

			const result = await service.importData(SUPERADMIN, { entity: "region", upsert: true, data: [{ name: "Asia" }, { name: "" }, { name: "Europe" }, { name: "Europe" }] });

			expect(result).toMatchObject({ created: 1, updated: 2, skipped: 1 });
			expect(result.errors.map((error) => error.row)).toEqual([2]);
			expect(result.errors.map((error) => error.message).join()).toContain("name");
			expect(geography.inserted.map((row) => row.row.name)).toEqual(["Europe"]);
			expect(geography.row("region", asia)).toMatchObject({ updatedAt: NOW });
			expect(audit.recorded).toEqual([result]);
		});

		it("without upsert, never reads the live natural keys and inserts duplicates", async () => {
			geography.seed("region", { name: "Asia" });

			const result = await service.importData(SUPERADMIN, { entity: "region", upsert: false, data: [{ name: "Asia" }] });

			expect(result.created).toBe(1);
			expect(geography.calls).not.toContain("liveNamedRows:region");
		});

		it("skips rows whose parent is not live, reading each parent table once", async () => {
			const live = geography.seed("region", { name: "Asia" });
			const gone = geography.seed("region", { name: "Gone", isDeleted: true });

			const result = await service.importData(SUPERADMIN, {
				entity: "subregion",
				upsert: false,
				data: [
					{ name: "A", regionId: live },
					{ name: "B", regionId: gone },
				],
			});

			expect(result).toMatchObject({ created: 1, skipped: 1, errors: [{ row: 2, message: `regionId ${String(gone)} does not reference an existing region` }] });
			expect(geography.calls.filter((call) => call.startsWith("liveIds"))).toEqual(["liveIds:region"]);
		});

		it("matches a city by name within its state", async () => {
			const countryId = geography.seed("country", { name: "Malaysia" });
			const stateId = geography.seed("state", { name: "Selangor", countryId });
			const klang = geography.seed("city", { name: "Klang", stateId, countryId });

			const result = await service.importData(SUPERADMIN, { entity: "city", upsert: true, data: [{ name: "Klang", stateId, countryId }] });

			expect(result).toMatchObject({ created: 0, updated: 1, skipped: 0 });
			expect(geography.row("city", klang)).toMatchObject({ updatedAt: NOW });
		});

		it("refuses a non-user actor before taking the lock", async () => {
			await expect(service.importData(API_KEY, { entity: "region", upsert: true, data: [{ name: "Asia" }] })).rejects.toBeInstanceOf(AuthenticationError);
			expect(geography.calls).toEqual([]);
		});

		it("validates without writing or opening a transaction", () => {
			expect(service.validateImport(SUPERADMIN, { entity: "region", data: [{ name: "Asia" }, {}] })).toMatchObject({ valid: false, totalRows: 2, validRows: 1 });
			expect(unitOfWork.committed).toEqual([]);
		});
	});

	describe("reads", () => {
		it("pass the actor to the read port", async () => {
			await service.getStats(SUPERADMIN);
			await service.listCities(API_KEY, CityListQuerySchema.parse({}));

			expect(reads.actors).toEqual([SUPERADMIN, API_KEY]);
		});

		it.each<["region" | "subregion" | "country" | "state" | "city", string]>([
			["region", "Region #7 not found"],
			["subregion", "Subregion #7 not found"],
			["country", "Country #7 not found"],
			["state", "State #7 not found"],
			["city", "City #7 not found"],
		])("answer 404 for a missing or soft-deleted %s", async (entity, message) => {
			const get = {
				region: (): Promise<object> => service.getRegion(SUPERADMIN, 7),
				subregion: (): Promise<object> => service.getSubregion(SUPERADMIN, 7),
				country: (): Promise<object> => service.getCountry(SUPERADMIN, 7),
				state: (): Promise<object> => service.getState(SUPERADMIN, 7),
				city: (): Promise<object> => service.getCity(SUPERADMIN, 7),
			}[entity];
			await expect(get()).rejects.toThrow(new NotFoundError({ message }));
		});

		it("preview a cascade over exactly the policy's levels", async () => {
			reads.cascadeRoots.set(rootKey("country", 5), "Malaysia");

			expect(await service.cascadePreview(SUPERADMIN, { entity: "country", id: 5 })).toEqual({
				entity: "country",
				id: 5,
				name: "Malaysia",
				willDelete: { states: 0, cities: 0 },
			});
			expect(reads.previews).toEqual([{ entity: "country", id: 5, levels: ["states", "cities"] }]);
		});

		it("answer 404 for a cascade preview of a missing root", async () => {
			await expect(service.cascadePreview(SUPERADMIN, { entity: "state", id: 5 })).rejects.toThrow(new NotFoundError({ message: "State #5 not found" }));
		});
	});
});
