import type { CreateSampleCategoryInput, SampleCategory, SampleCategoryListQuery, UpdateSampleCategoryInput } from "@workspace/shared";

import type { CatalogList } from "./product.repository";

export interface SampleCategoryRepository {
	list(query: SampleCategoryListQuery): Promise<CatalogList<SampleCategory>>;
	findById(id: string): Promise<SampleCategory | null>;
	create(input: CreateSampleCategoryInput): Promise<SampleCategory>;
	update(id: string, input: UpdateSampleCategoryInput): Promise<SampleCategory>;
	delete(id: string): Promise<void>;
	createMany(inputs: readonly CreateSampleCategoryInput[]): Promise<readonly SampleCategory[]>;
	deleteMany(ids: readonly string[]): Promise<number>;
	restore(id: string): Promise<SampleCategory>;
}
