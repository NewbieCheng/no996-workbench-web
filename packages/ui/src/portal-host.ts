export const WB_PORTAL_HOST_ID = 'wb-portal-host'

/** Portals into the workbench zoom surface so menus share the same CSS zoom context as triggers. */
export function getWorkbenchPortalContainer(): HTMLElement | undefined {
  if (typeof document === 'undefined') return undefined
  return document.getElementById(WB_PORTAL_HOST_ID) ?? undefined
}
