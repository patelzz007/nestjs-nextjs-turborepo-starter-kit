import { describe, expect, it } from "vitest";

import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { PreferenceValueInvalidError } from "../../domain/errors/identity.errors";
import { ResetOwnPreferenceCommand } from "../commands/reset-own-preference/reset-own-preference.command";
import { ResetOwnPreferenceHandler } from "../commands/reset-own-preference/reset-own-preference.handler";
import { SetOwnPreferenceCommand } from "../commands/set-own-preference/set-own-preference.command";
import { SetOwnPreferenceHandler } from "../commands/set-own-preference/set-own-preference.handler";
import { ListOwnPreferencesHandler } from "../queries/list-own-preferences/list-own-preferences.handler";
import { ListOwnPreferencesQuery } from "../queries/list-own-preferences/list-own-preferences.query";
import { InMemoryIdentityReads } from "./fakes/identity-reads.fakes";
import { InMemoryIdentityStore, NOW, userActor } from "./fakes/identity.fakes";

const USER_ID = "0199d0c0-0000-7000-8000-000000000031";

/** Hands out row ids in order. */
const ids = {
	cursor: 0,
	next(): string {
		this.cursor += 1;
		return `preference-${String(this.cursor)}`;
	},
};

describe("SetOwnPreferenceHandler", () => {
	it("remembers a choice, then replaces it on the same row with its version bumped", async () => {
		const store = new InMemoryIdentityStore();
		const handler = new SetOwnPreferenceHandler(store.uow, ids);

		await expect(handler.execute(new SetOwnPreferenceCommand(userActor(USER_ID), USER_ID, { key: "board.execution.groupBy", value: "story" }))).resolves.toEqual({
			key: "board.execution.groupBy",
			value: "story",
			version: 0,
		});
		await expect(handler.execute(new SetOwnPreferenceCommand(userActor(USER_ID), USER_ID, { key: "board.execution.groupBy", value: "none" }))).resolves.toEqual({
			key: "board.execution.groupBy",
			value: "none",
			version: 1,
		});

		expect(store.preferences.rows.filter((row) => !row.isDeleted)).toHaveLength(1);
	});

	it("re-checks the value against the registry on the server, writing nothing when the key does not accept it", async () => {
		const store = new InMemoryIdentityStore();

		await expect(
			new SetOwnPreferenceHandler(store.uow, ids).execute(new SetOwnPreferenceCommand(userActor(USER_ID), USER_ID, { key: "board.planning.groupBy", value: "story" })),
		).rejects.toThrow(PreferenceValueInvalidError);
		expect(store.preferences.rows).toEqual([]);
	});
});

describe("ResetOwnPreferenceHandler", () => {
	it("soft-deletes the live row (Reset to default) and answers what is left", async () => {
		const store = new InMemoryIdentityStore();
		const reads = new InMemoryIdentityReads();
		await new SetOwnPreferenceHandler(store.uow, ids).execute(new SetOwnPreferenceCommand(userActor(USER_ID), USER_ID, { key: "board.execution.showSubtasks", value: true }));

		await expect(
			new ResetOwnPreferenceHandler(store.uow, reads, new FixedClock(NOW)).execute(new ResetOwnPreferenceCommand(userActor(USER_ID), USER_ID, "board.execution.showSubtasks")),
		).resolves.toEqual({ preferences: [] });
		expect(store.preferences.rows).toMatchObject([{ isDeleted: true, deletedBy: USER_ID }]);
	});
});

describe("ListOwnPreferencesHandler", () => {
	it("answers the reader's preferences", async () => {
		const reads = new InMemoryIdentityReads();
		reads.preferences.set(USER_ID, [{ key: "board.execution.groupBy", value: "epic", version: 2 }]);

		await expect(new ListOwnPreferencesHandler(reads).execute(new ListOwnPreferencesQuery(userActor(USER_ID), USER_ID))).resolves.toEqual({
			preferences: [{ key: "board.execution.groupBy", value: "epic", version: 2 }],
		});
	});
});
