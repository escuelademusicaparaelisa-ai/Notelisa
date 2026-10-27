/** True when the app runs inside another page, where browsers block MIDI and the microphone. */
export function isEmbedded(): boolean {
  try {
    return window.self !== window.top
  } catch {
    // Reading window.top from a cross-origin frame throws: we are embedded.
    return true
  }
}
