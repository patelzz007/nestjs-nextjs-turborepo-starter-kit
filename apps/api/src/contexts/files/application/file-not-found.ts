import { NotFoundError } from "../../../platform/application/errors/app-error";

/** The one 404 every files use case answers with: unknown, deleted, or not visible to the caller (existence is never leaked). */
export function fileNotFound(): NotFoundError {
	return new NotFoundError({ code: "FILE_NOT_FOUND", message: "File not found" });
}
