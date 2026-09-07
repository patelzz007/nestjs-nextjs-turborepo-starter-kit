import type { FieldIR, ResourceIR } from "../../ir/types";

function renderDetailFieldValue(field: FieldIR): string {
	const accessor = `entity.${field.camelName}`;
	if (field.type === "boolean") {
		return `${accessor} ? "Yes" : "No"`;
	}
	if (field.type === "decimal") {
		if (field.nullable) {
			return `${accessor} !== null && Number.isFinite(${accessor}) ? ${accessor}.toFixed(2) : "—"`;
		}
		return `Number.isFinite(${accessor}) ? ${accessor}.toFixed(2) : "—"`;
	}
	if (field.type === "datetime") {
		return `Number.isFinite(${accessor}) ? formatEpoch(${accessor}) : "—"`;
	}
	if (field.type === "int") {
		if (field.nullable) {
			return `${accessor} !== null ? String(${accessor}) : "—"`;
		}
		return `String(${accessor})`;
	}
	if (field.nullable) {
		return `${accessor} ?? "—"`;
	}
	return `String(${accessor})`;
}

function renderDetailField(field: FieldIR): string {
	const label = `${field.camelName.charAt(0).toUpperCase()}${field.camelName.slice(1).replace(/([A-Z])/g, " $1")}`;
	return `\t\t\t\t\t<DetailField label="${label}" value={${renderDetailFieldValue(field)}} />`;
}

function resolveSubtitleField(ir: ResourceIR): string | undefined {
	const formFields = ir.admin?.form.fields ?? [];
	if (formFields.includes("slug")) {
		return "slug";
	}
	if (formFields.includes("sku")) {
		return "sku";
	}
	return undefined;
}

function resolveTitleField(ir: ResourceIR): string {
	const formFields = ir.admin?.form.fields ?? [];
	if (formFields.includes("name")) {
		return "name";
	}
	return formFields[0] ?? "id";
}

function resolveStatusBadges(ir: ResourceIR): string {
	const badges: string[] = [];
	const hasIsActive = ir.fields.some((field) => field.camelName === "isActive");
	const hasIsFeatured = ir.fields.some((field) => field.camelName === "isFeatured");
	if (hasIsActive) {
		badges.push(`{entity.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}`);
	}
	if (hasIsFeatured) {
		badges.push(`{entity.isFeatured ? <Badge variant="outline">Featured</Badge> : null}`);
	}
	if (badges.length === 0) {
		return "";
	}
	return `\n\t\t\t\t\t<div className="flex flex-wrap gap-2">\n\t\t\t\t\t\t${badges.join("\n\t\t\t\t\t\t")}\n\t\t\t\t\t</div>`;
}

export function renderAdminDetailView(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const slug = ir.resource.slug;
	const contractKey = ir.resource.contractKey;
	const pluralLabel = ir.admin?.navigation?.label ?? ir.resource.plural;
	const singularLabel = ir.resource.singular.toLowerCase();
	const titleField = resolveTitleField(ir);
	const subtitleField = resolveSubtitleField(ir);
	const formFieldNames = ir.admin?.form.fields ?? [];
	const detailFields = ir.fields.filter(
		(field) => formFieldNames.includes(field.camelName) && field.camelName !== titleField && field.camelName !== subtitleField,
	);
	const detailFieldBlocks = detailFields.map((field) => renderDetailField(field)).join("\n");
	const statusBadges = resolveStatusBadges(ir);
	const subtitleLine = subtitleField !== undefined ? `\n\t\t\t\t\t\t<p className="text-sm text-muted-foreground">{entity.${subtitleField}}</p>` : "";

	return `"use client";

import { stubApiMeta } from "@/lib/api-envelope";
import { useAuth } from "@workspace/client/lib/auth";
import type { ${model} } from "@workspace/shared/schemas/domain/${slug}.generated";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

export interface ${model}DetailViewProps {
\treadonly id: string;
\treadonly initial${model}?: ${model};
}

function formatEpoch(value: number): string {
\treturn new Date(value).toLocaleString();
}

function DetailField({ label, value }: { readonly label: string; readonly value: string }): React.JSX.Element {
\treturn (
\t\t<div className="space-y-1">
\t\t\t<div className="text-sm text-muted-foreground">{label}</div>
\t\t\t<div className="font-medium break-all">{value}</div>
\t\t</div>
\t);
}

export default function ${model}DetailView({ id, initial${model} }: ${model}DetailViewProps): React.JSX.Element {
\tconst { api } = useAuth();
\tconst initialQueryData = useMemo(
\t\t() =>
\t\t\tinitial${model} !== undefined
\t\t\t\t? {
\t\t\t\t\t\tsuccess: true as const,
\t\t\t\t\t\tdata: initial${model},
\t\t\t\t\t\tmeta: stubApiMeta(),
\t\t\t\t\t}
\t\t\t\t: undefined,
\t\t[initial${model}],
\t);
\tconst detailQuery = api.${contractKey}.detail.useQuery({ id }, { initialData: initialQueryData });
\tconst entity: ${model} | undefined = detailQuery.data?.data;

\tif (detailQuery.isLoading && entity === undefined) {
\t\treturn <p className="text-muted-foreground">Loading ${singularLabel}…</p>;
\t}

\tif (detailQuery.isError || entity === undefined) {
\t\treturn (
\t\t\t<div className="space-y-4">
\t\t\t\t<Button variant="outline" nativeButton={false} render={<Link href="/${slug}" />}>
\t\t\t\t\t<ArrowLeft className="mr-2 size-4" />
\t\t\t\t\tBack to ${pluralLabel.toLowerCase()}
\t\t\t\t</Button>
\t\t\t\t<p className="text-destructive">Could not load this ${singularLabel}.</p>
\t\t\t</div>
\t\t);
\t}

\treturn (
\t\t<div className="space-y-4">
\t\t\t<div className="flex flex-wrap items-center justify-between gap-3">
\t\t\t\t<Button variant="outline" nativeButton={false} render={<Link href="/${slug}" />}>
\t\t\t\t\t<ArrowLeft className="mr-2 size-4" />
\t\t\t\t\tBack to ${pluralLabel.toLowerCase()}
\t\t\t\t</Button>
\t\t\t\t<Button nativeButton={false} render={<Link href={\`/${slug}/\${entity.id}/edit\`} />}>
\t\t\t\t\t<Pencil className="mr-2 size-4" />
\t\t\t\t\tEdit
\t\t\t\t</Button>
\t\t\t</div>

\t\t\t<Card>
\t\t\t\t<CardHeader className="flex flex-row items-start justify-between gap-4">
\t\t\t\t\t<div className="space-y-1">
\t\t\t\t\t\t<CardTitle>{entity.${titleField}}</CardTitle>${subtitleLine}
\t\t\t\t\t</div>${statusBadges}
\t\t\t\t</CardHeader>
\t\t\t\t<CardContent className="grid gap-4 sm:grid-cols-2">
\t\t\t\t\t<DetailField label="ID" value={entity.id} />
${detailFieldBlocks}
\t\t\t\t\t<DetailField label="Created" value={formatEpoch(entity.createdAt)} />
\t\t\t\t\t<DetailField label="Updated" value={formatEpoch(entity.updatedAt)} />
\t\t\t\t</CardContent>
\t\t\t</Card>
\t\t</div>
\t);
}
`;
}
