import { build } from "esbuild";
await build({
  entryPoints: ["shared/studio.js"],
  bundle: true,
  format: "esm",
  outfile: "shared/studio.bundle.js",
  minify: true,
  sourcemap: false,
});

await build({
  entryPoints: ["shared/audit.js"],
  bundle: true,
  format: "esm",
  outfile: "shared/audit.bundle.js",
  minify: true,
  sourcemap: false,
});
