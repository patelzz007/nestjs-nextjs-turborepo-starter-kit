// Sample people shared by the basic data-grid examples (data-grid-1 … 12).
// Sample data only: avatars come from the admin's allowed Unsplash host, and
// countries render as emoji flags rather than a third-party flag CDN.

export type DataGridSampleAvailability = "online" | "away" | "busy" | "offline";

export type DataGridSampleStatus = "active" | "inactive";

export type DataGridSampleCountry = "us" | "gb" | "ca" | "au" | "de" | "my" | "es" | "jp" | "fr" | "it" | "br" | "in";

export interface DataGridSamplePerson {
	readonly id: string;
	readonly name: string;
	readonly availability: DataGridSampleAvailability;
	readonly avatar: string;
	readonly status: DataGridSampleStatus;
	readonly flag: DataGridSampleCountry;
	readonly email: string;
	readonly company: string;
	readonly role: string;
	readonly joined: string;
	readonly location: string;
	readonly balance: number;
	readonly details: string;
}

/** Emoji flag per sample country (regional-indicator pairs). */
export const DATA_GRID_SAMPLE_FLAGS: Readonly<Record<DataGridSampleCountry, string>> = {
	us: "🇺🇸",
	gb: "🇬🇧",
	ca: "🇨🇦",
	au: "🇦🇺",
	de: "🇩🇪",
	my: "🇲🇾",
	es: "🇪🇸",
	jp: "🇯🇵",
	fr: "🇫🇷",
	it: "🇮🇹",
	br: "🇧🇷",
	in: "🇮🇳",
};

/** Presence dot colour per availability, from the kit's status tokens. */
export const DATA_GRID_SAMPLE_AVAILABILITY_CLASS_NAMES: Readonly<Record<DataGridSampleAvailability, string>> = {
	online: "bg-success",
	away: "bg-warning",
	busy: "bg-destructive",
	offline: "bg-muted-foreground",
};

/** Rows per page every basic example starts with. */
export const DATA_GRID_SAMPLE_PAGE_SIZE = 5;

const BALANCE_FORMAT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** A balance as US dollars, e.g. `$5,143.03`. */
export function formatDataGridSampleBalance(balance: number): string {
	return BALANCE_FORMAT.format(balance);
}

/** The avatar fallback: the first letter of every word of the name. */
export function getDataGridSampleInitials(name: string): string {
	return name
		.split(" ")
		.map((word: string): string => word.charAt(0))
		.join("");
}

/** Stable row id for `useTable({ getRowId })`. */
export function getDataGridSamplePersonId(person: DataGridSamplePerson): string {
	return person.id;
}

export const DATA_GRID_SAMPLE_PEOPLE: readonly DataGridSamplePerson[] = [
	{
		id: "1",
		name: "Alex Johnson",
		availability: "online",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		status: "active",
		flag: "us",
		email: "alex@apple.com",
		company: "Apple",
		role: "CEO",
		joined: "Jan, 2024",
		location: "United States",
		balance: 5143.03,
		details: "Alex is a visionary leader at Apple, focusing on innovation and team growth.",
	},
	{
		id: "2",
		name: "Sarah Chen",
		availability: "away",
		avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		status: "inactive",
		flag: "gb",
		email: "sarah@openai.com",
		company: "OpenAI",
		role: "CTO",
		joined: "Mar, 2023",
		location: "United Kingdom",
		balance: 4321.87,
		details: "Sarah is a technology pioneer specializing in artificial intelligence and machine learning.",
	},
	{
		id: "3",
		name: "Michael Rodriguez",
		availability: "busy",
		avatar: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
		status: "active",
		flag: "ca",
		email: "michael@meta.com",
		company: "Meta",
		role: "Designer",
		joined: "Jun, 2022",
		location: "Canada",
		balance: 7654.98,
		details: "Michael is a creative designer passionate about building user-centric experiences.",
	},
	{
		id: "4",
		name: "Emma Wilson",
		availability: "offline",
		avatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
		status: "inactive",
		flag: "au",
		email: "emma@tesla.com",
		company: "Tesla",
		role: "Developer",
		joined: "Sep, 2024",
		location: "Australia",
		balance: 3456.45,
		details: "Emma is a talented developer focused on innovative solutions in automotive technology.",
	},
	{
		id: "5",
		name: "David Kim",
		availability: "online",
		avatar: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
		status: "active",
		flag: "de",
		email: "david@sap.com",
		company: "SAP",
		role: "Lawyer",
		joined: "Nov, 2023",
		location: "Germany",
		balance: 9876.54,
		details: "David is a corporate lawyer specializing in technology and software agreements.",
	},
	{
		id: "6",
		name: "Aron Thompson",
		availability: "away",
		avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80",
		status: "active",
		flag: "my",
		email: "aron@keenthemes.com",
		company: "Keenthemes",
		role: "Director",
		joined: "Feb, 2022",
		location: "Malaysia",
		balance: 6214.22,
		details: "Aron oversees product development and team leadership at Keenthemes.",
	},
	{
		id: "7",
		name: "James Brown",
		availability: "busy",
		avatar: "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
		status: "inactive",
		flag: "es",
		email: "james@bbva.es",
		company: "BBVA",
		role: "Product Manager",
		joined: "Aug, 2024",
		location: "Spain",
		balance: 5321.77,
		details: "James manages product development and strategy for BBVA's digital platforms.",
	},
	{
		id: "8",
		name: "Maria Garcia",
		availability: "offline",
		avatar: "https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80",
		status: "active",
		flag: "jp",
		email: "maria@sony.jp",
		company: "Sony",
		role: "Marketing Lead",
		joined: "Dec, 2023",
		location: "Japan",
		balance: 8452.39,
		details: "Maria leads innovative marketing campaigns for Sony's flagship products.",
	},
	{
		id: "9",
		name: "Nick Johnson",
		availability: "online",
		avatar: "https://images.unsplash.com/photo-1485206412256-701ccc5b93ca?w=96&h=96&dpr=2&q=80",
		status: "inactive",
		flag: "fr",
		email: "nick@lvmh.fr",
		company: "LVMH",
		role: "Data Scientist",
		joined: "Apr, 2022",
		location: "France",
		balance: 7345.1,
		details: "Nick is a data scientist optimizing sales and marketing analytics at LVMH.",
	},
	{
		id: "10",
		name: "Liam Thompson",
		availability: "away",
		avatar: "https://images.unsplash.com/photo-1542595913-85d69b0edbaf?w=96&h=96&dpr=2&q=80",
		status: "inactive",
		flag: "it",
		email: "liam@eni.it",
		company: "ENI",
		role: "Engineer",
		joined: "Jul, 2024",
		location: "Italy",
		balance: 5214.88,
		details: "Liam is a lead engineer developing sustainable energy solutions at ENI.",
	},
	{
		id: "11",
		name: "Alex Johnson",
		availability: "busy",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		status: "inactive",
		flag: "br",
		email: "alex@vale.br",
		company: "Vale",
		role: "Software Engineer",
		joined: "May, 2023",
		location: "Brazil",
		balance: 9421.5,
		details: "Alex develops cutting-edge software to optimize mining operations at Vale.",
	},
	{
		id: "12",
		name: "Sarah Chen",
		availability: "offline",
		avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		status: "active",
		flag: "in",
		email: "sarah@tata.in",
		company: "Tata",
		role: "Sales Manager",
		joined: "Oct, 2024",
		location: "India",
		balance: 4521.67,
		details: "Sarah manages international sales for Tata's industrial and automotive products.",
	},
];
