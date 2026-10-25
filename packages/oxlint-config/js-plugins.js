import { fileURLToPath } from "node:url";

/**
 * The JS plugins the shared configs load, as absolute paths.
 *
 * Oxlint resolves a `jsPlugins` specifier from the directory of the config it
 * is running (the workspace's `oxlint.config.ts`), so a package name would only
 * load in workspaces that happen to depend on it. Resolving here, from this
 * package (which declares every plugin as a dependency), keeps ownership in one
 * place: a workspace depends on `@workspace/oxlint-config` and nothing else.
 */

/** @param {string} specifier */
function resolvePlugin(specifier) {
	return fileURLToPath(import.meta.resolve(specifier));
}

/** The repository's own rules (`workspace/*`). */
export const WORKSPACE_PLUGIN = { name: "workspace", specifier: fileURLToPath(new URL("./plugin/index.js", import.meta.url)) };

/** `turbo/no-undeclared-env-vars`. */
export const TURBO_PLUGIN = { name: "turbo", specifier: resolvePlugin("eslint-plugin-turbo") };

/** eslint-plugin-react rules oxlint has no native version of (`react-js/*`). */
export const REACT_PLUGIN = { name: "react-js", specifier: resolvePlugin("eslint-plugin-react") };

/** The React Compiler rules of eslint-plugin-react-hooks (`react-hooks-js/*`; see rules/react.js). */
export const REACT_HOOKS_PLUGIN = { name: "react-hooks-js", specifier: resolvePlugin("eslint-plugin-react-hooks") };

/** eslint-plugin-jsx-a11y rules where oxlint's native port diverges (`jsx-a11y-js/*`; see rules/jsx-a11y.js). */
export const JSX_A11Y_PLUGIN = { name: "jsx-a11y-js", specifier: resolvePlugin("eslint-plugin-jsx-a11y") };

/** @next/eslint-plugin-next rules oxlint has no native version of (`next-js/*`). */
export const NEXT_PLUGIN = { name: "next-js", specifier: resolvePlugin("@next/eslint-plugin-next") };

/** eslint-plugin-react-native (`react-native/*`). */
export const REACT_NATIVE_PLUGIN = { name: "react-native", specifier: resolvePlugin("eslint-plugin-react-native") };

/** @darraghor/eslint-plugin-nestjs-typed (`nestjs/*`). */
export const NESTJS_PLUGIN = { name: "nestjs", specifier: resolvePlugin("@darraghor/eslint-plugin-nestjs-typed") };
