import { describe, expect, it } from "vitest";

import { BackupLoginEnvSchema, backupLoginSql } from "../backup-login";

describe("BackupLoginEnvSchema", () => {
	it("reads the login and password from BACKUP_DATABASE_URL", () => {
		expect(BackupLoginEnvSchema.parse({ BACKUP_DATABASE_URL: "postgresql://app_backup_login:s%40cret@localhost:5432/db" }).BACKUP_DATABASE_URL).toEqual({
			login: "app_backup_login",
			password: "s@cret",
		});
	});

	it("refuses unsafe or reserved names and a missing password", () => {
		expect(BackupLoginEnvSchema.safeParse({ BACKUP_DATABASE_URL: "postgresql://Bad-Name:x@localhost/db" }).success).toBe(false);
		expect(BackupLoginEnvSchema.safeParse({ BACKUP_DATABASE_URL: "postgresql://app_runtime:x@localhost/db" }).success).toBe(false);
		expect(BackupLoginEnvSchema.safeParse({ BACKUP_DATABASE_URL: "postgresql://app_backup_login@localhost/db" }).success).toBe(false);
		expect(BackupLoginEnvSchema.safeParse({}).success).toBe(false);
	});
});

describe("backupLoginSql", () => {
	it("creates the login once, gives it BYPASSRLS and the read-only group, and nothing more", () => {
		const sql = backupLoginSql("app_backup_login", "'pw'");

		expect(sql).toEqual([
			"DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_backup_login') THEN CREATE ROLE app_backup_login LOGIN; END IF; END $$;",
			"ALTER ROLE app_backup_login WITH LOGIN BYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD 'pw';",
			"GRANT app_backup TO app_backup_login;",
		]);
	});
});
