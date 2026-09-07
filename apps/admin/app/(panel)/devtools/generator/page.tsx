import { fetchGeneratorResourcesAction, fetchGeneratorUiModulesAction } from "@/lib/generator/actions";
import { GeneratorHub } from "@/components/generator/generator-hub";

export const dynamic = "force-dynamic";

export default async function GeneratorPage(): Promise<React.JSX.Element> {
	const [resources, uiModules] = await Promise.all([fetchGeneratorResourcesAction(), fetchGeneratorUiModulesAction()]);
	return <GeneratorHub resources={resources} uiModules={uiModules} />;
}
