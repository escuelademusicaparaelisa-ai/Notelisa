import { describe, expect, it } from 'vitest'
import { applyMetadata, readMetadata } from './scoreMetadata.mjs'

const museScoreExport = `<?xml version="1.0"?>
<score-partwise version="3.1">
  <work>
    <work-title>Title</work-title>
  </work>
  <identification>
    <creator type="composer">Composer</creator>
    <encoding><software>MuseScore 3.2</software></encoding>
  </identification>
  <defaults></defaults>
  <credit page="1">
    <credit-type>title</credit-type>
    <credit-words>Title</credit-words>
  </credit>
  <part-list></part-list>
</score-partwise>`

describe('score metadata', () => {
  it('ignores MuseScore placeholders', () => {
    expect(readMetadata(museScoreExport)).toEqual({ title: undefined, composer: undefined, arranger: undefined })
  })

  it('writes title, composer and arranger in schema order', () => {
    const xml = applyMetadata(museScoreExport, { title: 'Secreto & eterno', composer: 'Popular', arranger: 'M. Dols' })
    expect(readMetadata(xml)).toEqual({ title: 'Secreto & eterno', composer: 'Popular', arranger: 'M. Dols' })
    expect(xml).not.toContain('<credit')
    expect(xml).toContain('Arr. M. Dols')
    expect(xml).not.toContain('<work>')
    expect(xml.indexOf('<movement-title>')).toBeLessThan(xml.indexOf('<identification>'))
  })

  it('adds an identification block when there is none', () => {
    const xml = applyMetadata('<score-partwise version="3.1">\n  <part-list></part-list>\n</score-partwise>', { title: 'A', composer: 'B' })
    expect(readMetadata(xml)).toMatchObject({ title: 'A', composer: 'B' })
  })
})
