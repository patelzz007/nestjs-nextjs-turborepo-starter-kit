import { Global, Module } from "@nestjs/common";

import { PrismaService } from "./prisma.service";
import { SystemPrismaService } from "./system-prisma.service";
import { TenantTransactionService } from "./tenant-transaction.service";

@Global()
@Module({
	providers: [PrismaService, SystemPrismaService, TenantTransactionService],
	exports: [PrismaService, SystemPrismaService, TenantTransactionService],
})
export class PrismaModule {}
