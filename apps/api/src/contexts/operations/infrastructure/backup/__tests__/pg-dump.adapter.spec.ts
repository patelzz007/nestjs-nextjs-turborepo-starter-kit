import { describe, expect, it } from "vitest";

import { majorOfPgDumpVersion, majorOfServerVersionNum, pgEnvironment } from "../pg-dump.adapter";

describe("pg_dump helpers", () => {
	it("reads pg_dump's major version", () => {
		expect(majorOfPgDumpVersion("pg_dump (PostgreSQL) 18.1")).toBe(18);
		expect(majorOfPgDumpVersion("pg_dump (PostgreSQL) 16.4 (Homebrew)")).toBe(16);
		expect(majorOfPgDumpVersion("command not found")).toBeNull();
	});

	it("reads the server's major version from server_version_num", () => {
		expect(majorOfServerVersionNum("180001")).toBe(18);
		expect(majorOfServerVersionNum("")).toBeNull();
		expect(majorOfServerVersionNum("abc")).toBeNull();
	});

	it("turns a connection URL into libpq variables, so the password never reaches the command line", () => {
		expect(pgEnvironment("postgresql://app_backup_login:p%40ss@db.example.com:25060/app?sslmode=require")).toEqual({
			PGHOST: "db.example.com",
			PGPORT: "25060",
			PGUSER: "app_backup_login",
			PGPASSWORD: "p@ss",
			PGDATABASE: "app",
			PGSSLMODE: "require",
		});
	});

	it("defaults the port and lets a container reach the host", () => {
		expect(pgEnvironment("postgresql://u:p@localhost/app", "host.docker.internal")).toMatchObject({ PGHOST: "host.docker.internal", PGPORT: "5432" });
	});
});
