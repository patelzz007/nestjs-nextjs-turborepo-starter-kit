/* eslint-disable @darraghor/nestjs-typed/injectable-should-be-provided,@darraghor/nestjs-typed/controllers-should-supply-api-tags,@darraghor/nestjs-typed/api-method-should-specify-api-response -- Test-only controller wired into a throwaway TestingModule in webhook-rate-limit.spec.ts; it is never registered in a Nest module nor exposed via Swagger. */

import { Controller, ForbiddenException, Get, UseGuards } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * Test-only controller for the webhook rate-limit spec.
 *
 * Deliberately lives OUTSIDE the `.spec.ts` file (in a real source file) so the
 * decorators are transformed by Vite/esbuild with the API tsconfig — the spec
 * files are excluded from `tsconfig.json`, and Vite fails to transform inline
 * decorators inside a spec. This mirrors how every other spec in this project
 * imports its decorated controllers.
 *
 * It is never registered in any Nest module — only the `webhook-rate-limit.spec.ts`
 * wires it into a throwaway `TestingModule` to exercise `ThrottlerGuard`.
 */
@Controller("probe")
export class ProbeController {
	@UseGuards(ThrottlerGuard)
	@Get()
	public ping(): { readonly ok: true } {
		return { ok: true };
	}

	/**
	 * Mimics a signature-rejected request: the handler throws 403 like the real
	 * webhook does on a bad signature. The guard runs BEFORE the handler, so
	 * these requests still consume the per-IP bucket — proving that a flood of
	 * invalid requests is throttled too (brute-force protection).
	 */
	@UseGuards(ThrottlerGuard)
	@Get("forbidden")
	public forbidden(): void {
		throw new ForbiddenException("Invalid webhook signature");
	}
}
