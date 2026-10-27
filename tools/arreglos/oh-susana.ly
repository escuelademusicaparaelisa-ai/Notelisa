\version "2.24.0"
\score {
  \new PianoStaff <<
    \new Staff = "up" { \clef treble \key c \major \time 4/4 \tempo 4 = 112 \partial 4 c'8 d' | e'4 g' g'4. a'8 | g'4 e' c'4. d'8 | e'4 e' d' c' | d'2. c'8 d' | e'4 g' g'4. a'8 | g'4 e' c'4. d'8 | e'4 e' d' d' | c'2. r4 | f'2 f' | a'4 a'2 a'4 | g'4 g' e' c' | d'2. c'8 d' | e'4 g' g'4. a'8 | g'4 e' c'4. d'8 | e'4 e' d' d' | c'2. \bar "|." }
    \new Staff = "down" { \clef bass \key c \major \time 4/4 \partial 4 r4 | c1 | c1 | c1 | g,1 | c1 | c1 | g,1 | c1 | f1 | f1 | c1 | g,1 | c1 | c1 | g,1 | c2. \bar "|." }
  >>
  \layout { }
}
