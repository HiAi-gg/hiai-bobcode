import { describe, expect, test } from "bun:test"
import path from "path"
import { resolveMimocodeHome } from "@mimo-ai/shared/global"

describe("resolveMimocodeHome", () => {
  test("with HIAI_BOB_HOME set, resolves 4 subdirs under root", () => {
    const result = resolveMimocodeHome({
      HIAI_BOB_HOME: "/tmp/profile-a",
    })
    expect(result.mode).toBe("mimocode_home")
    expect(result.root).toBe("/tmp/profile-a")
    expect(result.config).toBe(path.join("/tmp/profile-a", "config"))
    expect(result.data).toBe(path.join("/tmp/profile-a", "data"))
    expect(result.state).toBe(path.join("/tmp/profile-a", "state"))
    expect(result.cache).toBe(path.join("/tmp/profile-a", "cache"))
  })

  test("with MIMOCODE_HOME set (fallback), resolves 4 subdirs under root", () => {
    const result = resolveMimocodeHome({
      MIMOCODE_HOME: "/tmp/profile-b",
    })
    expect(result.mode).toBe("mimocode_home")
    expect(result.root).toBe("/tmp/profile-b")
    expect(result.config).toBe(path.join("/tmp/profile-b", "config"))
  })

  test("without home env vars, falls through to xdg mode", () => {
    const result = resolveMimocodeHome({})
    expect(result.mode).toBe("xdg")
    expect(result.root).toBeUndefined()
    // xdg paths end with "/hiai-bob"
    expect(result.config.endsWith(path.join("", "hiai-bob"))).toBe(true)
    expect(result.data.endsWith(path.join("", "hiai-bob"))).toBe(true)
    expect(result.state.endsWith(path.join("", "hiai-bob"))).toBe(true)
    expect(result.cache.endsWith(path.join("", "hiai-bob"))).toBe(true)
  })

  test("empty home env variables are treated as unset (xdg mode)", () => {
    const result = resolveMimocodeHome({ HIAI_BOB_HOME: "", MIMOCODE_HOME: "" })
    expect(result.mode).toBe("xdg")
  })

  test("relative HIAI_BOB_HOME path throws with clear error", () => {
    expect(() => resolveMimocodeHome({ HIAI_BOB_HOME: "./foo" })).toThrow(
      /HIAI_BOB_HOME or MIMOCODE_HOME must be an absolute path/,
    )
    expect(() => resolveMimocodeHome({ MIMOCODE_HOME: "foo/bar" })).toThrow(
      /HIAI_BOB_HOME or MIMOCODE_HOME must be an absolute path/,
    )
  })

  test("tilde-prefixed path throws (not treated as absolute)", () => {
    expect(() => resolveMimocodeHome({ HIAI_BOB_HOME: "~/profiles/a" })).toThrow(
      /HIAI_BOB_HOME or MIMOCODE_HOME must be an absolute path/,
    )
  })

  test("error message includes the offending value", () => {
    expect(() => resolveMimocodeHome({ HIAI_BOB_HOME: "./relative" })).toThrow(
      /\.\/relative/,
    )
  })
})
