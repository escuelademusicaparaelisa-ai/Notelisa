\version "2.24.0"
\score {
  \new PianoStaff <<
    \new Staff = "up" { \clef treble \key c \major \time 3/4 \tempo 4 = 80 \partial 4 e'8 e' | g'4. e'8 e'4 | g'2 e'8 g' | c''4 b'4. a'8 | a'4 g' d'8 e' | f'4 d' d'8 e' | f'2 d'8 f' | b'8 a' g'4 b' | c''2 c'8 c' | c''2 a'8 f' | g'2 e'8 c' | f'4 g' a' | g'2 c'8 c' | c''2 a'8 f' | g'2 e'8 c' | f'4 e' d' | c'2 \bar "|." }
    \new Staff = "down" { \clef bass \key c \major \time 3/4 \partial 4 r4 | c2. | c2. | g,2. | g,2. | g,2. | g,2. | g,2. | c2. | f,2. | c2. | g,2. | c2. | f,2. | c2. | g,2. | c2 \bar "|." }
  >>
  \layout { }
}
