import { ConflictError, NotFoundError, ValidationError } from "../../common/errors/app-error";

/** 404 — the repository could not find the (non-deleted) row it was asked to act on. */
export class ResourceNotFoundError extends NotFoundError {
	public constructor(public readonly resourceId: string) {
		// The id is the caller's own input, so echoing it back is safe.
		super({ message: "The requested resource was not found.", details: { resourceId } });
	}
}

/**
 * 409 — the row exists but the conditional update matched nothing: another
 * request changed it after the caller read it (stale `version`). The client
 * reloads the resource and retries with the current version.
 */
export class ConcurrentModificationError extends ConflictError {
	public constructor(public readonly resourceId: string) {
		super({ message: "The resource was changed by another request. Reload it and try again.", details: { resourceId } });
	}
}

/**
 * A repository was called in a way its configuration forbids (e.g. `softDelete`
 * on a hard-delete repository, or cascade ports missing). This is a programming
 * error, not a client error — the global exception filter answers 500
 * INTERNAL_ERROR and logs the message server-side.
 */
export class RepositoryMisconfiguredError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "RepositoryMisconfiguredError";
	}
}

/** 400 — the list `cursor` is malformed, stale, or combined with a non-default sort. */
export class InvalidListCursorError extends ValidationError {
	public constructor(message: string) {
		super({ message, details: { issues: [{ path: "cursor", message, code: "invalid_cursor" }] } });
	}
}

/** 400 — the resource only supports offset (`page`) pagination. */
export class CursorPaginationUnsupportedError extends ValidationError {
	public constructor() {
		const message = "This list does not support cursor pagination; paginate with `page`.";
		super({ message, details: { issues: [{ path: "cursor", message, code: "cursor_unsupported" }] } });
	}
}
