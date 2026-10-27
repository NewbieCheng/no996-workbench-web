const PERSIST_IMAGES_KEY = 'no996-material-persist-images'

export function readMaterialPersistImages(): boolean {
  try {
    return localStorage.getItem(PERSIST_IMAGES_KEY) === '1'
  } catch {
    return false
  }
}

export function writeMaterialPersistImages(enabled: boolean): void {
  try {
    localStorage.setItem(PERSIST_IMAGES_KEY, enabled ? '1' : '0')
  } catch {
    // ignore
  }
}
