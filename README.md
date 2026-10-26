# Notelisa 🎹

App de práctica musical de la escuela de música **Para Elisa**. Los alumnos abren una
pieza, ven la partitura con un cursor que avanza y (en próximas fases) tocan con su
instrumento mientras la app les escucha y les corrige.

Funciona en el navegador de móvil, tablet y ordenador, y se puede "instalar" como una
app (PWA).

## Estado

| Fase | Contenido | Estado |
|------|-----------|--------|
| 1 | Esqueleto, biblioteca, partitura con cursor, escuchar la pieza | ✅ |
| 2 | Teclado MIDI + modo espera | Pendiente |
| 3 | Micrófono (una nota cada vez) + calibración | Pendiente |
| 4 | Importar MuseScore y PDF/imágenes (OMR) | Pendiente |
| 5 | Modo tempo, puntuación y resumen | Pendiente |
| 6 | Investigación de detección de acordes por micrófono | Pendiente |

## Instalar y ejecutar

Necesitas [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install        # una sola vez, descarga las librerías
npm run dev        # arranca la app en http://localhost:5173
```

Para abrirla desde la tablet en la misma wifi: `npm run dev -- --host` y abre en la tablet
la dirección "Network" que aparece (por ejemplo `http://192.168.1.20:5173`).

Otros comandos:

```bash
npm test           # ejecuta los tests
npm run build      # genera la versión final en la carpeta dist/
npm run preview    # sirve la versión final para probarla
```

## Cómo probar la fase 1

1. Abre la app: verás la **biblioteca** con una tarjeta por pieza.
2. Toca una pieza: aparece la partitura con una franja morada (el **cursor**) en la
   primera nota.
3. Usa ▶ y ◀ (o las flechas del teclado del ordenador) para mover el cursor nota a
   nota. Abajo a la izquierda se ve el compás y el nombre de las notas (Do, Re, Mi…);
   tócalo para oírlas.
4. Pulsa **🔊 Escuchar**: la app toca la pieza con sonido de piano y el cursor avanza.
5. Cambia la **velocidad** (40 %–120 %) o elige **Mano derecha / Mano izquierda** y
   vuelve a escuchar.
6. Con **−** y **+** cambias el tamaño de la partitura.

## Añadir partituras

El formato interno es **MusicXML** (`.musicxml`, `.xml` o `.mxl`).

- Piezas incluidas con la app: `public/library/demo/` y la lista `public/library/index.json`.
- Tus partituras: `public/library/local/` y la lista `public/library/index.local.json`.
  Esta carpeta **no se sube a GitHub** (está en `.gitignore`), para no publicar
  partituras por error.

Para convertir archivos de MuseScore (`.mscz`) e incluirlos en tu biblioteca, con
MuseScore instalado:

```bash
npm run import-scores -- "/ruta/a/mi/carpeta de partituras"
```

(La fase 4 mejorará este proceso y añadirá PDF e imágenes.)

## Estructura del código

```
src/
  core/
    music/      utilidades de notas (MIDI, nombres, frecuencias)
    score/      partitura → "pasos" (timeline) y control del cursor (OSMD)
    audio/      reproducción con Tone.js
    input/      capa común de entrada (MIDI y micrófono producen el mismo evento)
  instruments/  definición de cada instrumento (piano, flauta…)
  library/      catálogo de piezas
  ui/           pantallas y componentes React
scripts/        herramientas de línea de comandos (importación)
```

Para añadir un instrumento nuevo basta con crear su definición en `src/instruments/`.

## Créditos

- [OpenSheetMusicDisplay](https://opensheetmusicdisplay.org) (BSD-3) para dibujar la partitura.
- [Tone.js](https://tonejs.github.io) (MIT) para el sonido.
- Muestras de piano de [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) (CC BY 3.0).
