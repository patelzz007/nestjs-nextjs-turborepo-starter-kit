import { composeConfigs } from "@workspace/oxlint-config/compose";
import { clientOnlyWidgetsConfig, config } from "@workspace/oxlint-config/react-internal";

import { CLIENT_ONLY_WIDGETS } from "@workspace/ui/lib/client-only-widgets";

/** packages/ui: the React library rules and the client-only widgets it ships (decision #58). */
export default composeConfigs(config, {
	overrides: [clientOnlyWidgetsConfig(CLIENT_ONLY_WIDGETS)],
});
