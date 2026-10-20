import { Global, Module } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { API_KEY_VERIFICATION } from "../../../platform/application/ports/api-key-verification.port";
import { TILL_RESOLVER } from "../../../platform/application/ports/till-resolution.port";
import { SystemCommandModule } from "../../../platform/infrastructure/system-command.module";
import { PrismaReadExecutor } from "../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import { PrismaModule } from "../../../prisma/prisma.module";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { API_KEY_CAPABILITIES, STORE_CLOSURE_FACTORY, type ApiKeyCapabilitiesPort } from "../../tenancy/public-api";
import { TILL_TERMINALS } from "../application/ports/pos.tokens";
import { TillAuthenticationService } from "../application/services/till-authentication.service";
import { ApiKeyCapabilitiesAdapter } from "./adapters/api-key-capabilities.adapter";
import { PrismaApiKeyVerifier } from "./adapters/prisma-api-key-verifier";
import { PRISMA_STORE_CLOSURE_FACTORY } from "./adapters/prisma-store-closure";
import { PrismaTillTerminals } from "./adapters/prisma-till-terminals";

/**
 * What pos provides to code that must not import it (a leaf: platform and tenants' tokens only):
 * the merchant key verification and till resolution the security kit's guards use
 * (`API_KEY_VERIFICATION`, `TILL_RESOLVER`), and the two
 * ports tenants consumes — an API key's capabilities (`API_KEY_CAPABILITIES`) and store closure
 * (`STORE_CLOSURE_FACTORY`). Global, like identity's security kit, so neither side imports the other's
 * module and the graph stays acyclic without `forwardRef`.
 */
@Global()
@Module({
	imports: [PrismaModule, SystemCommandModule],
	providers: [
		PrismaApiKeyVerifier,
		{ provide: API_KEY_VERIFICATION, useExisting: PrismaApiKeyVerifier },
		PrismaTillTerminals,
		{ provide: TILL_TERMINALS, useExisting: PrismaTillTerminals },
		TillAuthenticationService,
		{ provide: TILL_RESOLVER, useExisting: TillAuthenticationService },
		{
			provide: API_KEY_CAPABILITIES,
			inject: [TenantTransactionService],
			useFactory: (transactions: TenantTransactionService): ApiKeyCapabilitiesPort =>
				new ApiKeyCapabilitiesAdapter(new PrismaReadExecutor<Prisma.TransactionClient>(transactions)),
		},
		{ provide: STORE_CLOSURE_FACTORY, useValue: PRISMA_STORE_CLOSURE_FACTORY },
	],
	exports: [API_KEY_VERIFICATION, TILL_RESOLVER, API_KEY_CAPABILITIES, STORE_CLOSURE_FACTORY],
})
export class PosAccessModule {}
