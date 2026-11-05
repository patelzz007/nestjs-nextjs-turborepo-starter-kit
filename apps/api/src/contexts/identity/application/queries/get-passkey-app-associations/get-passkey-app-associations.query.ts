import { Query } from "@nestjs/cqrs";
import type { PasskeyAppAssociations } from "@workspace/shared";

/** The native apps allowed to use this deployment's passkeys (ADR 080): configuration only, no account involved. */
export class GetPasskeyAppAssociationsQuery extends Query<PasskeyAppAssociations> {}
