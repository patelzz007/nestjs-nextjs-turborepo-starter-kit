import { humanizeFieldLabel } from "../../core/humanize";
import { tsStringLiteral } from "../../core/ts-literal";
import type { FieldIR, ResourceIR } from "../../ir/types";

export interface MobileCardLayout {
	readonly titleColumn: string;
	readonly subtitleColumn: string | undefined;
	readonly badgeColumn: string | undefined;
	readonly gridColumns: readonly string[];
}

function fieldByColumn(ir: ResourceIR, column: string): FieldIR | undefined {
	return ir.fields.find((item) => item.camelName === column);
}

function columnHeader(column: string): string {
	return humanizeFieldLabel(column);
}

function isBadgeColumn(ir: ResourceIR, column: string): boolean {
	const field = fieldByColumn(ir, column);
	if (field === undefined) {
		return false;
	}
	if (field.type === "enum") {
		return true;
	}
	return field.type === "boolean" && column === "isActive";
}

export function resolveMobileCardLayout(ir: ResourceIR, columns: readonly string[]): MobileCardLayout {
	const titleColumn = columns[0] ?? "id";
	const badgeColumn = columns.find((column) => isBadgeColumn(ir, column));
	let subtitleColumn = columns[1];
	if (subtitleColumn === titleColumn || subtitleColumn === badgeColumn) {
		subtitleColumn = columns.find((column) => column !== titleColumn && column !== badgeColumn);
	}
	const gridColumns = columns.filter((column) => column !== titleColumn && column !== subtitleColumn && column !== badgeColumn);
	return { titleColumn, subtitleColumn, badgeColumn, gridColumns };
}

export function renderMobileFieldValue(column: string, ir: ResourceIR): string {
	const field = fieldByColumn(ir, column);
	if (column === "createdAt" || column === "updatedAt") {
		return `Number.isFinite(item.${column}) ? new Date(item.${column}).toLocaleString() : "—"`;
	}
	if (field?.type === "decimal") {
		return `Number.isFinite(item.${column}) ? item.${column}.toFixed(2) : "—"`;
	}
	if (field?.type === "datetime") {
		return `Number.isFinite(item.${column}) ? new Date(item.${column}).toLocaleString() : "—"`;
	}
	if (field?.type === "boolean") {
		return `item.${column} ? "Yes" : "No"`;
	}
	if (field?.type === "enum") {
		return `item.${column}`;
	}
	if (field?.nullable) {
		return `item.${column} ?? "—"`;
	}
	if (field?.type === "int") {
		return `String(item.${column})`;
	}
	return `item.${column}`;
}

export function renderMobileBadge(column: string, ir: ResourceIR): string {
	const field = fieldByColumn(ir, column);
	if (field?.type === "boolean" && column === "isActive") {
		return `item.${column} ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>`;
	}
	if (field?.type === "enum") {
		return `<Badge variant="outline">{item.${column}}</Badge>`;
	}
	return `<Badge variant="outline">{${field?.type === "int" ? `String(item.${column})` : `item.${column}`}}</Badge>`;
}

export function renderGeneratedMobileCardBlock(ir: ResourceIR, columns: readonly string[]): string {
	const layout = resolveMobileCardLayout(ir, columns);
	const gridFieldLines = layout.gridColumns
		.map((column) => `\t\t\t\t{ label: ${tsStringLiteral(columnHeader(column))}, value: ${renderMobileFieldValue(column, ir)} },`)
		.join("\n");
	const subtitleLine = layout.subtitleColumn === undefined ? "" : `\n\t\t\tsubtitle={${renderMobileFieldValue(layout.subtitleColumn, ir)}}`;
	const badgeLine = layout.badgeColumn === undefined ? "" : `\n\t\t\tbadge={${renderMobileBadge(layout.badgeColumn, ir)}}`;

	return `\tconst mobileCardRender = useCallback(
\t\t(item: ${ir.resource.modelName}, cardActions?: Action<${ir.resource.modelName}>[]): React.ReactNode => (
\t\t\t<DataTableMobileCard
\t\t\t\titem={item}
\t\t\t\ttitle={${renderMobileFieldValue(layout.titleColumn, ir)}}${subtitleLine}${badgeLine}
\t\t\t\tfields={[
${gridFieldLines}
\t\t\t\t]}
\t\t\t\tactions={cardActions}
\t\t\t/>
\t\t),
\t\t[],
\t);`;
}
