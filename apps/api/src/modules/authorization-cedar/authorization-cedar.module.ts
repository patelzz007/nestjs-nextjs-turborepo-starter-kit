import { Module } from "@nestjs/common";

import { PolicyControlPlaneController } from "./controllers/policy-control-plane.controller";
import { CedarPolicyEvaluatorService } from "./services/cedar-policy-evaluator.service";
import { PolicyControlPlaneService } from "./services/policy-control-plane.service";

@Module({
	controllers: [PolicyControlPlaneController],
	providers: [CedarPolicyEvaluatorService, PolicyControlPlaneService],
	exports: [CedarPolicyEvaluatorService, PolicyControlPlaneService],
})
export class AuthorizationCedarModule {}
