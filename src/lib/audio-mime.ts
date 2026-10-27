/** Infer MIME from magic bytes so `<audio>` can decode DashScope output reliably. */
export function sniffAudioMime(data: ArrayBuffer): string {
  if (data.byteLength < 4) return 'audio/wav'
  const u8 = new Uint8Array(data, 0, Math.min(12, data.byteLength))
  if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46) return 'audio/wav'
  if (u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33) return 'audio/mpeg'
  if (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0) return 'audio/mpeg'
  return 'audio/wav'
}
