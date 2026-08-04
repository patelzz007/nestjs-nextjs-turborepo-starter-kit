import type { ChartConfig } from "@workspace/ui/components/chart";
import { z } from "zod";

export const schema = z.object({
	id: z.number(),
	header: z.string(),
	type: z.string(),
	status: z.string(),
	target: z.string(),
	limit: z.string(),
	reviewer: z.string(),
});

export type RowData = z.infer<typeof schema>;

export const VIEW_ITEMS: readonly { label: string; value: string }[] = [
	{ label: "Outline", value: "outline" },
	{ label: "Past Performance", value: "past-performance" },
	{ label: "Key Personnel", value: "key-personnel" },
	{ label: "Focus Documents", value: "focus-documents" },
];

export const PAGE_SIZE_ITEMS: readonly { label: string; value: string }[] = [10, 20, 30, 40, 50].map((pageSize) => ({
	label: String(pageSize),
	value: String(pageSize),
}));

export const REVIEWER_ITEMS: readonly { label: string; value: string }[] = [
	{ label: "Eddie Lake", value: "Eddie Lake" },
	{ label: "Jamik Tashpulatov", value: "Jamik Tashpulatov" },
];

export const SECTION_TYPE_ITEMS: readonly { label: string; value: string }[] = [
	{ label: "Table of Contents", value: "Table of Contents" },
	{ label: "Executive Summary", value: "Executive Summary" },
	{ label: "Technical Approach", value: "Technical Approach" },
	{ label: "Design", value: "Design" },
	{ label: "Capabilities", value: "Capabilities" },
	{ label: "Focus Documents", value: "Focus Documents" },
	{ label: "Narrative", value: "Narrative" },
	{ label: "Cover Page", value: "Cover Page" },
];

export const STATUS_ITEMS: readonly { label: string; value: string }[] = [
	{ label: "Done", value: "Done" },
	{ label: "In Progress", value: "In Progress" },
	{ label: "Not Started", value: "Not Started" },
];

export const DRAWER_REVIEWER_ITEMS: readonly { label: string; value: string }[] = [
	{ label: "Eddie Lake", value: "Eddie Lake" },
	{ label: "Jamik Tashpulatov", value: "Jamik Tashpulatov" },
	{ label: "Emily Whalen", value: "Emily Whalen" },
];

export function formatTick(value: string): string {
	return value.slice(0, 3);
}

export const chartData: readonly { month: string; desktop: number; mobile: number }[] = [
	{ month: "January", desktop: 186, mobile: 80 },
	{ month: "February", desktop: 305, mobile: 200 },
	{ month: "March", desktop: 237, mobile: 120 },
	{ month: "April", desktop: 73, mobile: 190 },
	{ month: "May", desktop: 209, mobile: 130 },
	{ month: "June", desktop: 214, mobile: 140 },
];

export const chartConfig = {
	desktop: {
		label: "Desktop",
		color: "var(--primary)",
	},
	mobile: {
		label: "Mobile",
		color: "var(--primary)",
	},
} satisfies ChartConfig;
