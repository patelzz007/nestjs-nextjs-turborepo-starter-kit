import { humanizeFieldLabel } from "../../core/humanize";
import { tsStringLiteral } from "../../core/ts-literal";
import type { FieldIR, ResourceIR } from "../../ir/types";
import { fieldByName } from "../nestjs/list-query";

const BOOLEAN_COLUMN_FILTER_SCHEMA = "BooleanColumnFilterSchema";

export function resolveListFilterFieldNames(ir: ResourceIR): string[] {
	if (ir.admin?.list.filters !== undefined) {
		return [...ir.admin.list.filters];
	}
	const adminTarget = ir.uiTargets.admin;
	if (adminTarget !== undefined) {
		return [...adminTarget.list.filters];
	}
	return ir.fields.filter((field) => field.filterable).map((field) => field.name);
}

export function resolveListFilterFields(ir: ResourceIR): FieldIR[] {
	return resolveListFilterFieldNames(ir)
		.map((fieldName) => fieldByName(ir, fieldName))
		.filter((field): field is FieldIR => field !== undefined);
}

export function isUiSelectFilterField(field: FieldIR): boolean {
	return field.type === "boolean" || field.type === "enum";
}

export function isUiTextFilterField(field: FieldIR): boolean {
	return field.type === "string" || field.type === "text" || field.type === "uuid" || field.type === "int";
}

export function resolveUiSelectFilterFields(ir: ResourceIR): FieldIR[] {
	return resolveListFilterFields(ir).filter(isUiSelectFilterField);
}

export function resolveUiTextFilterFields(ir: ResourceIR): FieldIR[] {
	return resolveListFilterFields(ir).filter(isUiTextFilterField);
}

export function resolveTitleField(ir: ResourceIR): string {
	const formFields = ir.admin?.form.fields ?? ir.uiTargets.admin?.form.fields ?? [];
	const columnFields = ir.admin?.list.columns ?? ir.uiTargets.admin?.list.columns ?? [];
	const candidateNames = [...formFields, ...columnFields];

	if (candidateNames.includes("name")) {
		return "name";
	}

	for (const fieldName of candidateNames) {
		const field = fieldByName(ir, fieldName);
		if (field?.type === "string" || field?.type === "text") {
			return fieldName;
		}
	}

	for (const fieldName of candidateNames) {
		if (fieldName !== "id") {
			return fieldName;
		}
	}

	const firstNonIdField = ir.fields.find((field) => field.camelName !== "id");
	return firstNonIdField?.camelName ?? "id";
}

function booleanFilterOptionLabels(field: FieldIR): { readonly trueLabel: string; readonly falseLabel: string } {
	if (field.camelName === "isActive") {
		return { trueLabel: "Active", falseLabel: "Inactive" };
	}
	if (field.camelName === "isFeatured") {
		return { trueLabel: "Featured", falseLabel: "Not featured" };
	}
	if (field.camelName.startsWith("is") && field.camelName.length > 2) {
		const label = humanizeFieldLabel(field.camelName.slice(2));
		return { trueLabel: label, falseLabel: `Not ${label.toLowerCase()}` };
	}
	return { trueLabel: "Yes", falseLabel: "No" };
}

export function renderZodListQueryFilterField(field: FieldIR): string {
	switch (field.type) {
		case "boolean":
			return `\t\t${field.camelName}: BooleanQueryParamSchema,`;
		case "enum":
			if (field.enumValues === undefined || field.enumValues.length === 0) {
				return "";
			}
			return `\t\t${field.camelName}: z.enum([${field.enumValues.map((value) => tsStringLiteral(value)).join(", ")}]).optional(),`;
		case "string":
		case "text":
			return `\t\t${field.camelName}: z.string().trim().min(1).optional(),`;
		case "uuid":
			return `\t\t${field.camelName}: z.uuid().optional(),`;
		case "int":
			return `\t\t${field.camelName}: z.coerce.number().int().optional(),`;
		default:
			return "";
	}
}

export function renderListWhereFilterLines(fields: readonly FieldIR[]): string {
	const lines: string[] = [];
	for (const field of fields) {
		const key = field.camelName;
		if (field.type === "string" || field.type === "text") {
			lines.push(`\tif (query.${key} !== undefined) {`);
			lines.push(`\t\twhere.${key} = { contains: query.${key}, mode: "insensitive" };`);
			lines.push(`\t}`);
			continue;
		}
		if (field.type === "boolean" || field.type === "enum" || field.type === "uuid" || field.type === "int") {
			if (field.type === "boolean") {
				lines.push(`\tif (query.${key} !== undefined) {`);
				lines.push(`\t\twhere.${key} = query.${key} === true || query.${key} === "true";`);
				lines.push(`\t}`);
				continue;
			}
			lines.push(`\tif (query.${key} !== undefined) {`);
			lines.push(`\t\twhere.${key} = query.${key};`);
			lines.push(`\t}`);
		}
	}
	return lines.join("\n");
}

function filterStateName(field: FieldIR): string {
	return `${field.camelName}Filter`;
}

function parsedFilterName(field: FieldIR): string {
	return `parsed${field.camelName.charAt(0).toUpperCase()}${field.camelName.slice(1)}`;
}

function setterName(field: FieldIR): string {
	return `set${field.camelName.charAt(0).toUpperCase()}${field.camelName.slice(1)}Filter`;
}

export function renderViewFilterSchemas(ir: ResourceIR): string {
	const uiFilters = resolveUiSelectFilterFields(ir);
	if (uiFilters.length === 0) {
		return "";
	}
	const hasBoolean = uiFilters.some((field) => field.type === "boolean");
	const enumSchemas = uiFilters
		.filter((field) => field.type === "enum" && field.enumValues !== undefined && field.enumValues.length > 0)
		.map(
			(field) =>
				`const ${field.camelName.charAt(0).toUpperCase()}${field.camelName.slice(1)}FilterSchema = z.enum([${field.enumValues?.map((value) => tsStringLiteral(value)).join(", ")}]);`,
		);
	const booleanSchema = hasBoolean ? `const ${BOOLEAN_COLUMN_FILTER_SCHEMA} = z.enum(["true", "false"]);` : "";
	const blocks = [booleanSchema, ...enumSchemas].filter((block) => block.length > 0);
	if (blocks.length === 0) {
		return "";
	}
	return `${blocks.join("\n")}\n\n`;
}

export function renderViewFilterState(ir: ResourceIR): string {
	return resolveUiSelectFilterFields(ir)
		.map((field) => `\tconst [${filterStateName(field)}, ${setterName(field)}] = useState<string>("all");`)
		.join("\n");
}

export function renderViewTextFilterState(ir: ResourceIR): string {
	return resolveUiTextFilterFields(ir)
		.map((field) => `\tconst [${filterStateName(field)}, ${setterName(field)}] = useState("");`)
		.join("\n");
}

export function renderViewFilterParsing(ir: ResourceIR): string {
	const lines: string[] = [];
	for (const field of resolveUiSelectFilterFields(ir)) {
		const state = filterStateName(field);
		if (field.type === "boolean") {
			lines.push(
				`\tconst ${parsedFilterName(field)} = ${state} === "all" ? undefined : (${BOOLEAN_COLUMN_FILTER_SCHEMA}.safeParse(${state}).success ? ${state} === "true" : undefined);`,
			);
			continue;
		}
		if (field.type === "enum") {
			const schemaName = `${field.camelName.charAt(0).toUpperCase()}${field.camelName.slice(1)}FilterSchema`;
			lines.push(`\tconst ${parsedFilterName(field)} = ${state} === "all" ? undefined : ${schemaName}.safeParse(${state}).data;`);
		}
	}
	return lines.join("\n");
}

export function renderViewTextFilterParsing(ir: ResourceIR): string {
	const lines: string[] = [];
	for (const field of resolveUiTextFilterFields(ir)) {
		const state = filterStateName(field);
		const debouncedName = `debounced${field.camelName.charAt(0).toUpperCase()}${field.camelName.slice(1)}Filter`;
		lines.push(`\tconst ${debouncedName} = useDebouncedValue(${state}, 300);`);
		if (field.type === "uuid") {
			lines.push(
				`\tconst ${parsedFilterName(field)} = ${debouncedName}.trim().length === 0 ? undefined : z.uuid().safeParse(${debouncedName}.trim()).data;`,
			);
			continue;
		}
		if (field.type === "int") {
			lines.push(
				`\tconst ${parsedFilterName(field)} = ${debouncedName}.trim().length === 0 ? undefined : z.coerce.number().int().safeParse(${debouncedName}.trim()).data;`,
			);
			continue;
		}
		lines.push(`\tconst ${parsedFilterName(field)} = ${debouncedName}.trim().length === 0 ? undefined : ${debouncedName}.trim();`);
	}
	return lines.join("\n");
}

export function renderViewIsFilteredExpression(ir: ResourceIR, baseExpression: string): string {
	const selectParts = resolveUiSelectFilterFields(ir).map((field) => `${filterStateName(field)} !== "all"`);
	const textParts = resolveUiTextFilterFields(ir).map((field) => `${filterStateName(field)}.trim().length > 0`);
	const parts = [...selectParts, ...textParts];
	if (parts.length === 0) {
		return baseExpression;
	}
	return `${baseExpression} || ${parts.join(" || ")}`;
}

export function renderViewClearFiltersBody(ir: ResourceIR, baseBody: string): string {
	const selectResets = resolveUiSelectFilterFields(ir).map((field) => `\t\t${setterName(field)}("all");`);
	const textResets = resolveUiTextFilterFields(ir).map((field) => `\t\t${setterName(field)}("");`);
	const resets = [...selectResets, ...textResets];
	if (resets.length === 0) {
		return baseBody;
	}
	return `${baseBody}\n${resets.join("\n")}`;
}

export function renderViewPaginationResetDeps(ir: ResourceIR): string {
	return [...resolveUiSelectFilterFields(ir), ...resolveUiTextFilterFields(ir)]
		.map((field) => filterStateName(field))
		.join(", ");
}

function renderFilterSpreadLine(field: FieldIR): string {
	return `\t\t\t\t...(${parsedFilterName(field)} !== undefined ? { ${field.camelName}: ${parsedFilterName(field)} } : {}),`;
}

export function renderViewBuildListQueryFilterSpreads(ir: ResourceIR): string {
	return resolveListFilterFields(ir)
		.map((field) => renderFilterSpreadLine(field))
		.join("\n");
}

export function renderViewApiQueryFilterSpreads(ir: ResourceIR): string {
	return renderViewBuildListQueryFilterSpreads(ir);
}

export function renderViewInitialDataFilterGuard(ir: ResourceIR): string {
	const selectGuards = resolveUiSelectFilterFields(ir).map((field) => ` && ${filterStateName(field)} === "all"`);
	const textGuards = resolveUiTextFilterFields(ir).map((field) => ` && ${filterStateName(field)}.trim().length === 0`);
	return [...selectGuards, ...textGuards].join("");
}

export function renderViewManualColumnFilters(ir: ResourceIR): string {
	const selectEntries = resolveUiSelectFilterFields(ir).map((field) => `\t\t\t${field.camelName}: ${filterStateName(field)},`);
	const textEntries = resolveUiTextFilterFields(ir).map((field) => `\t\t\t${field.camelName}: ${filterStateName(field)},`);
	const entries = [...selectEntries, ...textEntries];
	if (entries.length === 0) {
		return "";
	}
	const deps = [...resolveUiSelectFilterFields(ir), ...resolveUiTextFilterFields(ir)]
		.map((field) => filterStateName(field))
		.join(", ");
	return `\tconst manualColumnFilters = useMemo(
\t\t(): Readonly<Record<string, string>> => ({
${entries.join("\n")}
\t\t}),
\t\t[${deps}],
\t);`;
}

export function renderViewHandleManualColumnFilterChange(ir: ResourceIR): string {
	const selectCases = resolveUiSelectFilterFields(ir).map((field) => {
		return `\t\tif (filterKey === "${field.camelName}") {\n\t\t\t${setterName(field)}(value === null || value === "all" ? "all" : value);\n\t\t}`;
	});
	const textCases = resolveUiTextFilterFields(ir).map((field) => {
		return `\t\tif (filterKey === "${field.camelName}") {\n\t\t\t${setterName(field)}(value ?? "");\n\t\t}`;
	});
	const cases = [...selectCases, ...textCases];
	if (cases.length === 0) {
		return "";
	}
	return `\tconst handleManualColumnFilterChange = useCallback((filterKey: string, value: string | null): void => {
${cases.join("\n")}
\t}, []);`;
}

export function renderViewTableFilters(ir: ResourceIR): string {
	const selectBlocks = resolveUiSelectFilterFields(ir).map((field) => {
		const label = humanizeFieldLabel(field.camelName);
		if (field.type === "boolean") {
			const options = booleanFilterOptionLabels(field);
			return `\t\t\t{
\t\t\t\tkey: "${field.camelName}",
\t\t\t\tlabel: ${tsStringLiteral(label)},
\t\t\t\toptions: [
\t\t\t\t\t{ value: "true", label: ${tsStringLiteral(options.trueLabel)} },
\t\t\t\t\t{ value: "false", label: ${tsStringLiteral(options.falseLabel)} },
\t\t\t\t],
\t\t\t},`;
		}
		const enumOptions = (field.enumValues ?? [])
			.map((value) => `\t\t\t\t\t{ value: ${tsStringLiteral(value)}, label: ${tsStringLiteral(humanizeFieldLabel(value))} },`)
			.join("\n");
		return `\t\t\t{
\t\t\t\tkey: "${field.camelName}",
\t\t\t\tlabel: ${tsStringLiteral(label)},
\t\t\t\toptions: [
${enumOptions}
\t\t\t\t],
\t\t\t},`;
	});
	const filterBlocks = [...selectBlocks];
	if (filterBlocks.length === 0) {
		return "";
	}
	return `\tconst tableFilters = useMemo(
\t\t(): Filter[] => [
${filterBlocks.join("\n")}
\t\t],
\t\t[],
\t);`;
}

export function renderViewTextFilterToolbar(ir: ResourceIR): string {
	const textBlocks = resolveUiTextFilterFields(ir).map((field) => {
		const label = humanizeFieldLabel(field.camelName);
		const state = filterStateName(field);
		const setter = setterName(field);
		return `\t\t\t<Input
\t\t\t\tkey="${field.camelName}"
\t\t\t\taria-label=${tsStringLiteral(label)}
\t\t\t\tplaceholder=${tsStringLiteral(`Filter by ${label.toLowerCase()}`)}
\t\t\t\tvalue={${state}}
\t\t\t\tonChange={(event): void => {
\t\t\t\t\t${setter}(event.target.value);
\t\t\t\t}}
\t\t\t\tclassName="h-9 w-full text-sm sm:w-44"
\t\t\t/>,`;
	});
	if (textBlocks.length === 0) {
		return "";
	}
	const deps = resolveUiTextFilterFields(ir).map((field) => filterStateName(field)).join(", ");
	return `\tconst textFilterToolbar = useMemo(
\t\t(): React.JSX.Element => (
\t\t\t<div className="flex flex-wrap gap-2">
${textBlocks.join("\n")}
\t\t\t</div>
\t\t),
\t\t[${deps}],
\t);`;
}

export function renderViewDataTableFilterProps(ir: ResourceIR): string {
	if (resolveUiSelectFilterFields(ir).length === 0 && resolveUiTextFilterFields(ir).length === 0) {
		return "";
	}
	return `\t\t\t\t\t\tfilters={tableFilters}
\t\t\t\t\t\tmanualColumnFilters={manualColumnFilters}
\t\t\t\t\t\tonManualColumnFilterChange={handleManualColumnFilterChange}`;
}

export function resolveViewBuildListQueryDeps(ir: ResourceIR): string[] {
	const selectDeps = resolveUiSelectFilterFields(ir).map((field) => parsedFilterName(field));
	const textDeps = resolveUiTextFilterFields(ir).map((field) => parsedFilterName(field));
	return [...selectDeps, ...textDeps];
}

export function renderListQueryKeyBinding(ir: ResourceIR, slug: string): { readonly destructure: string; readonly array: string } {
	const filterCamels = resolveListFilterFields(ir).map((field) => field.camelName);
	const keys = ["page", "cursor", "limit", "sortBy", "sortDirection", "search", ...filterCamels];
	return {
		destructure: keys.join(", "),
		array: `["${slug}", "list", ${keys.join(", ")}]`,
	};
}

export function renderViewFilterImports(ir: ResourceIR): string {
	const needsZod = resolveUiSelectFilterFields(ir).length > 0 || resolveUiTextFilterFields(ir).length > 0;
	if (!needsZod) {
		return "";
	}
	return `import { z } from "zod";\n`;
}

export function hasViewTableFilters(ir: ResourceIR): boolean {
	return resolveUiSelectFilterFields(ir).length > 0 || resolveUiTextFilterFields(ir).length > 0;
}
