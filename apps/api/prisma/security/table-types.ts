/**
 * The types that make the security declarations type-checked and autocompleted: every table name, column,
 * catalogue permission and system operation is checked against the real Prisma schema, the permission
 * catalogue and the operation registry. A typo is a compile error, not a database surprise.
 *
 * Type-only imports: nothing here loads the generated Prisma client at runtime (`db:schema` runs before it
 * exists), only its declarations.
 */
import type { Prisma } from "@prisma/client";
import type { PermissionAction, PermissionResource } from "@workspace/shared";

import type { SystemOperationName } from "../../src/platform/application/system-operation-names";

/** A table: every Prisma model is a table of the same name (the schema maps none). */
export type TableName = Prisma.ModelName;

/** A column of `Table`: its scalar fields, as the generated client declares them. */
export type ColumnOf<Table extends TableName> = Extract<keyof Prisma.TypeMap["model"][Table]["payload"]["scalars"], string>;

export type { PermissionAction, PermissionResource, SystemOperationName };
