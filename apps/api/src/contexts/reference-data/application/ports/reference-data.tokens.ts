import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** Read the five geo reference tables. SELECT is world-readable; the named operation keeps a platform admin's session off every other table. */
export const GEO_READ_OPERATION: SystemOperationName = "geo.reference_data.read";

/** The one system operation geo writes run under — the only session the geo `*_write` RLS policies accept. */
export const GEO_WRITE_OPERATION: SystemOperationName = "geo.reference_data.write";

export const REFERENCE_DATA_UNIT_OF_WORK = Symbol("REFERENCE_DATA_UNIT_OF_WORK");
export const GEOGRAPHY_READ = Symbol("GEOGRAPHY_READ");
