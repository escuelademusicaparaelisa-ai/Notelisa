\version "2.24.0"
\score {
  \new PianoStaff <<
    \new Staff = "up" { \clef treble \key g \major \time 3/4 \tempo 4 = 120 \partial 4 d'4 | g'4 g'8 a' g' fis' | e'4 e' e' | a'4 a'8 b' a' g' | fis'4 d' d' | b'4 b'8 c'' b' a' | g'4 e' d'8 d' | e'4 a' fis' | g'2 d'4 | g'4 g' g' | fis'2 fis'4 | g'4 fis' e' | d'2 a'4 | b'4 a' g' | d''4 d' d'8 d' | e'4 a' fis' | g'2 \bar "|." }
    \new Staff = "down" { \clef bass \key g \major \time 3/4 \partial 4 r4 | g,2. | c2. | a,2. | d2. | b,2. | c2. | d2. | g,2. | g,2. | d2. | e,2. | d2. | g,2. | c2. | d2. | g,2 \bar "|." }
  >>
  \layout { }
}
