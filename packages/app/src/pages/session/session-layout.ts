import { createMemo } from "solid-js"
import { useLayout } from "@/context/layout"
import { useSessionScope } from "@/context/session-scope"

export const useSessionKey = () => {
  // Scope (route params by default, a grid cell's session when overridden).
  const params = useSessionScope()
  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  return { params, sessionKey }
}

export const useCellSession = (dir: string, sessionID: string) => {
  return {
    params: { dir, id: sessionID },
    sessionKey: `${dir}/${sessionID}`,
  }
}

export const useSessionLayout = (sessionID?: string) => {
  const layout = useLayout()
  const { params, sessionKey } = useSessionKey()
  const effectiveSessionID = sessionID ?? params.id
  const effectiveSessionKey = createMemo(() => sessionID ? `${params.dir}/${sessionID}` : sessionKey())
  return {
    params: { dir: params.dir, id: effectiveSessionID },
    sessionKey: effectiveSessionKey,
    tabs: createMemo(() => layout.tabs(effectiveSessionKey)),
    view: createMemo(() => layout.view(effectiveSessionKey)),
  }
}
