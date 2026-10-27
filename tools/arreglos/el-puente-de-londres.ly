\version "2.24.0"
\score {
  \new PianoStaff <<
    \new Staff = "up" { \clef treble \key c \major \time 4/4 \tempo 4 = 100  g'4. a'8 g'4 f' | e' f' g'2 | d'4 e' f'2 | e'4 f' g'2 | g'4. a'8 g'4 f' | e' f' g'2 | d'2 g' | e'4 c'2 r4 \bar "|." }
    \new Staff = "down" { \clef bass \key c \major \time 4/4  c1 | c1 | g,1 | c1 | c1 | c1 | g,1 | c2. r4 \bar "|." }
  >>
  \layout { }
}
