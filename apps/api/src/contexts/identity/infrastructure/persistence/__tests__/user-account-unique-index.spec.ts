import { describe, expect, it } from "vitest";

import { committedUniqueIndexNames } from "../../../../../platform/infrastructure/persistence/__tests__/committed-unique-indexes";
import { USERS_EMAIL_UNIQUE_INDEX } from "../prisma-user-account.repository";

describe("the user email unique index", () => {
	it("exists under the name the signup race maps to EMAIL_TAKEN", () => {
		expect(committedUniqueIndexNames().has(USERS_EMAIL_UNIQUE_INDEX)).toBe(true);
	});

	it("is not satisfied by a name only an older, dropped table had", () => {
		expect(committedUniqueIndexNames().has("users_email_key")).toBe(false);
	});
});
