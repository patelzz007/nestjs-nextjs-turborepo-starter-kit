// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { DataChangeLogDetailSchema, type DataChangeLogDetail } from "@workspace/shared";
import { afterEach, describe, expect, it } from "vitest";

import { DataChangeActorCell } from "../data-change-badges";
import { DataChangeRecord } from "../data-change-record";

const CHANGE_ID = "88888888-8888-4888-8888-888888888888";
const ACTOR_ID = "6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const TENANT_ID = "7a2d3b63-0b4f-4e49-8b66-1e2f3a4b5c6d";

function change(overrides: Partial<DataChangeLogDetail> = {}): DataChangeLogDetail {
	return DataChangeLogDetailSchema.parse({
		id: CHANGE_ID,
		changeSequence: 42,
		occurredAt: 1_790_000_000_000,
		transactionId: 9_001,
		tableName: "User",
		operation: "UPDATE",
		rowId: ACTOR_ID,
		changedColumns: ["passwordHash", "status"],
		actorKind: "USER",
		actor: { id: ACTOR_ID, email: "u***@example.com", fullName: "Demo Customer" },
		tenant: { id: TENANT_ID, name: "Kopi Corner" },
		apiKeyId: null,
		systemOperation: "auth.profile.update",
		correlationId: "corr-1",
		databaseRole: "app_runtime",
		oldData: { id: ACTOR_ID, passwordHash: "[REDACTED]", status: "ACTIVE", fullName: "[PII]" },
		newData: { id: ACTOR_ID, passwordHash: "[REDACTED]", status: "LOCKED", fullName: "[PII]" },
		actorPurpose: "User edits their own profile",
		loginRole: "api",
		applicationName: null,
		clientAddress: "10.0.0.12",
		createdAt: 1_790_000_000_001,
		...overrides,
	});
}

afterEach((): void => {
	cleanup();
});

describe("DataChangeRecord", () => {
	it("shows the row before and after, changed columns first and marked — a redacted secret included", () => {
		render(<DataChangeRecord record={change()} layout="page" />);

		const table = screen.getByRole("table");
		const [, firstRow, secondRow, ...rest] = within(table).getAllByRole("row");
		expect(within(firstRow ?? table).getByRole("rowheader").textContent).toBe("passwordHash — Changed");
		expect(
			within(secondRow ?? table)
				.getAllByRole("cell")
				.map((cell) => cell.textContent),
		).toEqual(["ACTIVE", "LOCKED"]);
		expect(rest.map((row) => within(row).getByRole("rowheader").textContent)).toEqual(["fullName — Unchanged", "id — Unchanged"]);
	});

	it("says what was changed by whom, how and through which connection", () => {
		render(<DataChangeRecord record={change()} layout="page" />);

		expect(screen.getByRole("heading", { name: "User" })).toBeTruthy();
		expect(screen.getByText("auth.profile.update")).toBeTruthy();
		expect(screen.getByText("User edits their own profile")).toBeTruthy();
		expect(screen.getByText("app_runtime")).toBeTruthy();
		expect(screen.getByText("10.0.0.12")).toBeTruthy();
	});

	it("links into the audit log: the request / job behind the change, the actor, the tenant and the row's history", () => {
		render(<DataChangeRecord record={change()} layout="drawer" />);

		expect(screen.getByRole("link", { name: "corr-1" }).getAttribute("href")).toBe("/audit-logs?filter[correlationId]=corr-1");
		expect(screen.getByRole("link", { name: "Every change to this row" }).getAttribute("href")).toBe(`/audit-logs?filter[tableName]=User&filter[rowId]=${ACTOR_ID}`);
		expect(screen.getByRole("link", { name: ACTOR_ID }).getAttribute("href")).toBe(`/audit-logs?filter[actorUserId]=${ACTOR_ID}`);
		expect(screen.getByRole("link", { name: "Kopi Corner" }).getAttribute("href")).toBe(`/audit-logs?filter[tenantId]=${TENANT_ID}`);
	});

	it("explains a TRUNCATE, which has no single row", () => {
		render(<DataChangeRecord record={change({ operation: "TRUNCATE", rowId: null, changedColumns: [], oldData: null, newData: null, correlationId: null })} layout="page" />);

		expect(screen.getByText("Whole table")).toBeTruthy();
		expect(screen.getByText(/A TRUNCATE removes every row/)).toBeTruthy();
		expect(screen.queryByRole("link", { name: "Every change to this row" })).toBeNull();
	});
});

describe("DataChangeActorCell", () => {
	it("names the user when there is one", () => {
		render(<DataChangeActorCell entry={change()} />);

		expect(screen.getByText("Demo Customer")).toBeTruthy();
	});

	it("flags a change no user, key or job owned, with the database role that made it", () => {
		render(<DataChangeActorCell entry={change({ actorKind: "UNATTRIBUTED", actor: null, systemOperation: null, databaseRole: "postgres" })} />);

		expect(screen.getByText("Unattributed")).toBeTruthy();
		expect(screen.getByText("as postgres")).toBeTruthy();
	});

	it("names the system job of background work", () => {
		render(<DataChangeActorCell entry={change({ actorKind: "SYSTEM", actor: null, systemOperation: "outbox.publish" })} />);

		expect(screen.getByText("System job")).toBeTruthy();
		expect(screen.getByText("outbox.publish")).toBeTruthy();
	});
});
