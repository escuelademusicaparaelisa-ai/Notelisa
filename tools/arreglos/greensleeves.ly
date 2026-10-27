\version "2.24.0"
\score {
  \new PianoStaff <<
    \new Staff = "up" { \clef treble \key a \minor \time 6/8 \tempo 4. = 54 \partial 8 a'8 | c''4 d''8 e''8. f''16 e''8 | d''4 b'8 g'8. a'16 b'8 | c''4 a'8 a'8. gis'16 a'8 | b'4 gis'8 e'4 a'8 | c''4 d''8 e''8. f''16 e''8 | d''4 b'8 g'8. a'16 b'8 | c''8. b'16 a'8 gis'8. fis'16 gis'8 | a'4. r4. | g''4. g''8. fis''16 e''8 | d''4 b'8 g'8. a'16 b'8 | c''4 a'8 a'8. gis'16 a'8 | b'4 gis'8 e'4. | g''4. g''8. fis''16 e''8 | d''4 b'8 g'8. a'16 b'8 | c''8. b'16 a'8 gis'8. fis'16 gis'8 | a'4. r4 \bar "|." }
    \new Staff = "down" { \clef bass \key a \minor \time 6/8 \partial 8 r8 | a,2. | g,2. | a,2. | e,2. | a,2. | g,2. | a,4. e,4. | a,2. | c2. | g,2. | a,2. | e,2. | c2. | g,2. | a,4. e,4. | a,4. r4 \bar "|." }
  >>
  \layout { }
}
