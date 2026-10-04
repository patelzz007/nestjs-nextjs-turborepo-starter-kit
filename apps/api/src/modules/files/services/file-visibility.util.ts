import type { StoredFile } from "@prisma/client";

/** Public categories are published to the provider's public delivery origin once READY. */
export function isPublicFile(file: Pick<StoredFile, "visibility">): boolean {
	return file.visibility === "PUBLIC";
}
