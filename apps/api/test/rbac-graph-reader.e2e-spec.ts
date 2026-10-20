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
 * Who an RBAC change touches, against the real schema: a child role inherits its parent's permissions,
 * so a change to a permission the PARENT confers reaches holders of the CHILD as well.
 */

const HOLDER_EMAIL = "user@example.com";
const IdRowSchema = z.object({ id: z.string() });

describe("PrismaRbacGraphReader (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let holderId: string;
	let permissionId: string;
	const parentRoleId: string = randomUUID();
	const childRoleId: string = randomUUID();

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		holderId = IdRowSchema.parse((await pool.query(`SELECT id FROM public."User" WHERE email = $1`, [HOLDER_EMAIL])).rows.at(0)).id;
		permissionId = IdRowSchema.parse((await pool.query(`SELECT id FROM public."Permission" WHERE "isDeleted" = false ORDER BY id LIMIT 1`)).rows.at(0)).id;
		await pool.query(`INSERT INTO public."Role" (id, name) VALUES ($1, $2)`, [parentRoleId, `e2e-parent-${parentRoleId}`]);
		await pool.query(`INSERT INTO public."Role" (id, name, "parentId") VALUES ($1, $2, $3)`, [childRoleId, `e2e-child-${childRoleId}`, parentRoleId]);
		await pool.query(`INSERT INTO public."RolePermission" (id, "roleId", "permissionId", "assignedBy") VALUES ($1, $2, $3, $4)`, [
			randomUUID(),
			parentRoleId,
			permissionId,
			holderId,
		]);
		await pool.query(`INSERT INTO public."UserRole" (id, "userId", "roleId", "assignedBy") VALUES ($1, $2, $3, $4)`, [randomUUID(), holderId, childRoleId, holderId]);
	});

	afterAll(async () => {
		// Fixture teardown through the superuser pool: these rows exist only for this spec.
		await pool.query(`DELETE FROM public."UserRole" WHERE "roleId" = ANY($1)`, [[parentRoleId, childRoleId]]);
		await pool.query(`DELETE FROM public."RolePermission" WHERE "roleId" = ANY($1)`, [[parentRoleId, childRoleId]]);
		await pool.query(`DELETE FROM public."Role" WHERE id = ANY($1)`, [[childRoleId, parentRoleId]]);
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

	it("counts a holder of a child role among the holders of a permission its parent confers", async () => {
		expect(await onGraph((graph) => graph.holdersOfPermission(permissionId))).toContain(holderId);
	});

	it("counts holders of every role below a role in its lineage", async () => {
		expect(await onGraph((graph) => graph.holdersOfLineage(parentRoleId))).toContain(holderId);
		expect(await onGraph((graph) => graph.holdersOfLineage(childRoleId))).toContain(holderId);
	});

	it("walks ancestors for effective roles: the child role carries its parent", async () => {
		const ancestry = await onGraph((graph) => graph.withAllAncestors([childRoleId]));

		expect([...ancestry].sort()).toEqual([childRoleId, parentRoleId].sort());
		expect(await onGraph((graph) => graph.effectiveRoleNames([childRoleId]))).toEqual(new Set([`e2e-child-${childRoleId}`, `e2e-parent-${parentRoleId}`]));
	});
});
