import type pg from "pg";
import { z } from "zod";

/**
 * Group role holding the consumer's privileges — created, granted and given
 * its RLS policies by apps/api/prisma/rls/90-analytics-consumer.sql
 * (`pnpm db:apply-security`). NOLOGIN: the worker logs in as a separate
 * LOGIN role that is a member of it.
 */
export const ANALYTICS_CONSUMER_GROUP_ROLE = "analytics_consumer";

/** Unquoted Postgres identifier (lower-case, ≤ 63 bytes) — no quoting surprises in grants or logs. */
const LoginRoleNameSchema = z
	.string()
	.regex(/^[a-z_][a-z0-9_]{0,62}$/, "the user in ANALYTICS_CONSUMER_DATABASE_URL must be a lower-case Postgres identifier (a-z, 0-9, _)")
	.refine((name: string): boolean => name !== ANALYTICS_CONSUMER_GROUP_ROLE, `the login must not be the ${ANALYTICS_CONSUMER_GROUP_ROLE} group role itself`);

const MIN_PASSWORD_LENGTH = 16;

export interface ConsumerLogin {
	readonly roleName: string;
	readonly password: string;
}

/** Thrown when provisioning would be unsafe or impossible. Never carries the password. */
export class ConsumerLoginProvisioningError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "ConsumerLoginProvisioningError";
	}
}

/** User + password from the consumer's connection URL (the single source of the credentials). */
export function parseConsumerLogin(consumerUrl: string): ConsumerLogin {
	const url = new URL(consumerUrl);
	const roleName = LoginRoleNameSchema.safeParse(decodeURIComponent(url.username));
	if (!roleName.success) {
		throw new ConsumerLoginProvisioningError(roleName.error.issues.map((issue): string => issue.message).join("; "));
	}
	const password = decodeURIComponent(url.password);
	if (password.length < MIN_PASSWORD_LENGTH) {
		throw new ConsumerLoginProvisioningError(`the password in ANALYTICS_CONSUMER_DATABASE_URL must be at least ${String(MIN_PASSWORD_LENGTH)} characters`);
	}
	return { roleName: roleName.data, password };
}

const RoleRowSchema = z.object({ rolsuper: z.boolean(), is_current_user: z.boolean() });
const SqlRowSchema = z.object({ sql: z.string() });

/** Attributes forced on every provisioning: a plain login that can do nothing beyond its group's grants. */
const LOGIN_ATTRIBUTES = "LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT";

async function buildStatement(admin: pg.ClientBase, template: string, values: readonly string[]): Promise<string> {
	// format(%I / %L) quotes identifiers and literals server-side — DDL cannot take bind parameters.
	const result = await admin.query(`SELECT format('${template}', ${values.map((_: string, index: number): string => `$${String(index + 1)}::text`).join(", ")}) AS sql`, [
		...values,
	]);
	return SqlRowSchema.parse(result.rows[0]).sql;
}

/**
 * Creates (or updates the password and attributes of) the consumer's LOGIN
 * role and makes it a member of {@link ANALYTICS_CONSUMER_GROUP_ROLE}.
 * Idempotent. Refuses to touch a superuser or the admin's own role, and
 * requires the group role to exist (apply the RLS bundle first).
 */
export async function provisionConsumerLogin(admin: pg.ClientBase, login: ConsumerLogin): Promise<"created" | "updated"> {
	const group = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [ANALYTICS_CONSUMER_GROUP_ROLE]);
	if (group.rowCount !== 1) {
		throw new ConsumerLoginProvisioningError(`role ${ANALYTICS_CONSUMER_GROUP_ROLE} does not exist — run pnpm --filter @workspace/api db:apply-security first`);
	}

	const existing = await admin.query("SELECT rolsuper, rolname = current_user AS is_current_user FROM pg_roles WHERE rolname = $1", [login.roleName]);
	const row = z.array(RoleRowSchema).parse(existing.rows).at(0);
	if (row !== undefined) {
		if (row.rolsuper || row.is_current_user) {
			throw new ConsumerLoginProvisioningError(
				`refusing to reuse ${login.roleName} for the consumer: it is a superuser or the admin connection's own role — choose a dedicated login name`,
			);
		}
	}

	const outcome: "created" | "updated" = row === undefined ? "created" : "updated";
	await admin.query("BEGIN");
	try {
		const roleStatement =
			outcome === "created"
				? await buildStatement(admin, `CREATE ROLE %I ${LOGIN_ATTRIBUTES} PASSWORD %L`, [login.roleName, login.password])
				: await buildStatement(admin, `ALTER ROLE %I WITH ${LOGIN_ATTRIBUTES} PASSWORD %L`, [login.roleName, login.password]);
		await admin.query(roleStatement);
		await admin.query(await buildStatement(admin, "GRANT %I TO %I", [ANALYTICS_CONSUMER_GROUP_ROLE, login.roleName]));
		await admin.query("COMMIT");
	} catch (error) {
		await admin.query("ROLLBACK");
		throw error;
	}
	return outcome;
}
