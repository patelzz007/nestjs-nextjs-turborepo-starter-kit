import { Inject, Injectable } from "@nestjs/common";
import type { PasskeyAppAssociations } from "@workspace/shared";

import { WEB_AUTHN } from "../ports/identity.tokens";
import type { WebAuthnPort } from "../ports/web-authn.port";

/** The apps this deployment's passkeys are bound to (ADR 096), as the mobile and web clients fetch them. */
@Injectable()
export class PasskeyAppAssociationsApplicationService {
	public constructor(@Inject(WEB_AUTHN) private readonly webAuthn: WebAuthnPort) {}

	public appAssociations(): PasskeyAppAssociations {
		return this.webAuthn.appAssociations();
	}
}
