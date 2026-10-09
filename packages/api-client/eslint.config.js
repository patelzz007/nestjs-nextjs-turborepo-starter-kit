import { config } from "@workspace/eslint-config/react-internal";
import { apiClientBoundaryConfigs } from "@workspace/eslint-config/import-boundaries";

/**
 * @workspace/api-client — the platform-neutral API client shared by the Next apps
 * and the mobile app. The core entry ("." → src/**) may not import next, react,
 * react-dom, @tanstack/react-query, DOM-only globals or Node built-ins; the React
 * entry ("./react" → src/react/**) may add react and @tanstack/react-query only
 * (docs/technical/mobile/mobile-app.md §4, docs/technical/tooling/eslint.md §3.1).
 *
 * @type {import("eslint").Linter.Config}
 */
export default [...config, ...apiClientBoundaryConfigs];
