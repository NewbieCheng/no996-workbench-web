/** Portrait 6, cover 3:4 in between, landscape/square 9. */
export function contentShotLineBudget(width: number, height: number): { titleCols: number; subCols: number } {
  const ratio = height / Math.max(1, width)
  if (ratio >= 1.6) return { titleCols: 6, subCols: 12 }
  if (ratio > 1.05) return { titleCols: 7, subCols: 14 }
  return { titleCols: 9, subCols: 18 }
}
