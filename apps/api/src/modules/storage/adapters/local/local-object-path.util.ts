import { isAbsolute, relative, resolve, sep } from "node:path";

/** A container is one directory name: lowercase letters, digits, dot, dash, underscore — never "." or "..". */
const CONTAINER_PATTERN = /^[a-z0-9][a-z0-9._-]{0,62}$/;
/** Object keys are "/"-separated segments; characters that alter path resolution are refused outright. */
const FORBIDDEN_KEY_CHARACTERS = /[\\\0]/;
const MAX_OBJECT_KEY_LENGTH = 1_024;
const RELATIVE_SEGMENTS: ReadonlySet<string> = new Set<string>([".", ".."]);

/** The requested container/key cannot be mapped to a file inside the storage root. */
export class InvalidLocalObjectPathError extends Error {
	public constructor(reason: string) {
		super(`Invalid local object path: ${reason}`);
		this.name = "InvalidLocalObjectPathError";
	}
}

/**
 * Maps `container` + object `key` to an absolute file path that is guaranteed
 * to sit inside `root`. Validation is structural (every segment checked) and
 * then re-verified on the resolved path, so neither "..", absolute keys,
 * backslashes, NUL bytes, nor an empty segment can escape the root.
 */
export function resolveLocalObjectPath(root: string, container: string, key: string): string {
	if (!CONTAINER_PATTERN.test(container) || RELATIVE_SEGMENTS.has(container)) {
		throw new InvalidLocalObjectPathError("container name");
	}
	if (key.length === 0 || key.length > MAX_OBJECT_KEY_LENGTH || FORBIDDEN_KEY_CHARACTERS.test(key) || isAbsolute(key)) {
		throw new InvalidLocalObjectPathError("object key");
	}
	const segments = key.split("/");
	if (segments.some((segment: string): boolean => segment.length === 0 || RELATIVE_SEGMENTS.has(segment))) {
		throw new InvalidLocalObjectPathError("object key segment");
	}

	const absoluteRoot = resolve(root);
	const absolutePath = resolve(absoluteRoot, container, ...segments);
	const fromRoot = relative(absoluteRoot, absolutePath);
	if (fromRoot.length === 0 || fromRoot.startsWith(`..${sep}`) || fromRoot === ".." || isAbsolute(fromRoot)) {
		throw new InvalidLocalObjectPathError("resolved outside the storage root");
	}
	return absolutePath;
}
