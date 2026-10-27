\version "2.24.0"
\score {
  \new PianoStaff <<
    \new Staff = "up" { \clef treble \key g \major \time 4/4 \tempo 4 = 92 \partial 4 g'4 | g'2 d'4 g' | a'2 d' | b'4 a' b' c'' | b'2 a'4 g' | g'2 fis'4 e' | fis'4 g' a' b' | fis'2 e'4. d'8 | d'1 | d''2 c''4 b' | c''2 b' | a'4 b' g' a' | fis'4. e'8 d'4 g' | g'4 fis' g' a' | g'2 d'4 b' | b'4 a' b' c'' | b'2 a'4 b' | c''4 b' a' g' | fis'2 g'4 c'' | b'2 a'4. g'8 | g'2. \bar "|." }
    \new Staff = "down" { \clef bass \key g \major \time 4/4 \partial 4 r4 | g,1 | d1 | g,1 | d2 g, | c1 | d1 | d1 | d1 | g,1 | c2 g, | d1 | d2. r4 | g,1 | g,1 | g,1 | d1 | c1 | d2 c | d1 | g,2. \bar "|." }
  >>
  \layout { }
}
