import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { CedarPolicyEvaluatorPort } from "../../application/ports/cedar-policy-evaluator.port";
import { CedarPolicyEvaluatorService } from "./cedar-policy-evaluator.service";
import { CedarWasmPolicyEngine } from "./cedar-wasm-policy-engine";

/**
 * The Cedar evaluator for composition roots that run without the Nest container (CLIs). Its bundle cache
 * is not registered with the cross-instance invalidation channel: a CLI process is short-lived.
 */
export function createCedarPolicyEvaluator(transactions: TenantTransactionService): CedarPolicyEvaluatorPort {
	return new CedarPolicyEvaluatorService(transactions, new CedarWasmPolicyEngine());
}
