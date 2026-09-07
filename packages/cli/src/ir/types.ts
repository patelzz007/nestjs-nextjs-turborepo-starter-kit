import type { ResourceFieldDefinition, RlsPolicy } from "../schema/resource-definition";

export interface ResourceIdentityIR {
	readonly name: string;
	readonly singular: string;
	readonly plural: string;
	readonly slug: string;
	readonly contractKey: string;
	readonly modelName: string;
	readonly permissionResource: string;
}

export interface FieldIR {
	readonly name: string;
	readonly camelName: string;
	readonly prismaName: string;
	readonly type: ResourceFieldDefinition["type"];
	readonly required: boolean;
	readonly nullable: boolean;
	readonly defaultValue: string | number | boolean | undefined;
	readonly searchable: boolean;
	readonly sortable: boolean;
	readonly filterable: boolean;
	readonly min: number | undefined;
	readonly max: number | undefined;
	readonly enumValues: readonly string[] | undefined;
	readonly relation:
		| {
				readonly model: string;
				readonly field: string;
				readonly cardinality: "one" | "many";
				readonly cascadeSoftDelete: boolean;
		  }
		| undefined;
}

export interface CascadeSoftDeleteChildIR {
	readonly childModelName: string;
	readonly childDelegate: string;
	readonly childSlug: string;
	readonly foreignKey: string;
}

export interface RelationIR {
	readonly name: string;
	readonly model: string;
	readonly field: string;
	readonly cardinality: "one" | "many";
	readonly joinModelName: string | undefined;
}

export interface WorkflowIR {
	readonly field: string;
	readonly initial: string;
	readonly transitions: Readonly<Record<string, readonly string[]>>;
	readonly enumName: string;
}

export interface PermissionIR {
	readonly action: "CREATE" | "READ" | "UPDATE" | "DELETE" | "LIST" | "MANAGE";
	readonly enabled: boolean;
}

export interface AdminListIR {
	readonly searchable: readonly string[];
	readonly filters: readonly string[];
	readonly sortable: readonly string[];
	readonly columns: readonly string[];
}

export interface AdminFormIR {
	readonly layout: "single-column" | "two-column";
	readonly fields: readonly string[];
}

export interface AdminNavigationIR {
	readonly label: string;
	readonly icon: string;
	readonly group: string;
	readonly order: number;
	readonly hiddenInProduction: boolean;
}

export interface UiTargetIR {
	readonly moduleId: string;
	readonly navigation: AdminNavigationIR | undefined;
	readonly list: AdminListIR;
	readonly form: AdminFormIR;
}

export interface ResourceScopeIR {
	readonly api: boolean;
	readonly shared: boolean;
	readonly client: boolean;
	readonly ui: readonly string[];
}

export interface ActiveUiContextIR {
	readonly moduleId: string;
	readonly routePrefix: string;
}

export interface ResourceIR {
	readonly version: number;
	readonly resource: ResourceIdentityIR;
	readonly scope: ResourceScopeIR;
	readonly fields: readonly FieldIR[];
	readonly relations: readonly RelationIR[];
	readonly workflow: WorkflowIR | undefined;
	readonly softDelete: boolean;
	readonly concurrency: boolean;
	readonly idempotency: boolean;
	readonly rls: RlsPolicy;
	readonly cascadeSoftDeleteChildren: readonly CascadeSoftDeleteChildIR[];
	readonly permissions: readonly PermissionIR[];
	readonly uiTargets: Readonly<Record<string, UiTargetIR>>;
	/** Populated during UI rendering for the active module. */
	readonly admin:
		| {
				readonly navigation: AdminNavigationIR | undefined;
				readonly list: AdminListIR;
				readonly form: AdminFormIR;
		  }
		| undefined;
	readonly activeUi: ActiveUiContextIR | undefined;
	readonly events: {
		readonly created: boolean;
		readonly updated: boolean;
		readonly deleted: boolean;
	};
	readonly audit: boolean;
}

export interface GenerationPlanEntry {
	readonly path: string;
	readonly action: "create" | "modify" | "skip" | "conflict";
	readonly reason: string;
	readonly ownership: "generated" | "scaffolded" | "manual";
}

export interface GenerationPlan {
	readonly resourceSlug: string;
	readonly entries: readonly GenerationPlanEntry[];
	readonly destructiveChanges: readonly string[];
	readonly manualFollowUps: readonly string[];
}
