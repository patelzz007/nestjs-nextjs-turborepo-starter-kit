import { ApiErrorCodes } from "@workspace/shared";

import { AuthenticationError, NotFoundError, ValidationError } from "../../../../platform/application/errors/app-error";
import { GEO_ENTITY_LABEL, type GeoEntityKind } from "../../domain/value-objects/geo-entity-kind.value-object";

/** 404 — the row is missing or soft-deleted. */
export function geoNotFound(entity: GeoEntityKind, id: number): NotFoundError {
	return new NotFoundError({ message: `${GEO_ENTITY_LABEL[entity]} #${String(id)} not found` });
}

/** 400 — a body references a parent row which does not exist (or was soft-deleted). */
export function geoMissingParent(field: string, entity: GeoEntityKind, id: number): ValidationError {
	return new ValidationError({
		message: `${field} does not reference an existing ${entity}`,
		details: { issues: [{ path: field, message: `${entity} #${String(id)} does not exist`, code: ApiErrorCodes.VALIDATION_ERROR }] },
	});
}

/** 401 — a geo write without a signed-in user to stamp and audit it with. */
export function geoWriterMissing(): AuthenticationError {
	return new AuthenticationError({ message: "Geo writes require an authenticated SuperAdmin." });
}
