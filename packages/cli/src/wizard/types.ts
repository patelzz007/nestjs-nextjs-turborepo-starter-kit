import type { RelationCardinality, ResourceScalarType, RlsPolicy } from "../schema/resource-definition.js";

export interface WizardFieldInput {
	readonly name: string;
	readonly type: ResourceScalarType;
	readonly required: boolean;
	readonly nullable: boolean;
	readonly searchable: boolean;
	readonly sortable: boolean;
	readonly filterable: boolean;
	readonly defaultValue?: string | number | boolean;
	readonly enumValues?: string[];
	readonly relation?: {
		readonly model: string;
		readonly field: string;
		readonly cardinality: RelationCardinality;
	};
}

export interface WizardResourceInput {
	readonly name: string;
	readonly rls: RlsPolicy;
	readonly softDelete: boolean;
	readonly concurrency: boolean;
	readonly idempotency: boolean;
	readonly fields: WizardFieldInput[];
	readonly navigationLabel: string;
}

export interface DiscoveredModel {
	readonly modelName: string;
	readonly slug: string;
}
