/** `/catalog/categories/new` — create a category (gated by CREATE SAMPLE_CATEGORY in the route rules). */
export default function CreateSampleCategoryPage(): React.JSX.Element {
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Create SampleCategory</h1>
			<p className="text-muted-foreground">Add a create form or custom business rules here.</p>
		</div>
	);
}
