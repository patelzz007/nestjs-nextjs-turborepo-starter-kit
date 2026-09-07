import type { ResourceIR } from "../../ir/types";

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
	if (singular.endsWith("y") && singular.length > 1) {
		return `${singular.slice(0, -1)}ies`;
	}
	if (singular.endsWith("s")) {
		return `${singular}es`;
	}
	return `${singular}s`;
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

function prismaFieldLine(field: ResourceIR["fields"][number], workflowEnumName: string | undefined): string {
	const optional = field.nullable || !field.required ? "?" : "";
	const prismaType = field.type === "enum" && workflowEnumName !== undefined ? workflowEnumName : prismaScalarType(field.type);
	const baseType = prismaType.split(" ")[0];
	const attributes = prismaType.includes("@") ? ` ${prismaType.slice(prismaType.indexOf("@"))}` : "";
	const mapAttribute = field.camelName !== field.prismaName ? ` @map("${field.prismaName}")` : "";
	return `  ${field.camelName} ${baseType}${optional}${mapAttribute}${attributes}`;
}

export function renderPrismaModelBlock(ir: ResourceIR): string {
	const lines: string[] = [];
	if (ir.workflow !== undefined) {
		lines.push(`enum ${ir.workflow.enumName} {`);
		const values = new Set<string>([ir.workflow.initial]);
		for (const targets of Object.values(ir.workflow.transitions)) {
			for (const target of targets) {
				values.add(target);
			}
		}
		for (const value of [...values].sort()) {
			lines.push(`  ${value.toUpperCase()}`);
		}
		lines.push("}");
		lines.push("");
	}

	lines.push(`/// Generated resource model (${ir.resource.name}).`);
	lines.push(`model ${ir.resource.modelName} {`);
	lines.push("  id String @id @default(uuid())");

	for (const field of ir.fields) {
		const workflowEnumName = field.type === "enum" && ir.workflow?.field === field.name ? ir.workflow.enumName : undefined;
		lines.push(prismaFieldLine(field, workflowEnumName));
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
