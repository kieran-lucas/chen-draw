import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve, sep } from "node:path";
import { packager } from "@electron/packager";

const root = resolve(import.meta.dirname, "..");
const stage = join(root, ".desktop-package");
const release = join(root, "release");
const iconPath = join(root, "build-assets", "Chen Studio.ico");
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const electronPkg = JSON.parse(
  await readFile(
    join(root, "node_modules", "electron", "package.json"),
    "utf8",
  ),
);

if (!stage.startsWith(`${root}${sep}`) || !release.startsWith(`${root}${sep}`))
  throw new Error("Desktop output paths must stay inside the project.");
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await mkdir(join(root, "build-assets"), { recursive: true });
execFileSync("powershell.exe", [
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  join(root, "scripts", "create-icon.ps1"),
  "-OutputPath",
  iconPath,
]);
await cp(join(root, "dist"), join(stage, "dist"), { recursive: true });
await cp(join(root, "electron"), join(stage, "electron"), { recursive: true });
await writeFile(
  join(stage, "package.json"),
  JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      main: pkg.main,
      description: "Chen and EER diagram editor",
    },
    null,
    2,
  ),
);

const output = await packager({
  dir: stage,
  out: release,
  name: "Chen Studio",
  executableName: "Chen Studio",
  platform: "win32",
  arch: "x64",
  electronVersion: electronPkg.version,
  overwrite: true,
  icon: iconPath,
  asar: true,
  prune: false,
});
console.log(`Desktop package: ${output[0]}`);
