# Partituras del Mutopia Project → MusicXML

Herramientas usadas para convertir las piezas de `public/library/libre/` (ver `FUENTES.md` allí).
El [Mutopia Project](https://www.mutopiaproject.org) publica sus partituras en LilyPond; LilyPond
no exporta MusicXML, así que `nl-dump.ly` hace que LilyPond escriba cada nota, compás, armadura,
clave, repetición y matiz que interpreta, y `build_xml.py` rehace la partitura en MusicXML con esos datos.

Necesita Python 3 con `pip install lilypond music21` (el paquete `lilypond` trae LilyPond).

```bash
# 1. Pasar el archivo .ly de Mutopia a la versión actual de LilyPond (en una copia)
convert-ly -e copia.ly
# 2. Volcar los eventos (carpeta de nl-dump.ly en -I)
printf '\\include "nl-dump.ly"\n\\include "copia.ly"\n' > envoltorio.ly
NL_OUT=eventos.txt lilypond -dno-print-pages -I tools/mutopia envoltorio.ly
# 3. Crear el MusicXML (--score 2 para el 2.º movimiento si el archivo tiene varios)
python tools/mutopia/build_xml.py eventos.txt pieza.musicxml --title "Título" --composer "Compositor" \
  --tempo 4=100 --rights "Licencia y crédito del editor"
```

Antes de publicar una pieza: comprueba la licencia en la cabecera del `.ly` (`license` o
`copyright`), ábrela con **📂 Abrir partitura del dispositivo** y revísala, y añádela a
`public/library/index.json` y a `FUENTES.md`.
