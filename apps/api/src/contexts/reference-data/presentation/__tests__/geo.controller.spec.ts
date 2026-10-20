import { HttpStatus, RequestMethod } from "@nestjs/common";
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { Reflector } from "@nestjs/core";
import { API_VERSION_PREFIX, epochMs, type PermissionAction } from "@workspace/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { InMemoryUnitOfWork } from "../../../../platform/application/__tests__/fakes/in-memory-unit-of-work";
import { AUTHORIZE_KEY } from "../../../../platform/presentation/http/security/decorators/authorize.decorator";
import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { SUPER_ADMIN_KEY } from "../../../../platform/presentation/http/security/decorators/super-admin.decorator";
import { SuperAdminGuard } from "../../../../platform/presentation/http/security/guards/super-admin.guard";
import { RATE_LIMIT_POLICY, RATE_LIMIT_POLICY_KEY } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { getResponseContract } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { InMemoryGeographyRead } from "../../application/__tests__/fakes/in-memory-geography-read";
import { InMemoryGeographyRepository } from "../../application/__tests__/fakes/in-memory-geography.repository";
import { RecordingRequestAudit } from "../../application/__tests__/fakes/recording-request-audit";
import type { ReferenceDataScope } from "../../application/reference-data-scope";
import { GeographyApplicationService } from "../../application/services/geography.application-service";
import { GeoController } from "../http/geo.controller";

const reflector = new Reflector();
/** The metadata key `@RequirePermission` stores its requirement under. */
const REQUIRED_PERMISSION_KEY: string = z.string().parse(RequirePermission("READ", "GEO").KEY);

/** Every public member of the controller is a route handler. */
type RouteName = keyof GeoController;

interface ExpectedRoute {
	readonly name: RouteName;
	readonly method: RequestMethod;
	readonly path: string;
	readonly action: PermissionAction;
	/** SuperAdmin-only and rate-limited as an authenticated mutation. */
	readonly write: boolean;
	readonly contract: "single" | "paginated";
	readonly status: HttpStatus;
}

function route(name: RouteName, method: RequestMethod, path: string, action: PermissionAction, contract: "single" | "paginated" = "single"): ExpectedRoute {
	const write = method !== RequestMethod.GET && name !== "validateImport";
	const status = method === RequestMethod.POST ? HttpStatus.CREATED : HttpStatus.OK;
	return { name, method, path, action, write, contract, status };
}

const ROUTES: readonly ExpectedRoute[] = [
	route("getStats", RequestMethod.GET, "stats", "READ"),
	route("autocomplete", RequestMethod.GET, "autocomplete", "READ"),
	route("importData", RequestMethod.POST, "import", "CREATE"),
	route("validateImport", RequestMethod.POST, "import/validate", "READ"),
	route("exportData", RequestMethod.GET, "export", "READ"),
	route("cascadePreview", RequestMethod.GET, "cascade-preview", "READ"),
	route("listRegions", RequestMethod.GET, "regions", "READ", "paginated"),
	route("getRegion", RequestMethod.GET, "regions/:id", "READ"),
	route("createRegion", RequestMethod.POST, "regions", "CREATE"),
	route("updateRegion", RequestMethod.PATCH, "regions/:id", "UPDATE"),
	route("deleteRegion", RequestMethod.DELETE, "regions/:id", "DELETE"),
	route("listSubregions", RequestMethod.GET, "subregions", "READ", "paginated"),
	route("getSubregion", RequestMethod.GET, "subregions/:id", "READ"),
	route("createSubregion", RequestMethod.POST, "subregions", "CREATE"),
	route("updateSubregion", RequestMethod.PATCH, "subregions/:id", "UPDATE"),
	route("deleteSubregion", RequestMethod.DELETE, "subregions/:id", "DELETE"),
	route("listCountries", RequestMethod.GET, "countries", "READ", "paginated"),
	route("getCountry", RequestMethod.GET, "countries/:id", "READ"),
	route("createCountry", RequestMethod.POST, "countries", "CREATE"),
	route("updateCountry", RequestMethod.PATCH, "countries/:id", "UPDATE"),
	route("deleteCountry", RequestMethod.DELETE, "countries/:id", "DELETE"),
	route("listStates", RequestMethod.GET, "states", "READ", "paginated"),
	route("getState", RequestMethod.GET, "states/:id", "READ"),
	route("createState", RequestMethod.POST, "states", "CREATE"),
	route("updateState", RequestMethod.PATCH, "states/:id", "UPDATE"),
	route("deleteState", RequestMethod.DELETE, "states/:id", "DELETE"),
	route("listCities", RequestMethod.GET, "cities", "READ", "paginated"),
	route("getCity", RequestMethod.GET, "cities/:id", "READ"),
	route("createCity", RequestMethod.POST, "cities", "CREATE"),
	route("updateCity", RequestMethod.PATCH, "cities/:id", "UPDATE"),
	route("deleteCity", RequestMethod.DELETE, "cities/:id", "DELETE"),
];

function handlerOf(name: RouteName): GeoController[RouteName] {
	const descriptor: TypedPropertyDescriptor<GeoController[RouteName]> | undefined = Object.getOwnPropertyDescriptor(GeoController.prototype, name);
	const handler = descriptor?.value;
	if (handler === undefined) {
		throw new Error(`GeoController.${name} is not a method`);
	}
	return handler;
}

describe("GeoController routes", () => {
	it("is served under the versioned /geo prefix", () => {
		expect(reflector.get<string>(PATH_METADATA, GeoController)).toBe(`${API_VERSION_PREFIX}/geo`);
	});

	it("has exactly the routes it had before the migration", () => {
		const methods = Object.getOwnPropertyNames(GeoController.prototype).filter((name) => name !== "constructor");
		expect(methods.sort()).toEqual(ROUTES.map((expected) => expected.name).sort());
	});

	it.each(ROUTES)("$name: $method $path needs $action GEO", (expected) => {
		const handler = handlerOf(expected.name);
		expect(reflector.get<string>(PATH_METADATA, handler)).toBe(expected.path);
		expect(reflector.get<RequestMethod>(METHOD_METADATA, handler)).toBe(expected.method);
		expect(reflector.get<object>(REQUIRED_PERMISSION_KEY, handler)).toEqual({ action: expected.action, resource: "GEO" });
	});

	it.each(ROUTES)("$name: one $contract response contract answering $status", (expected) => {
		expect(getResponseContract(handlerOf(expected.name))).toMatchObject({ kind: expected.contract, status: expected.status });
	});

	it.each(ROUTES)("$name: SuperAdmin-only and rate-limited exactly when it writes", (expected) => {
		const handler = handlerOf(expected.name);
		expect(reflector.get<boolean | undefined>(SUPER_ADMIN_KEY, handler)).toBe(expected.write ? true : undefined);
		expect(reflector.get<readonly object[] | undefined>(GUARDS_METADATA, handler)?.includes(SuperAdminGuard) ?? false).toBe(expected.write);
		const rateLimited = expected.write || expected.name === "validateImport";
		expect(reflector.get<string | undefined>(RATE_LIMIT_POLICY_KEY, handler)).toBe(rateLimited ? RATE_LIMIT_POLICY.authenticatedMutation.name : undefined);
	});

	it("authorizes the import through the kernel as CREATE GEO", () => {
		expect(reflector.get<object>(AUTHORIZE_KEY, handlerOf("importData"))).toMatchObject({ action: "CREATE", resource: "GEO", description: "Import geo data" });
	});
});

describe("GeoController delegation", () => {
	const ACTOR: ActorContext = {
		kind: "user",
		userId: "11111111-1111-4111-8111-111111111111",
		sessionId: "session-1",
		tenantId: null,
		isSuperAdmin: true,
		accessScope: "tenant",
		impersonatorUserId: null,
		request: { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
	};

	function controller(): { readonly geo: GeoController; readonly reads: InMemoryGeographyRead; readonly unitOfWork: InMemoryUnitOfWork<ReferenceDataScope> } {
		const reads = new InMemoryGeographyRead();
		const unitOfWork = new InMemoryUnitOfWork<ReferenceDataScope>({
			geography: new InMemoryGeographyRepository(),
			requestAudit: new RecordingRequestAudit(),
			events: new TransactionalEventCollector(),
		});
		return { geo: new GeoController(new GeographyApplicationService(unitOfWork, reads, new FixedClock(epochMs(0)))), reads, unitOfWork };
	}

	it("hands the current actor to the application service for a read", async () => {
		const { geo, reads } = controller();
		await geo.getStats(ACTOR);
		expect(reads.actors).toEqual([ACTOR]);
	});

	it("hands the current actor to the application service for a write", async () => {
		const { geo, unitOfWork } = controller();
		await geo.createRegion(ACTOR, { name: "Asia", flag: true });
		expect(unitOfWork.committed.map((entry) => entry.actor)).toEqual([ACTOR]);
	});
});
