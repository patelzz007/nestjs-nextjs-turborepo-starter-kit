interface EditSampleCategoryPageProps {
	readonly params: Promise<{ id: string }>;
}

export default async function EditSampleCategoryPage({ params }: EditSampleCategoryPageProps): Promise<React.JSX.Element> {
	const { id } = await params;
	// PATCH /sample-category/:id requires SAMPLE_CATEGORY.UPDATE. Access is enforced by the
	// route guard (lib/navigation/route-authorization.ts), so the page does not repeat it.
	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Edit SampleCategory</h1>
			<p className="text-muted-foreground">Editing resource {id}</p>
		</div>
	);
}
