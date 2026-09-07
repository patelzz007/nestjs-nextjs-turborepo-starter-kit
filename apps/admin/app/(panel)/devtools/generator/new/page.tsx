import { fetchGeneratorModelsAction, fetchGeneratorUiModulesAction } from "@/lib/generator/actions";
import { GeneratorWizard } from "@/components/generator/generator-wizard";

export const dynamic = "force-dynamic";

export default async function GeneratorNewPage(): Promise<React.JSX.Element> {
	const [parentModels, uiModules] = await Promise.all([fetchGeneratorModelsAction(), fetchGeneratorUiModulesAction()]);
	return <GeneratorWizard parentModels={parentModels} uiModules={uiModules} />;
}
