import { Injectable } from "@nestjs/common";

import type { AllowApiKeyAuthOptions } from "../decorators/allow-api-key-auth.decorator";
import type { ApiKeyAuthContext, ApiKeyProvider } from "../types/api-key-auth.types";
import { MerchantApiKeyVerificationService } from "./merchant-api-key-verification.service";

@Injectable()
export class ApiKeyAuthService {
	public constructor(private readonly merchantApiKeyVerification: MerchantApiKeyVerificationService) {}

	public async authenticate(plaintext: string, options: AllowApiKeyAuthOptions): Promise<ApiKeyAuthContext | null> {
		const providers: readonly ApiKeyProvider[] = options.providers ?? ["merchant"];

		if (providers.includes("merchant")) {
			const merchantContext = await this.merchantApiKeyVerification.verify(plaintext);
			if (merchantContext !== null) {
				return merchantContext;
			}
		}

		return null;
	}
}
