"use client";

import { createBreadcrumbContext } from "@workspace/ui/components/navigation/breadcrumb-context";

import { resolveAdminTrail } from "@/lib/navigation/breadcrumb";

/**
 * The admin's single BreadcrumbContext instance — created from the shared
 * factory with the admin-specific route resolver (sidebar menu + icons).
 * Wrap the dashboard layout with `<AdminBreadcrumbProvider pathname={...}>`
 * and read the trail with `useAdminBreadcrumb()`.
 */
const { provider: BreadcrumbProvider, useBreadcrumb } = createBreadcrumbContext(resolveAdminTrail);

export { BreadcrumbProvider as AdminBreadcrumbProvider, useBreadcrumb as useAdminBreadcrumb };
