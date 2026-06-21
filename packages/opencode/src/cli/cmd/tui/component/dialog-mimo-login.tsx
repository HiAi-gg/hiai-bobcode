import { createSignal, onMount, Show } from "solid-js"
import { useSDK } from "../context/sdk"
import { useSync } from "@tui/context/sync"
import { useLocal } from "@tui/context/local"
import { useDialog } from "@tui/ui/dialog"
import { useTheme } from "../context/theme"
import { useLanguage } from "../context/language"
import { DialogProvider as DialogProviderList } from "./dialog-provider"
import { DialogSelect } from "@tui/ui/dialog-select"
import { DialogPrompt } from "../ui/dialog-prompt"
import { useToast } from "../ui/toast"
import os from "os"
import path from "path"

export function DialogMimoLogin() {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const local = useLocal()
  const toast = useToast()
  const { t } = useLanguage()

  return (
    <DialogSelect
      title={t("tui.dialog.login.title")}
      skipFilter
      options={[
        {
          title: t("tui.dialog.login.xiaomi"),
          value: "xiaomi",
          description: t("tui.dialog.login.xiaomi.desc"),
          onSelect: async () => {
            // 2026-06-21: xiaomi auth overlay is disabled. Surface a clear
            // error and let the user pick a standard provider instead.
            toast.show({ message: t("tui.dialog.login.start_failed"), variant: "error" })
            dialog.clear()
            return
          },
        },
        {
          title: t("tui.dialog.login.mimo_free"),
          value: "mimo-free",
          description: t("tui.dialog.login.mimo_free.desc"),
          onSelect: async () => {
            await sync.bootstrap()
            const mimo = sync.data.provider.find((p) => p.id === "mimo")
            if (!mimo || !("mimo-auto" in mimo.models)) {
              toast.show({ message: t("tui.dialog.login.mimo_free.unavailable"), variant: "error" })
              dialog.clear()
              return
            }
            local.model.set({ providerID: "mimo", modelID: "mimo-auto" }, { recent: true })
            toast.show({ message: t("tui.dialog.login.mimo_free.success"), variant: "info" })
            dialog.clear()
          },
        },
        {
          title: t("tui.dialog.login.import_claude"),
          value: "import_claude",
          onSelect: async () => {
            const claudeDir = path.join(os.homedir(), ".claude")
            const candidates = ["settings.json", "settings.local.json", "settings_local.json"]

            const resolve = await (async () => {
              const envs: Record<string, string>[] = []
              for (const file of candidates) {
                try {
                  const content = await Bun.file(path.join(claudeDir, file)).json()
                  if (content?.env && typeof content.env === "object") envs.push(content.env)
                } catch {}
              }
              return (name: string) => {
                for (let i = envs.length - 1; i >= 0; i--) {
                  const v = envs[i][name]
                  if (v && typeof v === "string") return v
                }
                return process.env[name]
              }
            })()

            const key = resolve("ANTHROPIC_API_KEY")
            const rawBaseUrl = resolve("ANTHROPIC_BASE_URL")
            const baseUrl = rawBaseUrl
              ? rawBaseUrl.replace(/\/+$/, "").replace(/(?<!\/v1)$/, "/v1")
              : undefined
            // strip Claude Code context-window suffix e.g. claude-opus-4-6[1m]
            const preferredModel = (
              resolve("ANTHROPIC_DEFAULT_OPUS_MODEL") ?? resolve("ANTHROPIC_DEFAULT_SONNET_MODEL")
            )?.replace(/\[.*\]$/, "")

            if (!key) {
              toast.show({ message: t("tui.dialog.login.import_claude.no_key"), variant: "error" })
              dialog.clear()
              return
            }

            await sdk.client.auth.set({
              providerID: "anthropic",
              auth: { type: "api", key },
            })
            await sdk.client.global.config.update({
              config: {
                provider: {
                  anthropic: { options: { baseURL: baseUrl || "https://api.anthropic.com/v1" } },
                },
              },
            })
            await sdk.client.instance.dispose()
            await sync.bootstrap()

            const anthropic = sync.data.provider.find((p) => p.id === "anthropic")
            if (anthropic) {
              if (preferredModel && !(preferredModel in anthropic.models)) {
                await sdk.client.global.config.update({
                  config: {
                    provider: {
                      anthropic: { models: { [preferredModel]: { name: preferredModel } } },
                    },
                  },
                })
                await sdk.client.instance.dispose()
                await sync.bootstrap()
              }
              const models = Object.keys(anthropic.models).sort()
              const selected = preferredModel
                || models.find((m) => m === "claude-opus-4-6")
                || models.findLast((m) => m.includes("opus"))
                || models.findLast((m) => m.includes("sonnet"))
                || models[0]
              if (selected) {
                local.model.set({ providerID: "anthropic", modelID: selected }, { recent: true })
              }
            }
            toast.show({ message: t("tui.dialog.login.import_claude.success"), variant: "info" })
            dialog.clear()
          },
        },
        {
          title: t("tui.dialog.login.other"),
          value: "__other__",
          onSelect: () => {
            dialog.replace(() => <DialogProviderList />)
          },
        },
      ]}
    />
  )
}

function MimoOAuthFlow(props: { url: string; instructions: string }) {
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const local = useLocal()
  const { theme } = useTheme()
  const { t } = useLanguage()
  const toast = useToast()
  const [busy, setBusy] = createSignal(false)

  // 2026-06-21: MimoOAuthFlow is unreachable from the login dialog (the parent
  // option now short-circuits with a toast). Kept here so the export surface
  // remains stable; on mount it clears the dialog and tells the user to use
  // a standard provider instead.

  onMount(async () => {
    toast.show({ message: t("tui.dialog.login.start_failed"), variant: "error" })
    dialog.clear()
  })

  return (
    <DialogPrompt
      title={t("tui.dialog.login.flow.title")}
      placeholder={t("tui.dialog.login.flow.placeholder")}
      busy={busy()}
      busyText={t("tui.dialog.login.flow.busy")}
      description={
        <box gap={1}>
          <Show when={props.url}>
            <text fg={theme.textMuted}>{t("tui.dialog.login.flow.manual_hint")}</text>
            <text fg={theme.primary}>{props.url}</text>
          </Show>
          <Show when={props.instructions}>
            <text fg={theme.textMuted}>{props.instructions}</text>
          </Show>
          <text fg={theme.textMuted}>{t("tui.dialog.login.flow.waiting")}</text>
        </box>
      }
      onConfirm={async (value) => {
        if (!value) return
        // 2026-06-21: xiaomi OAuth callback is disabled. Surface a clear error
        // and close so the user is steered toward a standard provider.
        toast.show({ message: t("tui.dialog.login.flow.invalid_code"), variant: "error" })
        setBusy(false)
        dialog.clear()
      }}
    />
  )
}
