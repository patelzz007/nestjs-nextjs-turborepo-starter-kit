/** lint-staged.config.mjs: one glob, mapped to the commands for its staged files. */
declare const config: Readonly<Record<string, (files: readonly string[]) => readonly string[]>>;

export default config;
