import { composeConfigs } from "@workspace/oxlint-config/compose";
import { apiClientBoundaryConfigs } from "@workspace/oxlint-config/import-boundaries";
import { config } from "@workspace/oxlint-config/react-internal";

/** packages/api-client: the React library rules plus its portability boundaries (runs in the Next apps AND React Native). */
export default composeConfigs(config, {
	overrides: [...apiClientBoundaryConfigs],
});
