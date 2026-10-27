export const CAPTURE_SETTINGS_FIELD_CLASS = 'wb-capture-settings-field'
export const CAPTURE_SETTINGS_LABEL_CLASS = 'wb-capture-settings-label'
export const CAPTURE_SETTINGS_TRIGGER_CLASS = 'wb-capture-settings-trigger w-full min-w-0 bg-background'
export const CAPTURE_SETTINGS_LIMIT_FIELD_CLASS = `${CAPTURE_SETTINGS_FIELD_CLASS} wb-capture-settings-field--limit`

export function optionLabel<T extends { value: string; label: string }>(
  options: readonly T[],
  value: string,
): string {
  return options.find((o) => o.value === value)?.label ?? value
}
