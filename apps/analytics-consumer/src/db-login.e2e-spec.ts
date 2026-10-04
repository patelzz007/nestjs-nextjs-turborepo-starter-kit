import { randomBytes } from "node:crypto";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ANALYTICS_CONSUMER_GROUP_ROLE, ConsumerLoginProvisioningError, provisionConsumerLogin } from "./db-login";
import { loadDbLoginProvisioningEnv } from "./env";

/** Real-Postgres proof of `db:provision-login`: creates, then updates, a member of the group role — and never touches a privileged role. */

const SUFFIX_BYTES = 6;
const PASSWORD_BYTES = 24;

describe("provisionConsumerLogin (integration)", () => {
	const roleName = `analytics_consumer_e2e_${randomBytes(SUFFIX_BYTES).toString("hex")}`;
	let admin: pg.Client;

	beforeAll(async () => {
		admin = new pg.Client({ connectionString: loadDbLoginProvisioningEnv().adminUrl });
		await admin.connect();
	});

	afterAll(async () => {
		await admin.query(`DROP ROLE IF EXISTS ${roleName}`);
		await admin.end();
	});

	it("creates the login as a plain member of the group role, then updates it idempotently", async () => {
		await expect(provisionConsumerLogin(admin, { roleName, password: randomBytes(PASSWORD_BYTES).toString("hex") })).resolves.toBe("created");
		await expect(provisionConsumerLogin(admin, { roleName, password: randomBytes(PASSWORD_BYTES).toString("hex") })).resolves.toBe("updated");

		const role = await admin.query<{ rolcanlogin: boolean; rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean; member: boolean }>(
			"SELECT rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, pg_has_role(rolname, $2, 'MEMBER') AS member FROM pg_roles WHERE rolname = $1",
			[roleName, ANALYTICS_CONSUMER_GROUP_ROLE],
		);
		expect(role.rows).toEqual([{ rolcanlogin: true, rolsuper: false, rolbypassrls: false, rolcreaterole: false, member: true }]);
	});

	it("refuses to re-purpose the admin connection's own role", async () => {
		const self = await admin.query<{ name: string }>("SELECT current_user AS name");
		const name = self.rows[0]?.name ?? "";

		await expect(provisionConsumerLogin(admin, { roleName: name, password: randomBytes(PASSWORD_BYTES).toString("hex") })).rejects.toBeInstanceOf(
			ConsumerLoginProvisioningError,
		);
	});
});
