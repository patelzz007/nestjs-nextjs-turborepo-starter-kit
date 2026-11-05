import { composeConfigs } from "@workspace/oxlint-config/compose";
import { config } from "@workspace/oxlint-config/react-internal";

/** apps/docs: the React rules; the Start build output and the generated route tree are not source. */
export default composeConfigs(config, {
	ignorePatterns: ["dist/**", ".output/**", ".tanstack/**", "src/routeTree.gen.ts"],
});
