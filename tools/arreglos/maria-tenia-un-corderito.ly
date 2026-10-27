\version "2.24.0"
\score {
  \new PianoStaff <<
    \new Staff = "up" { \clef treble \key c \major \time 4/4 \tempo 4 = 100  e'4 d' c' d' | e' e' e'2 | d'4 d' d'2 | e'4 g' g'2 | e'4 d' c' d' | e' e' e' e' | d' d' e' d' | c'1 \bar "|." }
    \new Staff = "down" { \clef bass \key c \major \time 4/4  c1 | c1 | g,1 | c1 | c1 | c1 | g,1 | c1 \bar "|." }
  >>
  \layout { }
}
