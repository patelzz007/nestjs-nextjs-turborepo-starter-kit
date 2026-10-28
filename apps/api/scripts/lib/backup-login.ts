// ============================================
// scripts/lib/backup-login.ts — the backup's own database login (ADR 068)
// ============================================
// `pg_dump` must read every row, and every table forces RLS, so backups connect with a LOGIN role of
// their own: a member of the read-only `app_backup` group (prisma/rls/91-backup-reader.sql) carrying
// BYPASSRLS itself (an attribute is never inherited from a group). Its name and password come from
// BACKUP_DATABASE_URL, so credentials never live in the repository.

import { z } from "zod";

/** A PostgreSQL role name this script will create: lower-case, unquoted-identifier safe. */
const ROLE_NAME = /^[a-z_][a-z0-9_]{0,62}$/;
/** Roles the platform already owns; the backup login must be a role of its own. */
const RESERVED_ROLES: ReadonlySet<string> = new Set(["postgres", "app_runtime", "app_backup", "analytics_consumer"]);

export const BackupLoginEnvSchema = z.object({
	BACKUP_DATABASE_URL: z.url().transform((value, context) => {
		const url = new URL(value);
		const login = decodeURIComponent(url.username);
		const password = decodeURIComponent(url.password);
		if (!ROLE_NAME.test(login) || RESERVED_ROLES.has(login)) {
			context.addIssue({ code: "custom", message: `"${login}" is not a login this script may create: use a new lower-case name such as app_backup_login` });
			return z.NEVER;
		}
		if (password.length === 0) {
			context.addIssue({ code: "custom", message: "BACKUP_DATABASE_URL needs a password" });
			return z.NEVER;
		}
		return { login, password };
	}),
});

export type BackupLogin = z.output<typeof BackupLoginEnvSchema>["BACKUP_DATABASE_URL"];

/**
 * The idempotent SQL that creates (or updates) the login. `passwordLiteral` is the password already
 * quoted as a SQL literal by the database driver; the login name was validated by
 * {@link BackupLoginEnvSchema}.
 */
export function backupLoginSql(login: string, passwordLiteral: string): string[] {
	return [
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${login}') THEN CREATE ROLE ${login} LOGIN; END IF; END $$;`,
		`ALTER ROLE ${login} WITH LOGIN BYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD ${passwordLiteral};`,
		`GRANT app_backup TO ${login};`,
	];
}
