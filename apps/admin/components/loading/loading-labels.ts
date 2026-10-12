import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";

/** What a `SkeletonRegion` announces — one module constant per loading surface, so the object identity is stable. */
export type SkeletonRegionLabelsOverride = UiKitLabelsOverride<"skeletonRegion">;

// ── Route-level (loading.tsx) announcements ─────────────────────────────────

/** The `(panel)` fallback — any route without a skeleton of its own. */
export const PANEL_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading page…" };
export const DASHBOARD_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading dashboard…" };
export const ANALYTICS_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading analytics…" };
export const AUDIT_LOG_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading audit log…" };
export const AUDIT_RECORD_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading audit record…" };
export const PRODUCTS_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading products…" };
export const PRODUCT_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading product…" };
export const NEW_PRODUCT_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading product form…" };
export const CATEGORIES_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading categories…" };
export const CATEGORY_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading category…" };
export const NEW_CATEGORY_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading category form…" };
export const EMAIL_TEMPLATES_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading email templates…" };
export const EMAIL_LOG_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading email log…" };
export const GEOGRAPHY_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading geographic data…" };
export const MERCHANTS_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading merchants…" };
export const MERCHANT_INVITES_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading merchant invites…" };
export const STORE_REQUESTS_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading store requests…" };
export const KYB_REVIEW_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading KYB review…" };
export const PENDING_REWARDS_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading pending rewards…" };
export const ACCESS_CONTROL_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading access control…" };
export const USERS_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading users…" };
export const USER_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading user…" };
export const MFA_RECOVERY_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading MFA recovery requests…" };
export const PROFILE_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading profile…" };
export const SECURITY_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading security settings…" };

// ── In-component (section-level) announcements ──────────────────────────────

export const EMAIL_PREVIEW_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading preview…" };
export const EMAIL_TEMPLATE_DETAILS_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading template details…" };
export const KYB_QUEUE_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading pending merchants…" };
export const KYB_MERCHANT_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading merchant details…" };
export const STORE_REQUEST_QUEUE_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading requests…" };
export const ROLES_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading roles…" };
export const PERMISSIONS_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading permissions…" };
export const USER_MFA_HISTORY_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading recovery history…" };
export const SECTION_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Loading section…" };
/** The route guard while the session's permissions are still unknown. */
export const ROUTE_ACCESS_LOADING_LABELS: SkeletonRegionLabelsOverride = { loading: "Checking your access…" };
