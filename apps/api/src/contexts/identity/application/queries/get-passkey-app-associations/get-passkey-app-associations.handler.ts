import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { PasskeyAppAssociations } from "@workspace/shared";

import { WEB_AUTHN } from "../../ports/identity.tokens";
import type { WebAuthnPort } from "../../ports/web-authn.port";
import { GetPasskeyAppAssociationsQuery } from "./get-passkey-app-associations.query";

@QueryHandler(GetPasskeyAppAssociationsQuery)
export class GetPasskeyAppAssociationsHandler implements IQueryHandler<GetPasskeyAppAssociationsQuery, PasskeyAppAssociations> {
	public constructor(@Inject(WEB_AUTHN) private readonly webAuthn: WebAuthnPort) {}

	public execute(): Promise<PasskeyAppAssociations> {
		return Promise.resolve(this.webAuthn.appAssociations());
	}
}
