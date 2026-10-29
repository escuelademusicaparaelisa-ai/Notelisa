// Asking for a new piece from photos of a score. There is no recognition service
// yet: the teacher fills in the details and shares the photos (to the Claude chat,
// e-mail…), and the piece is transcribed and added to the school library.

export interface PhotoRequest {
  title: string
  composer: string
  /** 1 (easiest) to 5. */
  level: number
  instrument: 'piano' | 'flute'
  keepLyrics: boolean
  keepFingering: boolean
  notes: string
}

export const INSTRUMENT_NAMES: Record<PhotoRequest['instrument'], string> = { piano: 'piano', flute: 'flauta' }

/** The message sent with the photos, with everything needed to add the piece. */
export function requestText(request: PhotoRequest, photos: number): string {
  const lines = [
    `Nueva pieza para Notelisa (${photos === 1 ? '1 foto' : `${photos} fotos`})`,
    `Título: ${request.title.trim() || 'sin título'}`,
    request.composer.trim() && `Autor: ${request.composer.trim()}`,
    `Nivel: ${request.level}`,
    `Instrumento: ${INSTRUMENT_NAMES[request.instrument]}`,
    `Letra: ${request.keepLyrics ? 'mantener' : 'quitar'}`,
    `Digitación: ${request.keepFingering ? 'mantener' : 'quitar'}`,
    request.notes.trim() && `Notas: ${request.notes.trim()}`,
  ]
  return lines.filter(Boolean).join('\n')
}

/** "Canción de cuna" → "cancion-de-cuna-1.jpg". */
export function photoFileName(title: string, index: number): string {
  const slug = title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'partitura'
  return `${slug}-${index + 1}.jpg`
}

/** Longest side of the shared photo: enough to read every note, small enough to send quickly. */
const MAX_SIDE = 2400

/** Phone photos are several MB; this redraws one as a smaller JPEG. */
export async function shrinkPhoto(photo: Blob, name: string): Promise<File> {
  const bitmap = await createImageBitmap(photo)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  if (!blob) throw new Error('jpeg')
  return new File([blob], name, { type: 'image/jpeg' })
}

/**
 * Opens the phone's share menu with the photos and the details. Where files cannot
 * be shared (most computers), downloads the photos and copies the details instead.
 */
export async function sendPhotoRequest(request: PhotoRequest, photos: Blob[]): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const files = await Promise.all(photos.map((photo, i) => shrinkPhoto(photo, photoFileName(request.title, i))))
  const text = requestText(request, files.length)
  if (navigator.canShare?.({ files, text })) {
    try {
      await navigator.share({ files, text, title: request.title.trim() || 'Nueva pieza' })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // Some browsers refuse files with text: fall back to downloading.
    }
  }
  for (const file of files) {
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
  await navigator.clipboard?.writeText(text).catch(() => undefined)
  return 'downloaded'
}
