\version "2.24.0"
\score {
  \new PianoStaff <<
    \new Staff = "up" { \clef treble \key g \major \time 3/4 \tempo 4 = 92 \partial 4 d'4 | g'8. g'16 g'4. a'8 | b'8. b'16 b'4. b'8 | a'8 b' c''4 fis' | a'4 g' d''8 b' | e''4. d''8 d'' c'' | c''4. c''8 c'' a' | d''4. c''8 c'' b' | b'4 r d' | g'8. g'16 g'4. a'8 | b'8. b'16 b'4. b'8 | a'8 b' c''4 fis' | a'4 g' \bar "|." }
    \new Staff = "down" { \clef bass \key g \major \time 3/4 \partial 4 r4 | g,2. | g,2. | d2. | g,2. | c2. | d2. | g,2. | g,2. | g,2. | g,2. | d2. | g,2 \bar "|." }
  >>
  \layout { }
}
