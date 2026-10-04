import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AuthorizationModule } from "../authorization/authorization.module";
import { PolicyControlPlaneController } from "./controllers/policy-control-plane.controller";
import { CedarWasmPolicyEngine } from "./engine/cedar-wasm-policy-engine";
import { POLICY_ENGINE } from "./engine/policy-engine.port";
import { PolicyControlPlaneRepository } from "./repositories/policy-control-plane.repository";
import { CedarPolicyEvaluatorService } from "./services/cedar-policy-evaluator.service";
import { PolicyBundleCacheRegistration } from "./services/policy-bundle-cache.registration";
import { PolicyControlPlaneService } from "./services/policy-control-plane.service";
import { PolicySimulationService } from "./services/policy-simulation.service";

/**
 * Imports AuthModule for the `@SuperAdminOnly()` guards (AuthGuard needs TokenService and the
 * impersonation session state) and AuthorizationModule for the cross-instance invalidation channel.
 */
@Module({
	imports: [AuthModule, AuthorizationModule],
	controllers: [PolicyControlPlaneController],
	providers: [
		{ provide: POLICY_ENGINE, useClass: CedarWasmPolicyEngine },
		CedarPolicyEvaluatorService,
		PolicyControlPlaneRepository,
		PolicySimulationService,
		PolicyControlPlaneService,
		PolicyBundleCacheRegistration,
	],
	exports: [CedarPolicyEvaluatorService, PolicyControlPlaneService],
})
export class AuthorizationCedarModule {}
