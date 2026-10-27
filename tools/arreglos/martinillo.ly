\version "2.24.0"
\score {
  \new PianoStaff <<
    \new Staff = "up" { \clef treble \key c \major \time 4/4 \tempo 4 = 100  c'4 d' e' c' | c' d' e' c' | e' f' g'2 | e'4 f' g'2 | g'8 a' g' f' e'4 c' | g'8 a' g' f' e'4 c' | c' g c'2 | c'4 g c'2 \bar "|." }
    \new Staff = "down" { \clef bass \key c \major \time 4/4  c2 g, | c g, | c g, | c g, | c g, | c g, | c g, | c1 \bar "|." }
  >>
  \layout { }
}
