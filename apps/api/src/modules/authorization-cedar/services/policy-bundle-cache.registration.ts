import { Injectable, type OnModuleInit } from "@nestjs/common";

import { AuthorizationInvalidationService } from "../../authorization/cache/authorization-invalidation.service";
import { CedarPolicyEvaluatorService } from "./cedar-policy-evaluator.service";

/**
 * Wires the evaluator's per-process bundle cache into the shared
 * authorization invalidation channel, so a publish on any instance drops the
 * stale bundles everywhere. Kept apart from the evaluator (single
 * responsibility): the evaluator only knows how to drop its own entries.
 */
@Injectable()
export class PolicyBundleCacheRegistration implements OnModuleInit {
	public constructor(
		private readonly invalidation: AuthorizationInvalidationService,
		private readonly evaluator: CedarPolicyEvaluatorService,
	) {}

	public onModuleInit(): void {
		this.invalidation.registerPolicyBundleCache(this.evaluator);
	}
}
