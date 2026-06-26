import path from "path"
import fs from "fs/promises"
import os from "os"

const ROOT = path.resolve(import.meta.dirname, "..")
const binSource = path.join(ROOT, "packages", "opencode", "bin", "bob")
const mimocodeBinDir = path.join(os.homedir(), ".mimocode", "bin")
const targetSymlink = path.join(mimocodeBinDir, "bob")

async function main() {
  try {
    // 1. Create target bin directory if it doesn't exist
    await fs.mkdir(mimocodeBinDir, { recursive: true })

    // 2. Remove existing symlink/file/directory if present
    try {
      await fs.unlink(targetSymlink)
    } catch {
      // Ignored if it doesn't exist or is a directory
      try {
        await fs.rm(targetSymlink, { recursive: true, force: true })
      } catch {
        // Ignored
      }
    }

    // 3. Create the symlink
    await fs.symlink(binSource, targetSymlink)
    console.log(`[link-cli] Created symlink: ${targetSymlink} -> ${binSource}`)

    // 4. Verify PATH
    const pathEnv = process.env.PATH || ""
    const normalizedBinDir = path.normalize(mimocodeBinDir)
    const inPath = pathEnv
      .split(path.delimiter)
      .map((p) => path.normalize(p))
      .includes(normalizedBinDir)

    if (!inPath) {
      console.warn("\x1b[33m%s\x1b[0m", `[link-cli] WARNING: ${mimocodeBinDir} is not in your PATH!`)
      console.log(`To run 'bob' globally, add it to your shell config file (e.g. ~/.bashrc or ~/.zshrc):`)
      console.log(`  export PATH="${mimocodeBinDir}:\$PATH"`)
    } else {
      console.log(`[link-cli] 'bob' is linked and available in your PATH!`)
    }
  } catch (err) {
    console.error(`[link-cli] Error linking CLI:`, err)
  }
}

void main()
