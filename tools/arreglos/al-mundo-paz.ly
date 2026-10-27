\version "2.24.0"
\score {
  \new PianoStaff <<
    \new Staff = "up" { \clef treble \key c \major \time 2/4 \tempo 4 = 92  c''4 b'8. a'16 | g'4. f'8 | e'4 d' | c'4. g'8 | a'4. a'8 | b'4. b'8 | c''4. c''8 | c''8 b' a' g' | g'8. f'16 e'8 c'' | c''8 b' a' g' | g'8. f'16 e'8 e' | e'8 e' e' e'16 f' | g'4. f'16 e' | d'8 d' d' d'16 e' | f'4. e'16 d' | c'8 c''4 a'8 | g'8. f'16 e'8 f' | e'4 d' | c'2 \bar "|." }
    \new Staff = "down" { \clef bass \key c \major \time 2/4  c2 | c2 | g,2 | c2 | f,2 | g,2 | c2 | c2 | c2 | c2 | c2 | c2 | c2 | g,2 | g,2 | c4 f, | c2 | g,2 | c2 \bar "|." }
  >>
  \layout { }
}
