/**
 * Single Zod entry point for the monorepo.
 * Import `z` / `ZodType` from here (or `@workspace/shared`) so API + shared
 * schemas always resolve to the same physical zod install.
 */
export { z } from "zod";
export type { ZodType } from "zod";
