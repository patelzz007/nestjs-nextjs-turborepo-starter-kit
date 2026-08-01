import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: true,
	sourcemap: true,
	clean: true,
	target: "node20",
	outDir: "dist",
	// zod is external — consumers install it themselves
	external: ["zod"],
});
