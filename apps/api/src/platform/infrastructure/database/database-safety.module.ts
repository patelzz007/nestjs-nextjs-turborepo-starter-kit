import { Module } from "@nestjs/common";

import { PrismaModule } from "../../../prisma/prisma.module";
import { RuntimeRoleCatalog, RuntimeRoleProof } from "./runtime-role-proof";

/** Proves at boot, and on every readiness probe, that the database enforces tenant isolation (D9). */
@Module({
	imports: [PrismaModule],
	providers: [RuntimeRoleCatalog, RuntimeRoleProof],
	exports: [RuntimeRoleProof],
})
export class DatabaseSafetyModule {}
