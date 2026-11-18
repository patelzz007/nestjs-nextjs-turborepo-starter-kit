import type { GeneratedFile } from "./generator";

/** Reads a committed generated file by its apps/api-relative path; undefined when it does not exist. */
export type CommittedFileReader = (path: string) => string | undefined;

/**
 * The generated files whose committed text differs from what the generator renders now (or that are not
 * committed yet). Empty means prisma/rls is up to date with prisma/security.
 */
export function findStaleGeneratedFiles(rendered: readonly GeneratedFile[], readCommitted: CommittedFileReader): string[] {
	return rendered.filter((file: GeneratedFile): boolean => readCommitted(file.path) !== file.sql).map((file: GeneratedFile): string => file.path);
}
