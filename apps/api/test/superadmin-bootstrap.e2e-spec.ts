import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

import * as bcrypt from "bcrypt";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { z } from "zod";

import { TypedConfigService } from "../src/config/typed-config.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { SessionRestrictionService } from "../src/modules/auth/services/session-restriction.service";
import type { UserLogin } from "../src/modules/auth/repositories/user.repository";
import { StdinPasswordReader, type PasswordReader } from "../src/modules/auth/bootstrap/password-reader";
import { SuperAdminBootstrapCommand } from "../src/modules/auth/bootstrap/superadmin-bootstrap.command";
import { createSuperAdminBootstrapService } from "../src/modules/auth/bootstrap/superadmin-bootstrap.composition";
import { BOOTSTRAP_EXIT_CODES, SUPERADMIN_BOOTSTRAP_OPERATION } from "../src/modules/auth/bootstrap/superadmin-bootstrap.constants";
import { BootstrapEmailTakenError, SuperAdminAlreadyExistsError, SuperAdminRoleMissingError } from "../src/modules/auth/bootstrap/superadmin-bootstrap.errors";
import type { BootstrapOutcome, BootstrapRequest, SuperAdminBootstrapService } from "../src/modules/auth/bootstrap/superadmin-bootstrap.service";
import { createScratchDatabase, SCRATCH_SETUP_TIMEOUT_MS, type ScratchDatabase } from "./support/scratch-database";
import { createTestTypedConfig } from "./support/test-api-env";

/**
 * The one-time SuperAdmin bootstrap against a THROWAWAY database this file creates (migrated + RLS-applied,
 * but unseeded — exactly a real deployment) and drops afterwards. The shared dev database is never touched:
 * its server is only used to `CREATE DATABASE` / `DROP DATABASE` the scratch one.
 */

const PASSWORD = "Corr3ct-Horse-Battery!";
const REQUEST: BootstrapRequest = { identity: { email: "root@acme.test", fullName: "Root Admin" }, password: PASSWORD };
const CONCURRENT_RUNS = 4;

const CountRowSchema = z.object({ count: z.number() });
const LoginRowSchema = z.object({
	id: z.string(),
	email: z.string(),
	full_name: z.string(),
	password_hash: z.string(),
	is_active: z.boolean(),
	is_super_admin: z.boolean(),
	is_deleted: z.boolean(),
	email_verified_at: z.string().nullable(),
	mfa_enrollment_deadline: z.string().nullable(),
	two_factor_enabled: z.boolean(),
});
const AuditRowSchema = z.object({ action: z.string(), actor_kind: z.string(), actor_id: z.string(), target_user_id: z.string().nullable(), detail: z.string().nullable() });

describe("SuperAdmin bootstrap (integration, scratch database)", () => {
	let database: ScratchDatabase;
	let scratch: Pool;
	let config: TypedConfigService;
	const prismas: PrismaService[] = [];

	/** A fresh service over its OWN connection pool — each concurrent run is a separate database session, like separate CLI processes. */
	async function newService(): Promise<SuperAdminBootstrapService> {
		const prisma = new PrismaService(config);
		prisma.onModuleInit();
		await prisma.ensureConnected();
		prismas.push(prisma);
		return createSuperAdminBootstrapService(config, prisma);
	}

	async function count(sql: string): Promise<number> {
		return CountRowSchema.parse((await scratch.query(sql)).rows[0]).count;
	}

	async function insertSuperAdminRole(): Promise<string> {
		const id = randomUUID();
		await scratch.query(`INSERT INTO roles (id, name, "isSystem") VALUES ($1, 'SuperAdmin', true)`, [id]);
		return id;
	}

	async function insertUser(email: string, flags: { readonly isSuperAdmin: boolean; readonly isActive: boolean; readonly isDeleted: boolean }): Promise<string> {
		const id = randomUUID();
		await scratch.query(`INSERT INTO users (id, email, "fullName", "passwordHash", "isSuperAdmin", "isActive", is_deleted) VALUES ($1, $2, 'Existing', 'x', $3, $4, $5)`, [
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
		await scratch.query("TRUNCATE users, roles, permission_audit_logs CASCADE");
	});

	afterAll(async () => {
		await Promise.all(prismas.map((prisma: PrismaService): Promise<void> => prisma.onModuleDestroy()));
		await database.drop();
	});

	it("creates a verified SuperAdmin with a real bcrypt hash, the role, and audit rows naming the system operation", async () => {
		const roleId = await insertSuperAdminRole();
		const outcome = await (await newService()).bootstrap(REQUEST);

		const user = LoginRowSchema.parse(
			(
				await scratch.query(
					`SELECT id, email, "fullName" AS full_name, "passwordHash" AS password_hash, "isActive" AS is_active, "isSuperAdmin" AS is_super_admin, is_deleted, email_verified_at::text, mfa_enrollment_deadline::text, two_factor_enabled FROM users WHERE id = $1`,
					[outcome.userId],
				)
			).rows[0],
		);
		expect(user).toMatchObject({ email: "root@acme.test", full_name: "Root Admin", is_active: true, is_super_admin: true, is_deleted: false, two_factor_enabled: false });
		expect(user.password_hash).not.toContain(PASSWORD);
		expect(await bcrypt.compare(PASSWORD, user.password_hash)).toBe(true);
		expect(user.email_verified_at).not.toBeNull();
		expect(user.mfa_enrollment_deadline).not.toBeNull();

		expect(await count(`SELECT count(*)::int AS count FROM user_roles WHERE "userId" = '${outcome.userId}' AND "roleId" = '${roleId}' AND is_deleted = false`)).toBe(1);
		const audits = (await scratch.query("SELECT * FROM permission_audit_logs ORDER BY action")).rows.map((row) => AuditRowSchema.parse(row));
		expect(audits.map((audit) => audit.action).sort()).toEqual(["ROLE_ASSIGNED_AT_PROVISIONING", "SUPER_ADMIN_BOOTSTRAPPED"]);
		for (const audit of audits) {
			expect(audit).toMatchObject({ actor_kind: "SYSTEM_OPERATION", actor_id: SUPERADMIN_BOOTSTRAP_OPERATION, target_user_id: outcome.userId });
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
					`SELECT id, email, "fullName" AS full_name, "passwordHash" AS password_hash, "isActive" AS is_active, "isSuperAdmin" AS is_super_admin, is_deleted, email_verified_at::text, mfa_enrollment_deadline::text, two_factor_enabled FROM users WHERE id = $1`,
					[outcome.userId],
				)
			).rows[0],
		);
		const login: UserLogin = {
			id: row.id,
			email: row.email,
			fullName: row.full_name,
			isActive: row.is_active,
			isSuperAdmin: row.is_super_admin,
			createdAt: BigInt(0),
			updatedAt: BigInt(0),
			isDeleted: row.is_deleted,
			deletedAt: null,
			emailVerifiedAt: row.email_verified_at === null ? null : BigInt(row.email_verified_at),
			tokenVersion: 0,
			twoFactorEnabled: row.two_factor_enabled,
			mfaEnrollmentDeadline: row.mfa_enrollment_deadline === null ? null : BigInt(row.mfa_enrollment_deadline),
			mfaAssuredAt: null,
			passwordHash: row.password_hash,
			failedLoginAttempts: 0,
			lockedUntil: null,
		};

		expect(new SessionRestrictionService(config).resolveSessionRestriction(login, true, Date.now())).toMatchObject({ restricted: true, reason: "mfa_enrollment" });
	});

	it("is one-time: a second run refuses and changes nothing", async () => {
		await insertSuperAdminRole();
		const service = await newService();
		await service.bootstrap(REQUEST);

		await expect(service.bootstrap({ ...REQUEST, identity: { email: "second@acme.test", fullName: "Second Admin" } })).rejects.toBeInstanceOf(SuperAdminAlreadyExistsError);

		expect(await count("SELECT count(*)::int AS count FROM users")).toBe(1);
		expect(await count("SELECT count(*)::int AS count FROM permission_audit_logs")).toBe(2);
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
		expect(await count("SELECT count(*)::int AS count FROM users")).toBe(1);
		expect(await count("SELECT count(*)::int AS count FROM user_roles")).toBe(1);
		expect(await count("SELECT count(*)::int AS count FROM permission_audit_logs")).toBe(2);
	});

	it("counts an active holder of the SuperAdmin ROLE (without the flag) as an existing SuperAdmin", async () => {
		const roleId = await insertSuperAdminRole();
		const holder = await insertUser("holder@acme.test", { isSuperAdmin: false, isActive: true, isDeleted: false });
		await scratch.query(`INSERT INTO user_roles (id, "userId", "roleId") VALUES ($1, $2, $3)`, [randomUUID(), holder, roleId]);

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

		expect(await count("SELECT count(*)::int AS count FROM user_roles")).toBe(0);
	});

	it("matches the email case-insensitively (citext)", async () => {
		await insertSuperAdminRole();
		await insertUser("ROOT@acme.test", { isSuperAdmin: false, isActive: true, isDeleted: false });

		await expect((await newService()).bootstrap(REQUEST)).rejects.toBeInstanceOf(BootstrapEmailTakenError);
	});

	it("rolls everything back when the SuperAdmin role is missing (an unseeded database)", async () => {
		await expect((await newService()).bootstrap(REQUEST)).rejects.toBeInstanceOf(SuperAdminRoleMissingError);

		expect(await count("SELECT count(*)::int AS count FROM users")).toBe(0);
		expect(await count("SELECT count(*)::int AS count FROM permission_audit_logs")).toBe(0);
	});

	it("runs end to end through the command: password from stdin, next steps printed, exit 0, then exit 1 on the repeat", async () => {
		await insertSuperAdminRole();
		const service = await newService();
		const logs: string[] = [];
		const argv = ["--email", "root@acme.test", "--full-name", "Root Admin", "--password-stdin"];
		const command = (password: string): SuperAdminBootstrapCommand =>
			new SuperAdminBootstrapCommand({
				createPasswordReader: (): PasswordReader => new StdinPasswordReader(Readable.from([`${password}\n`])),
				bootstrap: (request: BootstrapRequest): Promise<BootstrapOutcome> => service.bootstrap(request),
				loginUrl: (): string => config.adminAppUrl,
				log: (line: string): void => void logs.push(line),
			});

		expect(await command(PASSWORD).execute(argv)).toBe(BOOTSTRAP_EXIT_CODES.success);
		expect(await command(PASSWORD).execute(argv)).toBe(BOOTSTRAP_EXIT_CODES.refused);

		const output = logs.join("\n");
		expect(output).toContain("Created the first SuperAdmin");
		expect(output).toContain("Refused:");
		expect(output).not.toContain(PASSWORD);
		expect(await count("SELECT count(*)::int AS count FROM users")).toBe(1);
	});
});
