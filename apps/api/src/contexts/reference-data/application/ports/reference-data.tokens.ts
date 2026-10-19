import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** The one system operation geo writes run under — the only session the geo `*_write` RLS policies accept. */
export const GEO_WRITE_OPERATION: SystemOperationName = "geo.reference_data.write";

export const REFERENCE_DATA_UNIT_OF_WORK = Symbol("REFERENCE_DATA_UNIT_OF_WORK");
export const GEOGRAPHY_READ = Symbol("GEOGRAPHY_READ");
