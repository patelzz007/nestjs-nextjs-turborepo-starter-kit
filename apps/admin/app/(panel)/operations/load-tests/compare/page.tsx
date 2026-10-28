import { UuidParamSchema } from "@workspace/shared";
import { notFound } from "next/navigation";

import { LoadTestCompare } from "@/contexts/operations/components/load-test-detail";
import { LOAD_TEST_COMPARE_PARAMS } from "@/lib/routes";

export const dynamic = "force-dynamic";

/** `/operations/load-tests/compare?a=&b=` — two load tests side by side (ADR 068). */
export default async function OperationsLoadTestComparePage({
	searchParams,
}: {
	readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.JSX.Element> {
	const query = await searchParams;
	const left = UuidParamSchema.safeParse(query[LOAD_TEST_COMPARE_PARAMS.left]);
	const right = UuidParamSchema.safeParse(query[LOAD_TEST_COMPARE_PARAMS.right]);
	if (!left.success || !right.success) {
		notFound();
	}
	return <LoadTestCompare leftId={left.data} rightId={right.data} />;
}
