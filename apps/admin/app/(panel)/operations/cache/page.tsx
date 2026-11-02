import { CacheView } from "@/contexts/operations/components/cache-view";

export const dynamic = "force-dynamic";

/** `/operations/cache` — each cache's numbers, Redis memory and flushes (ADR 072). */
export default function OperationsCachePage(): React.JSX.Element {
	return <CacheView />;
}
