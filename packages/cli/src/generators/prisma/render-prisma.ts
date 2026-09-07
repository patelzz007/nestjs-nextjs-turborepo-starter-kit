import { pluralizeLabel } from "../../core/humanize";
import type { FieldIR, ResourceIR } from "../../ir/types";

function prismaScalarType(fieldType: string): string {
	switch (fieldType) {
		case "string":
			return "String";
		case "text":
			return "String @db.Text";
		case "boolean":
			return "Boolean";
		case "int":
			return "Int";
		case "decimal":
			return "Decimal @db.Decimal(18, 2)";
		case "uuid":
			return "String";
		case "datetime":
			return "BigInt";
		case "enum":
			return "String";
		default:
			return "String";
	}
}

function toPlural(singular: string): string {
	return pluralizeLabel(singular);
}

function inverseRelationCollectionName(modelName: string): string {
	const plural = toPlural(modelName);
	return `${plural.charAt(0).toLowerCase()}${plural.slice(1)}`;
}

function relationPropertyName(fieldName: string): string {
	if (fieldName.endsWith("Id")) {
		return fieldName.slice(0, -2);
	}
	return fieldName;
}

function prismaEnumName(field: FieldIR, modelName: string, workflowEnumName: string | undefined): string | undefined {
	if (field.type !== "enum") {
		return undefined;
	}
	if (workflowEnumName !== undefined) {
		return workflowEnumName;
	}
	return `${modelName}${field.name.charAt(0).toUpperCase()}${field.name.slice(1)}`;
}

function prismaFieldLine(field: ResourceIR["fields"][number], enumName: string | undefined): string {
	const optional = field.nullable || !field.required ? "?" : "";
	const prismaType = enumName !== undefined ? enumName : prismaScalarType(field.type);
	const baseType = prismaType.split(" ")[0];
	const attributes = prismaType.includes("@") ? ` ${prismaType.slice(prismaType.indexOf("@"))}` : "";
	const mapAttribute = field.camelName !== field.prismaName ? ` @map("${field.prismaName}")` : "";
	return `  ${field.camelName} ${baseType}${optional}${mapAttribute}${attributes}`;
}

function renderPrismaEnumBlocks(ir: ResourceIR): string[] {
	const blocks: string[] = [];
	const emittedEnumNames = new Set<string>();

	if (ir.workflow !== undefined) {
		const values = new Set<string>([ir.workflow.initial]);
		for (const targets of Object.values(ir.workflow.transitions)) {
			for (const target of targets) {
				values.add(target);
			}
		}
		blocks.push(`enum ${ir.workflow.enumName} {`);
		for (const value of [...values].sort()) {
			blocks.push(`  ${value.toUpperCase()}`);
		}
		blocks.push("}");
		blocks.push("");
		emittedEnumNames.add(ir.workflow.enumName);
	}

	for (const field of ir.fields) {
		if (field.type !== "enum" || field.enumValues === undefined || field.enumValues.length === 0) {
			continue;
		}
		const workflowEnumName = ir.workflow?.field === field.name ? ir.workflow.enumName : undefined;
		const enumName = prismaEnumName(field, ir.resource.modelName, workflowEnumName);
		if (enumName === undefined || emittedEnumNames.has(enumName)) {
			continue;
		}
		blocks.push(`enum ${enumName} {`);
		for (const value of [...field.enumValues].sort()) {
			blocks.push(`  ${value.toUpperCase()}`);
		}
		blocks.push("}");
		blocks.push("");
		emittedEnumNames.add(enumName);
	}

	return blocks;
}

export function renderPrismaModelBlock(ir: ResourceIR): string {
	const lines: string[] = [...renderPrismaEnumBlocks(ir)];

	lines.push(`/// Generated resource model (${ir.resource.name}).`);
	lines.push(`model ${ir.resource.modelName} {`);
	lines.push("  id String @id @default(uuid())");

	if (ir.rls === "user-owned") {
		lines.push('  ownerUserId String @map("owner_user_id")');
	}
	if (ir.rls === "organization-scoped") {
		lines.push('  organizationId String @map("organization_id")');
	}

	for (const field of ir.fields) {
		const workflowEnumName = field.type === "enum" && ir.workflow?.field === field.name ? ir.workflow.enumName : undefined;
		const enumName = prismaEnumName(field, ir.resource.modelName, workflowEnumName);
		lines.push(prismaFieldLine(field, enumName));
	}

	if (ir.concurrency) {
		lines.push("  version Int @default(0)");
	}
	if (ir.softDelete) {
		lines.push('  deletedAt BigInt? @map("deleted_at")');
	}
	lines.push('  createdAt BigInt @default(dbgenerated("(EXTRACT(EPOCH FROM now()) * 1000)::bigint")) @map("created_at")');
	lines.push('  updatedAt BigInt @default(dbgenerated("(EXTRACT(EPOCH FROM now()) * 1000)::bigint")) @map("updated_at")');

	for (const relation of ir.relations) {
		const propertyName = relationPropertyName(relation.name);
		if (relation.cardinality === "one") {
			lines.push(`  ${propertyName} ${relation.model}? @relation(fields: [${relation.field}], references: [id])`);
		}
	}

	for (const child of ir.cascadeSoftDeleteChildren) {
		const propertyName = inverseRelationCollectionName(child.childModelName);
		lines.push(`  ${propertyName} ${child.childModelName}[]`);
	}

	lines.push(`  @@map("${ir.resource.slug.replace(/-/g, "_")}")`);
	lines.push("}");
	return lines.join("\n");
}

export function renderRlsBlock(ir: ResourceIR): string {
	const table = ir.resource.slug.replace(/-/g, "_");
	const lines: string[] = [];
	lines.push(`-- Generated RLS for ${ir.resource.modelName} (${ir.rls})`);
	lines.push(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
	lines.push(`DROP POLICY IF EXISTS ${table}_select ON ${table};`);
	lines.push(`DROP POLICY IF EXISTS ${table}_insert ON ${table};`);
	lines.push(`DROP POLICY IF EXISTS ${table}_update ON ${table};`);
	lines.push(`DROP POLICY IF EXISTS ${table}_delete ON ${table};`);

	if (ir.rls === "admin-only") {
		lines.push(`CREATE POLICY ${table}_select ON ${table} FOR SELECT USING (app_rls_bypass());`);
		lines.push(`CREATE POLICY ${table}_insert ON ${table} FOR INSERT WITH CHECK (app_rls_bypass());`);
		lines.push(`CREATE POLICY ${table}_update ON ${table} FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());`);
		lines.push(`CREATE POLICY ${table}_delete ON ${table} FOR DELETE USING (app_rls_bypass());`);
	} else if (ir.rls === "user-owned") {
		lines.push(`CREATE POLICY ${table}_select ON ${table} FOR SELECT USING (app_owns(owner_user_id));`);
		lines.push(`CREATE POLICY ${table}_insert ON ${table} FOR INSERT WITH CHECK (app_owns(owner_user_id));`);
		lines.push(`CREATE POLICY ${table}_update ON ${table} FOR UPDATE USING (app_owns(owner_user_id)) WITH CHECK (app_owns(owner_user_id));`);
		lines.push(`CREATE POLICY ${table}_delete ON ${table} FOR DELETE USING (app_owns(owner_user_id));`);
	} else if (ir.rls === "organization-scoped") {
		lines.push(`CREATE POLICY ${table}_select ON ${table} FOR SELECT USING (app_rls_bypass() OR organization_id = app_current_organization_id());`);
		lines.push(`CREATE POLICY ${table}_insert ON ${table} FOR INSERT WITH CHECK (app_rls_bypass() OR organization_id = app_current_organization_id());`);
		lines.push(
			`CREATE POLICY ${table}_update ON ${table} FOR UPDATE USING (app_rls_bypass() OR organization_id = app_current_organization_id()) WITH CHECK (app_rls_bypass() OR organization_id = app_current_organization_id());`,
		);
		lines.push(`CREATE POLICY ${table}_delete ON ${table} FOR DELETE USING (app_rls_bypass() OR organization_id = app_current_organization_id());`);
	} else {
		lines.push(`CREATE POLICY ${table}_select ON ${table} FOR SELECT USING (true);`);
		lines.push(`CREATE POLICY ${table}_insert ON ${table} FOR INSERT WITH CHECK (app_rls_bypass());`);
		lines.push(`CREATE POLICY ${table}_update ON ${table} FOR UPDATE USING (app_rls_bypass()) WITH CHECK (app_rls_bypass());`);
		lines.push(`CREATE POLICY ${table}_delete ON ${table} FOR DELETE USING (app_rls_bypass());`);
	}
	return lines.join("\n");
}
