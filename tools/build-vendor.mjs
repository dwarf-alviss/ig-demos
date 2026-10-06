import { build } from "esbuild";
await build({
  entryPoints: ["shared/studio.js"],
  bundle: true,
  format: "esm",
  outfile: "shared/studio.bundle.js",
  minify: true,
  sourcemap: false,
});
