import { execFileSync } from "node:child_process";
const git = (args, input) =>
  execFileSync("git", args, {
    input,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  }).trim();
const allow = new Set([
  "cakes",
  "flowers",
  "jewelry",
  "fashion",
  "shared",
  "index.html",
  "directions.html",
  ".nojekyll",
]);
const entries = git(["ls-tree", "HEAD"])
  .split("\n")
  .filter((line) => allow.has(line.split("\t")[1]));
if (entries.length !== allow.size) throw Error("Missing public content");
const tree = git(["mktree"], entries.join("\n") + "\n");
const branch = "codex/pages-showcase";
let parent = git(["rev-parse", "HEAD"]);
try {
  parent = git(["rev-parse", `refs/remotes/origin/${branch}`]);
} catch {}
const commit = git([
  "commit-tree",
  tree,
  "-p",
  parent,
  "-m",
  "Publish four storefronts and twelve design directions",
]);
git(["update-ref", `refs/heads/${branch}`, commit]);
console.log(JSON.stringify({ branch, commit, publicEntries: [...allow] }));
