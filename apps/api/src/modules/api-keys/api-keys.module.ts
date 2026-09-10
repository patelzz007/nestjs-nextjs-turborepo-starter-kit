import { Global, Module } from "@nestjs/common";

import { RewardsPersistenceModule } from "../rewards/rewards-persistence.module";
import { RewardsCoreServicesModule } from "../rewards/rewards-core-services.module";

import { ApiKeyAuthGuard } from "./guards/api-key-auth.guard";
import { MerchantActorInterceptor } from "./interceptors/merchant-actor.interceptor";
import { ApiKeyAuthService } from "./services/api-key-auth.service";
import { MerchantApiKeyVerificationService } from "./services/merchant-api-key-verification.service";
import { MerchantRequestAuthService } from "./services/merchant-request-auth.service";

@Global()
@Module({
	imports: [RewardsPersistenceModule, RewardsCoreServicesModule],
	providers: [MerchantApiKeyVerificationService, ApiKeyAuthService, MerchantRequestAuthService, ApiKeyAuthGuard, MerchantActorInterceptor],
	exports: [MerchantApiKeyVerificationService, ApiKeyAuthService, MerchantRequestAuthService, ApiKeyAuthGuard, MerchantActorInterceptor],
})
export class ApiKeysModule {}
