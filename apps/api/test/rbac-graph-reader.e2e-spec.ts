import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Prisma } from "@prisma/client";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { PrismaRbacGraphReader } from "../src/contexts/authorization/infrastructure/persistence/prisma-rbac-graph.reader";
import { systemRlsContext } from "../src/prisma/rls-context";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";
import { createE2eApp } from "./e2e-helpers";

/**
 * Who an RBAC change touches, against the real schema. Roles are flat (ADR 067): a change reaches the
 * holders of the roles it concerns, and no one else.
 */

const HOLDER_EMAIL = "user@example.com";
const IdRowSchema = z.object({ id: z.string() });

describe("PrismaRbacGraphReader (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let holderId: string;
	let permissionId: string;
	const conferringRoleId: string = randomUUID();
	const otherRoleId: string = randomUUID();

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		holderId = IdRowSchema.parse((await pool.query(`SELECT id FROM public."User" WHERE email = $1`, [HOLDER_EMAIL])).rows.at(0)).id;
		permissionId = IdRowSchema.parse((await pool.query(`SELECT id FROM public."Permission" WHERE "isDeleted" = false ORDER BY id LIMIT 1`)).rows.at(0)).id;
		await pool.query(`INSERT INTO public."Role" (id, name) VALUES ($1, $2)`, [conferringRoleId, `e2e-conferring-${conferringRoleId}`]);
		await pool.query(`INSERT INTO public."Role" (id, name) VALUES ($1, $2)`, [otherRoleId, `e2e-other-${otherRoleId}`]);
		await pool.query(`INSERT INTO public."RolePermission" (id, "roleId", "permissionId", "assignedBy") VALUES ($1, $2, $3, $4)`, [
			randomUUID(),
			conferringRoleId,
			permissionId,
			holderId,
		]);
		await pool.query(`INSERT INTO public."UserRole" (id, "userId", "roleId", "assignedBy") VALUES ($1, $2, $3, $4)`, [randomUUID(), holderId, conferringRoleId, holderId]);
	});

	afterAll(async () => {
		// Fixture teardown through the superuser pool: these rows exist only for this spec.
		await pool.query(`DELETE FROM public."UserRole" WHERE "roleId" = ANY($1)`, [[conferringRoleId, otherRoleId]]);
		await pool.query(`DELETE FROM public."RolePermission" WHERE "roleId" = ANY($1)`, [[conferringRoleId, otherRoleId]]);
		await pool.query(`DELETE FROM public."Role" WHERE id = ANY($1)`, [[conferringRoleId, otherRoleId]]);
		await pool.end();
		await app.close();
	});

	async function onGraph<Result>(read: (graph: PrismaRbacGraphReader) => Promise<Result>): Promise<Result> {
		return app
			.get(TenantTransactionService)
			.withRlsContext({ context: systemRlsContext("authorization.rbac.mutate"), reason: "Read who an RBAC change touches" }, (tx: Prisma.TransactionClient): Promise<Result> =>
				read(new PrismaRbacGraphReader(tx)),
			);
	}

	it("counts the holders of a role that confers a permission among its holders", async () => {
		expect(await onGraph((graph) => graph.holdersOfPermission(permissionId))).toContain(holderId);
	});

	it("reaches exactly a role's own holders", async () => {
		expect(await onGraph((graph) => graph.holdersOfRole(conferringRoleId))).toContain(holderId);
		expect(await onGraph((graph) => graph.holdersOfRole(otherRoleId))).toEqual([]);
	});

	it("names the active roles it is given, and only those", async () => {
		expect(await onGraph((graph) => graph.activeRoleNames([conferringRoleId]))).toEqual(new Set([`e2e-conferring-${conferringRoleId}`]));
		expect(await onGraph((graph) => graph.activeRoleNames([]))).toEqual(new Set());
	});
});
