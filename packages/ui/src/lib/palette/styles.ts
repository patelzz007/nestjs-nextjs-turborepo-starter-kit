const ITEM_COLORS: readonly { readonly bg: string; readonly text: string; readonly darkBg: string; readonly darkText: string }[] = [
	{ bg: "bg-blue-100", text: "text-blue-600", darkBg: "dark:bg-blue-900/40", darkText: "dark:text-blue-300" },
	{ bg: "bg-emerald-100", text: "text-emerald-600", darkBg: "dark:bg-emerald-900/40", darkText: "dark:text-emerald-300" },
	{ bg: "bg-purple-100", text: "text-purple-600", darkBg: "dark:bg-purple-900/40", darkText: "dark:text-purple-300" },
	{ bg: "bg-amber-100", text: "text-amber-600", darkBg: "dark:bg-amber-900/40", darkText: "dark:text-amber-300" },
	{ bg: "bg-cyan-100", text: "text-cyan-600", darkBg: "dark:bg-cyan-900/40", darkText: "dark:text-cyan-300" },
	{ bg: "bg-orange-100", text: "text-orange-600", darkBg: "dark:bg-orange-900/40", darkText: "dark:text-orange-300" },
	{ bg: "bg-rose-100", text: "text-rose-600", darkBg: "dark:bg-rose-900/40", darkText: "dark:text-rose-300" },
	{ bg: "bg-indigo-100", text: "text-indigo-600", darkBg: "dark:bg-indigo-900/40", darkText: "dark:text-indigo-300" },
	{ bg: "bg-sky-100", text: "text-sky-600", darkBg: "dark:bg-sky-900/40", darkText: "dark:text-sky-300" },
	{ bg: "bg-teal-100", text: "text-teal-600", darkBg: "dark:bg-teal-900/40", darkText: "dark:text-teal-300" },
	{ bg: "bg-pink-100", text: "text-pink-600", darkBg: "dark:bg-pink-900/40", darkText: "dark:text-pink-300" },
	{ bg: "bg-lime-100", text: "text-lime-600", darkBg: "dark:bg-lime-900/40", darkText: "dark:text-lime-300" },
	{ bg: "bg-violet-100", text: "text-violet-600", darkBg: "dark:bg-violet-900/40", darkText: "dark:text-violet-300" },
	{ bg: "bg-yellow-100", text: "text-yellow-600", darkBg: "dark:bg-yellow-900/40", darkText: "dark:text-yellow-300" },
	{ bg: "bg-green-100", text: "text-green-600", darkBg: "dark:bg-green-900/40", darkText: "dark:text-green-300" },
	{ bg: "bg-red-100", text: "text-red-600", darkBg: "dark:bg-red-900/40", darkText: "dark:text-red-300" },
];

const sectionBadgeColors: Readonly<Record<string, string>> = {
	Main: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
	Documents: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
	Account: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
	Rewards: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
	Operations: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

const defaultIconColor = "text-indigo-500 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/40";

export function getItemColor(title: string): string {
	let hash = 0;
	for (let i = 0; i < title.length; i++) {
		hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
	}
	const index = ((hash % ITEM_COLORS.length) + ITEM_COLORS.length) % ITEM_COLORS.length;
	const color = ITEM_COLORS[index];
	if (color === undefined) {
		return defaultIconColor;
	}
	return `${color.text} ${color.bg} ${color.darkText} ${color.darkBg}`;
}

export function getSectionBadgeColor(section: string): string {
	return sectionBadgeColors[section] ?? "bg-accent/30 text-accent-foreground/60";
}

export function getDefaultIconColor(): string {
	return defaultIconColor;
}
