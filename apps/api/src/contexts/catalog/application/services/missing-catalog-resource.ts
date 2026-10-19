import { NotFoundError } from "../../../../platform/application/errors/app-error";

/** Same client message the old catalog service returned for a missing id. */
export function missingCatalogResource(id: string): NotFoundError {
	return new NotFoundError({ message: "The requested resource was not found.", details: { resourceId: id } });
}
