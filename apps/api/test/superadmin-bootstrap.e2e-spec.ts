import { randomUUID } from "node:crypto";
import { epochMs, LIST_SLOT_INDEX } from "@workspace/shared";
import { Readable } from "node:stream";

import * as bcrypt from "bcrypt";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { z } from "zod";

import { TypedConfigService } from "../src/config/typed-config.service";
import { PrismaService } from "../src/prisma/prisma.service";
import type { BootstrapSuperAdminInput } from "../src/contexts/identity/application/commands/bootstrap-super-admin/bootstrap-super-admin.command";
import type { BootstrapOutcome } from "../src/contexts/identity/application/commands/bootstrap-super-admin/bootstrap-super-admin.types";
import { SUPERADMIN_BOOTSTRAP_OPERATION } from "../src/contexts/identity/application/ports/identity.tokens";
import { BootstrapEmailTakenError, SuperAdminAlreadyExistsError, SuperAdminRoleMissingError } from "../src/contexts/identity/domain/errors/identity.errors";
import { resolveSessionRestriction } from "../src/contexts/identity/domain/policies/session-restriction.policy";
import { StdinPasswordReader, type PasswordReader } from "../src/contexts/identity/presentation/cli/password-reader";
import { SuperAdminBootstrapCommand } from "../src/contexts/identity/presentation/cli/superadmin-bootstrap.cli-command";
import { BOOTSTRAP_EXIT_CODES } from "../src/contexts/identity/presentation/cli/superadmin-bootstrap.cli.constants";
import { createSuperAdminBootstrap, type SuperAdminBootstrap } from "../src/contexts/identity/superadmin-bootstrap.composition";
import { createScratchDatabase, SCRATCH_SETUP_TIMEOUT_MS, type ScratchDatabase } from "./support/scratch-database";
import { createTestTypedConfig } from "./support/test-api-env";

/**
 * The one-time SuperAdmin bootstrap against a THROWAWAY database this file creates (migrated + RLS-applied,
 * but unseeded — exactly a real deployment) and drops afterwards. The shared dev database is never touched:
 * its server is only used to `CREATE DATABASE` / `DROP DATABASE` the scratch one.
 */

const PASSWORD = "Corr3ct-Horse-Battery!";
const REQUEST: BootstrapSuperAdminInput = { identity: { email: "root@acme.test", fullName: "Root Admin" }, password: PASSWORD };
const CONCURRENT_RUNS = 4;

const CountRowSchema = z.object({ count: z.number() });
const LoginRowSchema = z.object({
	id: z.string(),
	email: z.string(),
	full_name: z.string(),
	passwordHash: z.string(),
	isActive: z.boolean(),
	is_super_admin: z.boolean(),
	isDeleted: z.boolean(),
	emailVerifiedAt: z.string().nullable(),
	mfaEnrollmentDeadline: z.string().nullable(),
	twoFactorEnabled: z.boolean(),
});
const AuditRowSchema = z.object({ action: z.string(), actorKind: z.string(), actorId: z.string(), targetUserId: z.string().nullable(), detail: z.string().nullable() });

describe("SuperAdmin bootstrap (integration, scratch database)", () => {
	let database: ScratchDatabase;
	let scratch: Pool;
	let config: TypedConfigService;

	/** A fresh service over its OWN connection pool — each concurrent run is a separate database session, like separate CLI processes. */
	async function newService(): Promise<SuperAdminBootstrap> {
		const prisma = new PrismaService(config);
		prisma.onModuleInit();
		await prisma.ensureConnected();
		database.track((): Promise<void> => prisma.onModuleDestroy());
		return createSuperAdminBootstrap(config, prisma);
	}

	async function count(sql: string): Promise<number> {
		return CountRowSchema.parse((await scratch.query(sql)).rows[LIST_SLOT_INDEX.first]).count;
	}

	async function insertSuperAdminRole(): Promise<string> {
		const id = randomUUID();
		await scratch.query(`INSERT INTO "Role" (id, name, "isSystem") VALUES ($1, 'SuperAdmin', true)`, [id]);
		return id;
	}

	async function insertUser(email: string, flags: { readonly isSuperAdmin: boolean; readonly isActive: boolean; readonly isDeleted: boolean }): Promise<string> {
		const id = randomUUID();
		await scratch.query(`INSERT INTO "User" (id, email, "fullName", "passwordHash", "isSuperAdmin", "isActive", "isDeleted") VALUES ($1, $2, 'Existing', 'x', $3, $4, $5)`, [
			id,
			email,
			flags.isSuperAdmin,
			flags.isActive,
			flags.isDeleted,
		]);
		return id;
	}

	beforeAll(async () => {
		database = await createScratchDatabase(process.env.DATABASE_URL ?? "", "bootstrap_e2e");
		scratch = database.pool;
		config = createTestTypedConfig({ DATABASE_URL: database.url });
	}, SCRATCH_SETUP_TIMEOUT_MS);

	afterEach(async () => {
		await scratch.query('TRUNCATE "User", "Role", "PermissionAuditLog" CASCADE');
	});

	afterAll(async () => {
		await database.drop();
	});

	it("creates a verified SuperAdmin with a real bcrypt hash, the role, and audit rows naming the system operation", async () => {
		const roleId = await insertSuperAdminRole();
		const outcome = await (await newService()).bootstrap(REQUEST);

		const user = LoginRowSchema.parse(
			(
				await scratch.query(
					`SELECT id, email, "fullName" AS full_name, "passwordHash" AS "passwordHash", "isActive" AS "isActive", "isSuperAdmin" AS is_super_admin, "isDeleted", "emailVerifiedAt"::text, "mfaEnrollmentDeadline"::text, "twoFactorEnabled" FROM "User" WHERE id = $1`,
					[outcome.userId],
				)
			).rows[LIST_SLOT_INDEX.first],
		);
		expect(user).toMatchObject({ email: "root@acme.test", full_name: "Root Admin", isActive: true, is_super_admin: true, isDeleted: false, twoFactorEnabled: false });
		expect(user.passwordHash).not.toContain(PASSWORD);
		expect(await bcrypt.compare(PASSWORD, user.passwordHash)).toBe(true);
		expect(user.emailVerifiedAt).not.toBeNull();
		expect(user.mfaEnrollmentDeadline).not.toBeNull();

		expect(await count(`SELECT count(*)::int AS count FROM "UserRole" WHERE "userId" = '${outcome.userId}' AND "roleId" = '${roleId}' AND "isDeleted" = false`)).toBe(1);
		const audits = (await scratch.query('SELECT * FROM "PermissionAuditLog" ORDER BY action')).rows.map((row) => AuditRowSchema.parse(row));
		expect(audits.map((audit) => audit.action).sort()).toEqual(["ROLE_ASSIGNED_AT_PROVISIONING", "SUPER_ADMIN_BOOTSTRAPPED"]);
		for (const audit of audits) {
			expect(audit).toMatchObject({ actorKind: "SYSTEM_OPERATION", actorId: SUPERADMIN_BOOTSTRAP_OPERATION, targetUserId: outcome.userId });
			expect(audit.detail).not.toContain(PASSWORD);
			expect(z.object({ email: z.string(), ranBy: z.object({ osUser: z.string().min(1), host: z.string().min(1) }) }).parse(JSON.parse(audit.detail ?? "{}")).email).toBe(
				"root@acme.test",
			);
		}
	});

	it("restricts the first login to 2FA enrollment (verified email, enrollment already due)", async () => {
		await insertSuperAdminRole();
		const outcome = await (await newService()).bootstrap(REQUEST);

		const row = LoginRowSchema.parse(
			(
				await scratch.query(
					`SELECT id, email, "fullName" AS full_name, "passwordHash" AS "passwordHash", "isActive" AS "isActive", "isSuperAdmin" AS is_super_admin, "isDeleted", "emailVerifiedAt"::text, "mfaEnrollmentDeadline"::text, "twoFactorEnabled" FROM "User" WHERE id = $1`,
					[outcome.userId],
				)
			).rows[LIST_SLOT_INDEX.first],
		);
		const subject = {
			isEmailVerified: row.emailVerifiedAt !== null && Number(row.emailVerifiedAt) <= Date.now(),
			twoFactorEnabled: row.twoFactorEnabled,
			mfaEnrollmentDeadline: row.mfaEnrollmentDeadline === null ? null : epochMs(Number(row.mfaEnrollmentDeadline)),
			enrollmentGraceMs: config.mfa.enrollmentDeadlineMs,
		};

		expect(resolveSessionRestriction(subject, epochMs(Date.now()))).toMatchObject({ restricted: true, reason: "mfa_enrollment" });
	});

	it("is one-time: a second run refuses and changes nothing", async () => {
		await insertSuperAdminRole();
		const service = await newService();
		await service.bootstrap(REQUEST);

		await expect(service.bootstrap({ ...REQUEST, identity: { email: "second@acme.test", fullName: "Second Admin" } })).rejects.toBeInstanceOf(SuperAdminAlreadyExistsError);

		expect(await count('SELECT count(*)::int AS count FROM "User"')).toBe(1);
		expect(await count('SELECT count(*)::int AS count FROM "PermissionAuditLog"')).toBe(2);
	});

	it("lets exactly one of several concurrent runs (separate sessions) succeed", async () => {
		await insertSuperAdminRole();
		const services = await Promise.all(Array.from({ length: CONCURRENT_RUNS }, () => newService()));

		const results = await Promise.allSettled(
			services.map((service, index) => service.bootstrap({ ...REQUEST, identity: { email: `root${String(index)}@acme.test`, fullName: "Root Admin" } })),
		);

		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		for (const result of results) {
			if (result.status === "rejected") {
				expect(result.reason).toBeInstanceOf(SuperAdminAlreadyExistsError);
			}
		}
		expect(await count('SELECT count(*)::int AS count FROM "User"')).toBe(1);
		expect(await count('SELECT count(*)::int AS count FROM "UserRole"')).toBe(1);
		expect(await count('SELECT count(*)::int AS count FROM "PermissionAuditLog"')).toBe(2);
	});

	it("counts an active holder of the SuperAdmin ROLE (without the flag) as an existing SuperAdmin", async () => {
		const roleId = await insertSuperAdminRole();
		const holder = await insertUser("holder@acme.test", { isSuperAdmin: false, isActive: true, isDeleted: false });
		await scratch.query(`INSERT INTO "UserRole" (id, "userId", "roleId") VALUES ($1, $2, $3)`, [randomUUID(), holder, roleId]);

		await expect((await newService()).bootstrap(REQUEST)).rejects.toBeInstanceOf(SuperAdminAlreadyExistsError);
	});

	it("is not blocked by a deleted or deactivated SuperAdmin (only an ACTIVE one counts)", async () => {
		await insertSuperAdminRole();
		await insertUser("gone@acme.test", { isSuperAdmin: true, isActive: true, isDeleted: true });
		await insertUser("disabled@acme.test", { isSuperAdmin: true, isActive: false, isDeleted: false });

		const outcome = await (await newService()).bootstrap(REQUEST);

		expect(outcome.email).toBe("root@acme.test");
	});

	it("refuses an email that already exists, even a soft-deleted account's, and creates nothing", async () => {
		await insertSuperAdminRole();
		await insertUser("root@acme.test", { isSuperAdmin: false, isActive: true, isDeleted: true });

		await expect((await newService()).bootstrap(REQUEST)).rejects.toBeInstanceOf(BootstrapEmailTakenError);

		expect(await count('SELECT count(*)::int AS count FROM "UserRole"')).toBe(0);
	});

	it("matches the email case-insensitively (citext)", async () => {
		await insertSuperAdminRole();
		await insertUser("ROOT@acme.test", { isSuperAdmin: false, isActive: true, isDeleted: false });

		await expect((await newService()).bootstrap(REQUEST)).rejects.toBeInstanceOf(BootstrapEmailTakenError);
	});

	it("rolls everything back when the SuperAdmin role is missing (an unseeded database)", async () => {
		await expect((await newService()).bootstrap(REQUEST)).rejects.toBeInstanceOf(SuperAdminRoleMissingError);

		expect(await count('SELECT count(*)::int AS count FROM "User"')).toBe(0);
		expect(await count('SELECT count(*)::int AS count FROM "PermissionAuditLog"')).toBe(0);
	});

	it("runs end to end through the command: password from stdin, next steps printed, exit 0, then exit 1 on the repeat", async () => {
		await insertSuperAdminRole();
		const service = await newService();
		const logs: string[] = [];
		const argv = ["--email", "root@acme.test", "--full-name", "Root Admin", "--password-stdin"];
		const command = (password: string): SuperAdminBootstrapCommand =>
			new SuperAdminBootstrapCommand({
				createPasswordReader: (): PasswordReader => new StdinPasswordReader(Readable.from([`${password}\n`])),
				bootstrap: (request: BootstrapSuperAdminInput): Promise<BootstrapOutcome> => service.bootstrap(request),
				loginUrl: (): string => config.clientApps.adminUrl,
				log: (line: string): void => void logs.push(line),
			});

		expect(await command(PASSWORD).execute(argv)).toBe(BOOTSTRAP_EXIT_CODES.success);
		expect(await command(PASSWORD).execute(argv)).toBe(BOOTSTRAP_EXIT_CODES.refused);

		const output = logs.join("\n");
		expect(output).toContain("Created the first SuperAdmin");
		expect(output).toContain("Refused:");
		expect(output).not.toContain(PASSWORD);
		expect(await count('SELECT count(*)::int AS count FROM "User"')).toBe(1);
	});
});
