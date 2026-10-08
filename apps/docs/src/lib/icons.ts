import {
	AlignLeft,
	Archive,
	ArrowRight,
	ArrowUpRight,
	Bell,
	BookOpen,
	Boxes,
	ChevronDown,
	ChevronRight,
	CircleAlert,
	CircleCheck,
	Compass,
	Copy,
	Database,
	ExternalLink,
	FileCode2,
	FileText,
	Gauge,
	Gift,
	HardDrive,
	Info,
	KeyRound,
	Layers,
	LayoutDashboard,
	Lightbulb,
	ListChecks,
	ListTodo,
	Mail,
	Map,
	Menu,
	MessageSquare,
	Moon,
	Newspaper,
	Package,
	Palette,
	PanelLeft,
	Pencil,
	Radar,
	RefreshCw,
	Rocket,
	Rss,
	ScrollText,
	Search,
	Send,
	Server,
	ShieldCheck,
	Sun,
	ThumbsDown,
	ThumbsUp,
	Timer,
	TriangleAlert,
	Users,
	Wrench,
	X,
	Zap,
} from "lucide";

/** Structural shape of a lucide icon: a list of `[tag, attributes]` SVG children. */
export type IconNode = readonly (readonly [string, Readonly<Record<string, string | number | undefined>>])[];

/** GitHub mark (lucide no longer ships brand icons) — a filled path in lucide's 24×24 grid. */
const GITHUB_MARK: IconNode = [
	[
		"path",
		{
			d: "M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.04 1.03-2.76-.1-.26-.45-1.3.1-2.72 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.42.2 2.46.1 2.72.64.72 1.03 1.64 1.03 2.76 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9v2.82c0 .27.18.6.69.49A10.25 10.25 0 0 0 22 12.25C22 6.58 17.52 2 12 2z",
			fill: "currentColor",
			stroke: "none",
		},
	],
];

/**
 * Every icon the site renders, by name. Keeping an explicit registry means
 * only these icons are bundled and a typo in a name fails at compile time.
 */
export const ICONS = {
	alignLeft: AlignLeft,
	archive: Archive,
	arrowRight: ArrowRight,
	arrowUpRight: ArrowUpRight,
	bell: Bell,
	bookOpen: BookOpen,
	boxes: Boxes,
	chevronDown: ChevronDown,
	chevronRight: ChevronRight,
	circleAlert: CircleAlert,
	circleCheck: CircleCheck,
	compass: Compass,
	copy: Copy,
	database: Database,
	externalLink: ExternalLink,
	fileCode: FileCode2,
	fileText: FileText,
	gauge: Gauge,
	gift: Gift,
	github: GITHUB_MARK,
	hardDrive: HardDrive,
	info: Info,
	keyRound: KeyRound,
	layers: Layers,
	layoutDashboard: LayoutDashboard,
	lightbulb: Lightbulb,
	listChecks: ListChecks,
	listTodo: ListTodo,
	mail: Mail,
	map: Map,
	menu: Menu,
	messageSquare: MessageSquare,
	moon: Moon,
	newspaper: Newspaper,
	package: Package,
	palette: Palette,
	panelLeft: PanelLeft,
	pencil: Pencil,
	radar: Radar,
	refreshCw: RefreshCw,
	rocket: Rocket,
	rss: Rss,
	scrollText: ScrollText,
	search: Search,
	send: Send,
	server: Server,
	shieldCheck: ShieldCheck,
	sun: Sun,
	thumbsDown: ThumbsDown,
	thumbsUp: ThumbsUp,
	timer: Timer,
	triangleAlert: TriangleAlert,
	users: Users,
	wrench: Wrench,
	x: X,
	zap: Zap,
} satisfies Readonly<Record<string, IconNode>>;

export type IconName = keyof typeof ICONS;

function escapeAttribute(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Renders a registered icon as an inline SVG string (decorative, hidden from assistive tech). */
export function iconSvg(name: IconName, size = 16, className = ""): string {
	const node: IconNode = ICONS[name];
	const children = node
		.map(([tag, attributes]) => {
			const attrs = Object.entries(attributes)
				.flatMap(([key, value]) => (value === undefined ? [] : [`${key}="${escapeAttribute(String(value))}"`]))
				.join(" ");
			return `<${tag} ${attrs}/>`;
		})
		.join("");
	const classAttribute = className.length > 0 ? ` class="${escapeAttribute(className)}"` : "";
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${String(size)}" height="${String(size)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${classAttribute}>${children}</svg>`;
}

/** Sidebar / card icon per guide id (`docs/<id>.md`); unmapped guides use `fileText`. */
export const DOC_ICONS: Readonly<Record<string, IconName>> = {
	README: "bookOpen",
	"user-guide/README": "compass",
	"technical/README": "layers",
	"user-guide/01-platform-setup": "rocket",
	"user-guide/02-merchant-onboarding": "listChecks",
	"user-guide/03-stores-and-team": "users",
	"user-guide/04-rewards": "gift",
	"user-guide/05-customer-claims": "zap",
	"user-guide/06-pos-checkout": "server",
	"user-guide/07-referrals": "send",
	"user-guide/08-analytics": "gauge",
	"user-guide/09-platform-administration": "layoutDashboard",
	"user-guide/10-account-and-security": "shieldCheck",
	"technical/getting-started": "rocket",
	"technical/architecture": "layers",
	"technical/dos-and-donts": "circleCheck",
	"technical/adding-a-feature": "wrench",
	"technical/api/README": "fileCode",
	"technical/api-reference/README": "fileCode",
	"technical/pos-integration": "server",
	"technical/database": "database",
	"technical/messaging": "messageSquare",
	"technical/authorization/overview": "shieldCheck",
	"technical/authorization/backend": "server",
	"technical/authorization/tenancy-and-rls": "database",
	"technical/authorization/frontend": "layoutDashboard",
	"technical/authorization/recipes": "listChecks",
	"technical/authorization/testing": "listTodo",
	"technical/authorization/troubleshooting": "lightbulb",
	"technical/authorization/changelog": "scrollText",
	"technical/security/authentication": "keyRound",
	"technical/security/token-refresh": "refreshCw",
	"technical/storage/overview": "hardDrive",
	"technical/email/resend-setup": "send",
	"technical/email/templates": "mail",
	"technical/frontend/toast": "bell",
	"technical/tooling/typescript": "fileCode",
	"technical/tooling/eslint": "shieldCheck",
	"technical/tooling/dependencies": "package",
	"technical/operations/ci": "timer",
	"technical/operations/observability": "radar",
	"adr/README": "archive",
};

/** Section icon per `meta.json` separator label; unmapped sections use `layoutDashboard`. */
export const SECTION_ICONS: Readonly<Record<string, IconName>> = {
	"Start Here": "bookOpen",
	"User Guide": "compass",
	"Engineering Basics": "rocket",
	API: "fileCode",
	"Configuration & Data": "database",
	Authorization: "shieldCheck",
	Security: "keyRound",
	"Storage & Email": "hardDrive",
	"Frontend & Tooling": "wrench",
	Operations: "server",
	Decisions: "archive",
	"More Guides": "fileText",
};

export function docIcon(id: string): IconName {
	return DOC_ICONS[id] ?? "fileText";
}

export function sectionIcon(title: string): IconName {
	return SECTION_ICONS[title] ?? "layoutDashboard";
}
