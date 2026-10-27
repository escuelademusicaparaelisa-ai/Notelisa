\version "2.24.0"
\score {
  \new PianoStaff <<
    \new Staff = "up" { \clef treble \key c \major \time 4/4 \tempo 4 = 112  g'4. f'8 e'4 d' | c' d' e' c' | d'8 e' f' d' e'4. d'8 | c'4 b c'2 | g'4. f'8 e'4 d' | c' d' e' c' | d'8 e' f' d' e'4. d'8 | c'4 b c'2 | d'4. e'8 f'4 d' | e'4. f'8 g'4 d' | e'8 f' g'4 a'8 b' c''4 | b'4 a' g'2 | g'4. f'8 e'4 d' | c' d' e' c' | a'8 a' a' a' g'4. f'8 | e'4 d' c'2 \bar "|." }
    \new Staff = "down" { \clef bass \key c \major \time 4/4  c1 | c1 | g,1 | g,2 c | c1 | c1 | g,1 | g,2 c | g,1 | c1 | c2 d | g,1 | c1 | c1 | f1 | g,2 c \bar "|." }
  >>
  \layout { }
}
