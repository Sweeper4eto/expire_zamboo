import { spawnSync } from "node:child_process";

function run(args) {
  console.log(`> next ${args.join(" ")}`);
  return spawnSync("npx", ["next", ...args], {
    stdio: "pipe",
    encoding: "utf8",
    shell: true,
    env: process.env,
  });
}

let result = run(["build", "--webpack"]);
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");

// Only fall back when this Next.js install is too old to know --webpack
// (i.e. its CLI rejects the flag). Real build/compile failures must not be
// retried with plain `next build`, since that uses Turbopack and conflicts
// with our custom webpack() config in next.config.ts.
const unknownFlag = /unknown or unexpected option: --webpack/i.test(
  `${result.stdout ?? ""}${result.stderr ?? ""}`,
);

if (result.status !== 0 && unknownFlag) {
  console.warn(
    "This Next.js install does not support --webpack; retrying with plain `next build`. " +
      "Update next to 16.2.9 on this server to fix this permanently.",
  );
  result = run(["build"]);
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
}

process.exit(result.status ?? 1);
