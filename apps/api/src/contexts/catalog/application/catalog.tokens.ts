import type { SystemOperationName } from "../../../platform/application/system-operation-names";

/** Read the bypass-only product and sample-category tables. */
export const CATALOG_READ_OPERATION: SystemOperationName = "catalog.product_catalog.read";

/** Write the bypass-only product and sample-category tables. */
export const CATALOG_WRITE_OPERATION: SystemOperationName = "catalog.product_catalog.write";

export const CATALOG_UNIT_OF_WORK = Symbol("CATALOG_UNIT_OF_WORK");
