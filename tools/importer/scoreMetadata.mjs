// Reads and rewrites the title, composer and arranger written inside a MusicXML file.

const PLACEHOLDERS = new Set(['title', 'subtitle', 'composer', 'arranger', 'lyricist', 'untitled score', 'título', 'compositor'])

function decode(text) {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim()
}

function encode(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function useful(text) {
  return text && !PLACEHOLDERS.has(text.toLowerCase()) ? text : undefined
}

function first(xml, pattern) {
  const match = xml.match(pattern)
  return match ? useful(decode(match[1])) : undefined
}

/** Title, composer and arranger found in the score (MuseScore placeholders such as "Title" are ignored). */
export function readMetadata(xml) {
  return {
    title: first(xml, /<movement-title>([^<]*)<\/movement-title>/) ?? first(xml, /<work-title>([^<]*)<\/work-title>/)
      ?? first(xml, /<credit-type>title<\/credit-type>[\s\S]*?<credit-words[^>]*>([^<]*)</),
    composer: first(xml, /<creator type="composer">([^<]*)<\/creator>/),
    arranger: first(xml, /<creator type="arranger">([^<]*)<\/creator>/),
  }
}

/**
 * Writes title, composer and arranger into the score so they are drawn above it.
 * Page texts exported by MuseScore (credits, often a "Title" placeholder) are removed.
 */
export function applyMetadata(xml, { title, composer, arranger }) {
  let out = xml
    .replace(/\s*<work>[\s\S]*?<\/work>/, '')
    .replace(/\s*<movement-title>[\s\S]*?<\/movement-title>/, '')
    .replace(/\s*<credit[\s>][\s\S]*?<\/credit>/g, '')
    .replace(/\s*<creator type="(composer|arranger|lyricist)">[\s\S]*?<\/creator>/g, '')

  const creators = [
    composer && `    <creator type="composer">${encode(composer)}</creator>`,
    // Drawn on the left, where lyricists usually go.
    arranger && `    <creator type="lyricist">${encode(`Arr. ${arranger}`)}</creator>`,
    arranger && `    <creator type="arranger">${encode(arranger)}</creator>`,
  ].filter(Boolean).join('\n')

  if (/<identification>/.test(out)) {
    if (creators) out = out.replace(/<identification>/, `<identification>\n${creators}`)
  } else if (creators) {
    out = out.replace(/(<score-partwise[^>]*>)/, `$1\n  <identification>\n${creators}\n  </identification>`)
  }
  if (title) {
    // Only the movement title: OSMD draws a work title as a subtitle.
    out = out.replace(/(<score-partwise[^>]*>)/, `$1\n  <movement-title>${encode(title)}</movement-title>`)
  }
  return out
}
