import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

export const ANALYTICS_FACTS_READ = Symbol("ANALYTICS_FACTS_READ");
export const ANALYTICS_BREAKDOWN_READ = Symbol("ANALYTICS_BREAKDOWN_READ");
export const ANALYTICS_TENANT_READ = Symbol("ANALYTICS_TENANT_READ");
export const SALES_READ = Symbol("SALES_READ");
export const REWARD_ACTIVITY_READ = Symbol("REWARD_ACTIVITY_READ");
export const REPORT_RENDERERS = Symbol("REPORT_RENDERERS");
export const REPORT_EXPORT_AUDIT = Symbol("REPORT_EXPORT_AUDIT");
/** The product name printed on every report (the configured app name). */
export const REPORT_BRAND = Symbol("REPORT_BRAND");
/**
 * The merchant capability + store-scope port (platform `MerchantAccessPort`) as reporting injects it.
 * The module binds it to tenants' `MERCHANT_ACCESS`, so the application layer
 * never loads another context's module graph.
 */
export const REPORTING_MERCHANT_ACCESS = Symbol("REPORTING_MERCHANT_ACCESS");

/** Platform-wide analytics: the admin analytics routes and the queries they run. */
export const PLATFORM_ANALYTICS_READ_OPERATION: SystemOperationName = "reporting.platform_analytics.read";
