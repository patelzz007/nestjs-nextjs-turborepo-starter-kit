import { Query } from "@nestjs/cqrs";
import type { FastifyRequest } from "fastify";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { PersonalDataExport } from "./export-personal-data.handler";

/** "Download my data" for the signed-in person (ADR 077). */
export class ExportPersonalDataQuery extends Query<PersonalDataExport> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly request: FastifyRequest,
	) {
		super();
	}
}
