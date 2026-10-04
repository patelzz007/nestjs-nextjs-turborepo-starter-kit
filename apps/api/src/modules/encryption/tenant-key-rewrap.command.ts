import { z } from "zod";

import { RequestContextService } from "../../common/context/request-context";
import { getApiConfig } from "../../config/api-config";
import { TypedConfigService } from "../../config/typed-config.service";
import { PrismaService } from "../../prisma/prisma.service";
import { TenantTransactionService } from "../../prisma/tenant-transaction.service";
import { CedarWasmPolicyEngine } from "../authorization-cedar/engine/cedar-wasm-policy-engine";
import { CedarPolicyEvaluatorService } from "../authorization-cedar/services/cedar-policy-evaluator.service";
import { OrganizationAuditService } from "../organization/services/organization-audit.service";
import { createTenantKeyManagement } from "./kms/tenant-key-management.factory";
import { TenantEncryptionKeyRepository } from "./tenant-encryption-key.repository";
import { TenantEncryptionService, type TenantKeyRewrapSummary } from "./tenant-encryption.service";

const ACTOR_FLAG = "--actor-user-id";

/** Exit codes of the re-wrap command. */
export const REWRAP_EXIT_CODES = { success: 0, keysFailed: 1, usage: 64 } satisfies Record<string, number>;

export const TenantKeyRewrapArgsSchema = z.object({ actorUserId: z.uuid({ error: `${ACTOR_FLAG} must be the id (uuid) of an active SuperAdmin` }) });
export type TenantKeyRewrapArgs = z.output<typeof TenantKeyRewrapArgsSchema>;

/** `--actor-user-id <uuid>` (also `--actor-user-id=<uuid>`). */
export function parseTenantKeyRewrapArgs(argv: readonly string[]): TenantKeyRewrapArgs {
	const inline: string | undefined = argv.find((arg: string): boolean => arg.startsWith(`${ACTOR_FLAG}=`));
	const flagIndex: number = argv.indexOf(ACTOR_FLAG);
	const actorUserId: string | undefined = inline?.slice(ACTOR_FLAG.length + 1) ?? (flagIndex === -1 ? undefined : argv[flagIndex + 1]);
	return TenantKeyRewrapArgsSchema.parse({ actorUserId });
}

/** Human-readable outcome; never prints key material. */
export function formatRewrapSummary(summary: TenantKeyRewrapSummary): string {
	const lines: string[] = [
		`Target KEK: ${summary.targetKmsKeyId}`,
		`Re-wrapped: ${String(summary.rewrapped)}`,
		`Already updated concurrently: ${String(summary.concurrentlyUpdated)}`,
		`Failed: ${String(summary.failures.length)}`,
		...summary.failures.map((failure) => `  - key ${failure.tenantKeyId} (organization ${failure.organizationId}, ${failure.kmsKeyId}): ${failure.reason}`),
	];
	return lines.join("\n");
}

/**
 * Operational entry point (`pnpm db:rewrap-tenant-keys -- --actor-user-id <uuid>`):
 * composes the encryption service by hand (no Nest container — the script runs
 * under tsx without decorator metadata) and re-wraps every data key to the
 * current KEK. Exits non-zero if any key could not be re-wrapped.
 */
export async function runTenantKeyRewrap(argv: readonly string[], log: (line: string) => void): Promise<number> {
	let args: TenantKeyRewrapArgs;
	try {
		args = parseTenantKeyRewrapArgs(argv);
	} catch (error) {
		if (error instanceof z.ZodError) {
			log(`Usage: ${ACTOR_FLAG} <superadmin user id>\n${z.prettifyError(error)}`);
			return REWRAP_EXIT_CODES.usage;
		}
		throw error;
	}

	const config = new TypedConfigService(getApiConfig());
	const prisma = new PrismaService(config);
	try {
		const requestContext = new RequestContextService();
		const tenantTx = new TenantTransactionService(prisma, requestContext);
		const service = new TenantEncryptionService(
			tenantTx,
			new TenantEncryptionKeyRepository(),
			new OrganizationAuditService(),
			new CedarPolicyEvaluatorService(tenantTx, new CedarWasmPolicyEngine()),
			requestContext,
			createTenantKeyManagement(config),
		);
		const summary: TenantKeyRewrapSummary = await service.rewrapToCurrentKek(args.actorUserId);
		log(formatRewrapSummary(summary));
		return summary.failures.length === 0 ? REWRAP_EXIT_CODES.success : REWRAP_EXIT_CODES.keysFailed;
	} finally {
		await prisma.$disconnect();
	}
}
