import {
	Archive,
	Bell,
	BookOpen,
	Boxes,
	Compass,
	Database,
	FileCode2,
	FileText,
	Gauge,
	Gift,
	HardDrive,
	Layers,
	LayoutDashboard,
	ListChecks,
	ListTodo,
	Mail,
	Map,
	MessageSquare,
	Package,
	Palette,
	PanelLeft,
	Radar,
	RefreshCw,
	Rocket,
	ScrollText,
	Send,
	Server,
	ShieldCheck,
	Timer,
	Users,
	Wrench,
	Zap,
	type LucideIcon,
} from "lucide-react";

/** Fallback when a guide slug has no explicit icon mapping. */
export const DEFAULT_DOCS_PAGE_ICON: LucideIcon = FileText;

/** Fallback for section separators without a mapped icon. */
export const DEFAULT_DOCS_SECTION_ICON: LucideIcon = LayoutDashboard;

/**
 * Per-page sidebar icons. Keyed by doc slug (`page.url` without `/docs/`).
 * Every guide page must resolve to an icon — unmapped slugs use `DEFAULT_DOCS_PAGE_ICON`.
 */
export const DOCS_PAGE_ICONS: Readonly<Record<string, LucideIcon>> = {
	"getting-started": Rocket,
	README: BookOpen,
	architecture: Layers,
	"token-refresh": RefreshCw,
	"infrastructure/architecture-eli5": Boxes,
	"infrastructure/messaging": MessageSquare,
	"infrastructure/storage": HardDrive,
	typescript: FileCode2,
	eslint: ShieldCheck,
	prisma: Database,
	dependencies: Package,
	logging: ScrollText,
	"performance-and-dx": Gauge,
	email: Mail,
	"email-setup": Send,
	"reactive-core": Zap,
	telescope: Radar,
	"fastify-migration": Timer,
	backup: Archive,
	toast: Bell,
	"admin-panel": LayoutDashboard,
	"ui-components": Palette,
	"sidebar-audit": PanelLeft,
	"improvement-backlog": ListTodo,
	"cursorrules-audit-tasks": ListChecks,
	"auth-roadmap": Map,
	"boilerplate-roadmap": Compass,
	"rewards-platform-prd": Gift,
	"team-invite": Users,
};

/** Section header icons — keyed by `meta.json` separator label. */
export const DOCS_SECTION_ICONS: Readonly<Record<string, LucideIcon>> = {
	"Getting Started": Rocket,
	"Architecture & Auth": ShieldCheck,
	Infrastructure: Server,
	"Tooling & DX": Wrench,
	"Deep Dives": Radar,
	Roadmaps: Map,
};

export function resolveDocsPageIcon(slug: string): LucideIcon {
	return DOCS_PAGE_ICONS[slug] ?? DEFAULT_DOCS_PAGE_ICON;
}

export function resolveDocsSectionIcon(sectionTitle: string): LucideIcon {
	return DOCS_SECTION_ICONS[sectionTitle] ?? DEFAULT_DOCS_SECTION_ICON;
}
