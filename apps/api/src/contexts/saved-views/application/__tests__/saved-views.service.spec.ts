import { epochMs, type SavedListKey } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { ConflictError, NotFoundError } from "../../../../platform/application/errors/app-error";
import type { NewSavedListView, SavedListViewRecord, SavedListViewStore, SaveViewOutcome } from "../ports/saved-list-view.store";
import { SavedViewsService } from "../services/saved-views.service";

const NOW = epochMs(Date.UTC(2026, 10, 3, 12, 0));
const ACTOR: ActorContext = {
	kind: "user",
	userId: "00000000-0000-4000-8000-000000000001",
	sessionId: "session-1",
	tenantId: null,
	isSuperAdmin: true,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: { requestId: "req-1", ip: "198.51.100.7", userAgent: "agent", deviceLabel: null, endpoint: null },
};

function record(name: string, overrides: Partial<SavedListViewRecord> = {}): SavedListViewRecord {
	return {
		id: `0190f0e0-0000-7000-8000-${String(name.length).padStart(12, "0")}`,
		userId: "u",
		listKey: "admin.users",
		name,
		query: "?x=1",
		shared: false,
		ownerName: null,
		createdAt: NOW,
		...overrides,
	};
}

class FakeStore implements SavedListViewStore {
	public readonly saved: NewSavedListView[] = [];

	public constructor(
		private readonly answers: {
			readonly own?: readonly SavedListViewRecord[];
			readonly shared?: readonly SavedListViewRecord[];
			readonly save?: SaveViewOutcome;
			readonly removed?: boolean;
		} = {},
	) {}

	public own(_actor: ActorContext, _listKey: SavedListKey): Promise<readonly SavedListViewRecord[]> {
		return Promise.resolve(this.answers.own ?? []);
	}

	public sharedByOthers(): Promise<readonly SavedListViewRecord[]> {
		return Promise.resolve(this.answers.shared ?? []);
	}

	public save(_actor: ActorContext, view: NewSavedListView, limit: number): Promise<SaveViewOutcome> {
		this.saved.push(view);
		expect(limit).toBe(30);
		return Promise.resolve(this.answers.save ?? { kind: "saved", view: record(view.name) });
	}

	public remove(): Promise<boolean> {
		return Promise.resolve(this.answers.removed ?? true);
	}
}

const clock = { now: (): typeof NOW => NOW };

describe("SavedViewsService", () => {
	it("lists your own views by name, then others' shared views by name, naming only theirs", async () => {
		const store = new FakeStore({
			own: [record("Zeta"), record("Alpha")],
			shared: [record("Mid", { ownerName: "Sam", shared: true }), record("Beta", { ownerName: "Ann", shared: true })],
		});
		const { views } = await new SavedViewsService(store, clock).list(ACTOR, "admin.users");
		expect(views.map((view) => [view.name, view.mine, view.ownerName])).toStrictEqual([
			["Alpha", true, null],
			["Zeta", true, null],
			["Beta", false, "Ann"],
			["Mid", false, "Sam"],
		]);
	});

	it("saves a view, and turns a taken name or a full list into a conflict saying which", async () => {
		const store = new FakeStore();
		await expect(new SavedViewsService(store, clock).save(ACTOR, { listKey: "admin.users", name: "Mine", query: "?a=1", shared: true })).resolves.toMatchObject({
			name: "Mine",
			mine: true,
		});
		expect(store.saved).toStrictEqual([{ listKey: "admin.users", name: "Mine", query: "?a=1", shared: true }]);

		await expect(
			new SavedViewsService(new FakeStore({ save: { kind: "name-taken" } }), clock).save(ACTOR, { listKey: "admin.users", name: "Mine", query: "", shared: false }),
		).rejects.toThrow(/already have a view called "Mine"/u);
		await expect(
			new SavedViewsService(new FakeStore({ save: { kind: "full" } }), clock).save(ACTOR, { listKey: "admin.users", name: "One more", query: "", shared: false }),
		).rejects.toBeInstanceOf(ConflictError);
	});

	it("removes your own view, and answers not found for one that isn't yours", async () => {
		await expect(new SavedViewsService(new FakeStore(), clock).remove(ACTOR, "v")).resolves.toStrictEqual({ success: true });
		await expect(new SavedViewsService(new FakeStore({ removed: false }), clock).remove(ACTOR, "v")).rejects.toBeInstanceOf(NotFoundError);
	});
});
