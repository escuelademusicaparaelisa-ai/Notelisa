// Prepares scanned or captured score images for optical music recognition.
import sharp from 'sharp'

/**
 * Turns an RGB(A) pixel buffer into grayscale using the brightest channel.
 * Coloured highlights (e.g. the blue cursor bands of practice apps) have one bright
 * channel and become near-white, while black ink stays black in every channel.
 */
export function dropColourHighlights(pixels, channels) {
  const out = Buffer.alloc(pixels.length / channels)
  for (let i = 0, o = 0; i < pixels.length; i += channels, o++) {
    out[o] = Math.max(pixels[i], pixels[i + 1], pixels[i + 2])
  }
  return out
}

/**
 * Cleans one page for OMR: removes colour highlights, scales small images up so
 * staff lines are thick enough (Audiveris wants about 300 dpi), and normalises contrast.
 */
export async function prepareForOmr(inputPath, outputPath, { minWidth = 2400 } = {}) {
  const image = sharp(inputPath).flatten({ background: '#ffffff' })
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true })
  const gray = dropColourHighlights(data, info.channels)
  const scale = info.width < minWidth ? minWidth / info.width : 1
  await sharp(gray, { raw: { width: info.width, height: info.height, channels: 1 } })
    .resize(Math.round(info.width * scale), Math.round(info.height * scale), { kernel: 'lanczos3' })
    .normalise()
    .png()
    .toFile(outputPath)
  return { width: Math.round(info.width * scale), height: Math.round(info.height * scale), scale }
}
