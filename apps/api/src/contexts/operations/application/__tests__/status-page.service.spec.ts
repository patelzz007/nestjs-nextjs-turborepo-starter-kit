import { epochMs, type EpochMs, type OpsDependency, type OpsDependencyStatus } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";
import { StatusIncidentNotFoundError } from "../../domain/errors/operations.errors";
import type { OperationsReadScope } from "../operations-scope";
import type { StatusIncidentRecord, StatusIncidentRepository } from "../ports/status-incident.repository.port";
import { StatusPageService } from "../services/status-page.service";
import { FakeOperationsUnitOfWork, superAdminActor } from "./fakes/operations.fakes";

const NOW = epochMs(Date.UTC(2026, 10, 3, 12, 0));
const DAY = 86_400_000;

function incident(overrides: Partial<StatusIncidentRecord> = {}): StatusIncidentRecord {
	return {
		id: "0190f0e0-0000-7000-8000-000000000001",
		title: "Emails are delayed",
		impact: "MINOR",
		state: "IDENTIFIED",
		components: ["background-jobs"],
		startedAt: epochMs(NOW - 3_600_000),
		resolvedAt: null,
		openedById: "staff-1",
		openedByName: "Sam Staff",
		updates: [
			{
				id: "0190f0e0-0000-7000-8000-0000000000aa",
				state: "IDENTIFIED",
				message: "The mail provider is slow.",
				postedById: "staff-1",
				postedByName: "Sam Staff",
				postedAt: epochMs(NOW - 600_000),
			},
		],
		...overrides,
	};
}

const MONITORED: readonly OpsDependency[] = ["ENDPOINTS", "POSTGRES", "QUEUES", "REDIS"];
const DEPENDENCIES: readonly OpsDependencyStatus[] = MONITORED.map((dependency): OpsDependencyStatus => ({
	dependency,
	health: "UP",
	configured: true,
	latencyMs: 3,
	checkedAt: epochMs(NOW - 20_000),
	error: null,
	stats: null,
}));

function service(options: { readonly publicIncidents?: readonly StatusIncidentRecord[]; readonly staff?: Partial<StatusIncidentRepository> } = {}): {
	readonly service: StatusPageService;
	readonly since: EpochMs[];
	readonly operations: SystemOperationName[];
} {
	const since: EpochMs[] = [];
	const operations: SystemOperationName[] = [];
	const base = new FakeOperationsUnitOfWork().scope;
	const scope: OperationsReadScope = { ...base, statusIncidents: { ...base.statusIncidents, ...options.staff } };
	return {
		since,
		operations,
		service: new StatusPageService({
			live: { dependencies: (): Promise<readonly OpsDependencyStatus[]> => Promise.resolve(DEPENDENCIES) },
			publicReads: {
				incidents: (_actor: ActorContext, resolvedSince: EpochMs): Promise<readonly StatusIncidentRecord[]> => {
					since.push(resolvedSince);
					return Promise.resolve(options.publicIncidents ?? []);
				},
			},
			reads: {
				readAs: <TResult>(operation: SystemOperationName, _actor: ActorContext, work: (s: OperationsReadScope) => Promise<TResult>): Promise<TResult> => {
					operations.push(operation);
					return work(scope);
				},
			},
			clock: { now: (): EpochMs => NOW },
		}),
	};
}

describe("StatusPageService.publicPage", () => {
	it("shows each part from the monitor and the open incidents, splits open from recently resolved, and names nobody", async () => {
		const resolved = incident({ id: "0190f0e0-0000-7000-8000-000000000002", state: "RESOLVED", resolvedAt: epochMs(NOW - DAY), impact: "CRITICAL", components: ["database"] });
		const { service: page, since } = service({ publicIncidents: [incident(), resolved] });
		const result = await page.publicPage(superAdminActor());

		expect(since).toStrictEqual([NOW - 7 * DAY]);
		expect(result.overall).toBe("DEGRADED");
		expect(result.checkedAt).toBe(NOW - 20_000);
		expect(result.components.map((component) => [component.key, component.status])).toStrictEqual([
			["api", "OPERATIONAL"],
			["database", "OPERATIONAL"],
			["background-jobs", "DEGRADED"],
		]);
		expect(result.open.map((entry) => entry.id)).toStrictEqual([incident().id]);
		expect(result.recent.map((entry) => entry.id)).toStrictEqual([resolved.id]);
		expect(JSON.stringify(result)).not.toContain("Sam Staff");
		expect(JSON.stringify(result)).not.toContain("staff-1");
	});
});

describe("StatusPageService staff reads", () => {
	it("lists and reads incidents under the staff read operation, with who posted", async () => {
		const { service: page, operations } = service({
			staff: {
				list: (): Promise<readonly StatusIncidentRecord[]> => Promise.resolve([incident()]),
				find: (): Promise<StatusIncidentRecord | null> => Promise.resolve(incident()),
			},
		});
		const list = await page.incidents(superAdminActor());
		expect(list.incidents.at(0)).toMatchObject({ openedByName: "Sam Staff", updates: [{ postedByName: "Sam Staff", message: "The mail provider is slow." }] });
		await expect(page.incident(superAdminActor(), incident().id)).resolves.toMatchObject({ title: "Emails are delayed" });
		expect(operations).toStrictEqual(["operations.status.read", "operations.status.read"]);
	});

	it("answers not found for an incident that isn't there", async () => {
		const { service: page } = service({ staff: { find: (): Promise<StatusIncidentRecord | null> => Promise.resolve(null) } });
		await expect(page.incident(superAdminActor(), incident().id)).rejects.toBeInstanceOf(StatusIncidentNotFoundError);
	});
});
