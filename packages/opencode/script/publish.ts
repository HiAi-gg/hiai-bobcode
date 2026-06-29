#!/usr/bin/env bun
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@mimo-ai/script"

const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)

const name = "@hiai-gg/hiai-bobcode"
const version = pkg.version

if (process.platform !== "win32") await $`chmod -R 755 .`.cwd(dir)

await $`rm -rf ./dist`
await $`mkdir -p ./dist`
await $`cp -r ./bin ./dist/bin`
await $`cp ../../LICENSE.md ./dist/LICENSE.md`

await Bun.file(`./dist/package.json`).write(
  JSON.stringify(
    {
      name,
      version,
      license: pkg.license,
      bin: {
        bob: "./bin/bob",
      },
      os: ["linux"],
      cpu: ["x64"],
    },
    null,
    2,
  ),
)

const tgz = (await $`bun pm pack --quiet`.cwd("./dist").text()).trim()

await $`npm publish ${tgz} --access public --tag ${Script.channel} --provenance`.cwd("./dist")