const COMPONENT_CATALOG_ACCESS_KEY = 'no996_component_catalog_access'

export function grantComponentCatalogAccess(): void {
  try {
    window.sessionStorage.setItem(COMPONENT_CATALOG_ACCESS_KEY, '1')
  } catch {
    // Browser storage may be unavailable in private or restricted contexts.
  }
}

export function hasComponentCatalogAccess(): boolean {
  try {
    return window.sessionStorage.getItem(COMPONENT_CATALOG_ACCESS_KEY) === '1'
  } catch {
    return false
  }
}

export function clearComponentCatalogAccess(): void {
  try {
    window.sessionStorage.removeItem(COMPONENT_CATALOG_ACCESS_KEY)
  } catch {
    // Nothing to clear when browser storage is unavailable.
  }
}
