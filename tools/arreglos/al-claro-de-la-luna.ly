\version "2.24.0"
\score {
  \new PianoStaff <<
    \new Staff = "up" { \clef treble \key c \major \time 4/4 \tempo 4 = 96  c'4 c' c' d' | e'2 d' | c'4 e' d' d' | c'1 | c'4 c' c' d' | e'2 d' | c'4 e' d' d' | c'1 | d'4 d' d' d' | a2 a | d'4 c' b a | g1 | c'4 c' c' d' | e'2 d' | c'4 e' d' d' | c'1 \bar "|." }
    \new Staff = "down" { \clef bass \key c \major \time 4/4  c1 | c2 g, | c2 g, | c1 | c1 | c2 g, | c2 g, | c1 | g,1 | d1 | g,1 | g,1 | c1 | c2 g, | c2 g, | c1 \bar "|." }
  >>
  \layout { }
}
