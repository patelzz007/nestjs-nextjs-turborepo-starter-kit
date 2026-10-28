import { TENANT_ROLE_TEMPLATE_NAMES, type MembershipRole } from "@workspace/shared";

/** How each tenant role reads on screen — one map for the dashboard, the team page and the store switcher (ADR 067's role names). */
export const TENANT_ROLE_LABELS: Readonly<Record<MembershipRole, string>> = TENANT_ROLE_TEMPLATE_NAMES;
