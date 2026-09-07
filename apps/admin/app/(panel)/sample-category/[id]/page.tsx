import { createAdminServerCaller } from "@/lib/admin-server-api";

import SampleCategoryDetailView from "../sample-category-detail-view.generated";

interface SampleCategoryDetailPageProps {
	readonly params: Promise<{ id: string }>;
}

export default async function SampleCategoryDetailPage({ params }: SampleCategoryDetailPageProps): Promise<React.JSX.Element> {
	const { id } = await params;
	const server = createAdminServerCaller();
	const result = await Promise.allSettled([server.sampleCategory.detail.query({ id })]);

	const first = result[0];
	const initialSampleCategory = first.status === "fulfilled" ? first.value.data : undefined;

	return <SampleCategoryDetailView id={id} initialSampleCategory={initialSampleCategory} />;
}
