import SampleCategoryDetailView from "../sample-category-detail-view";

interface SampleCategoryDetailPageProps {
	readonly params: Promise<{ id: string }>;
}

export default async function SampleCategoryDetailPage({ params }: SampleCategoryDetailPageProps): Promise<React.JSX.Element> {
	const { id } = await params;
	return <SampleCategoryDetailView id={id} />;
}
