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
| 2 | Teclado MIDI + modo espera | ✅ |
| 3 | Micrófono (una nota cada vez) + calibración | ✅ |
| 4 | Importar MuseScore y PDF/imágenes (OMR) | ✅ herramienta y revisión · prueba con PDF pendiente |
| 5 | Modo tempo, metrónomo, puntuación y resumen | ✅ |
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

## Cómo probar la fase 2 (teclado MIDI y modo espera)

Usa **Chrome o Edge** en un ordenador o tablet Android (Safari en iPhone/iPad no admite
teclados MIDI; allí la app lo avisa y puedes usar el teclado de la pantalla).

1. Enchufa el teclado MIDI por USB **antes o después** de abrir la app, da igual.
2. Abre una pieza. Arriba elige **🎹 Paso a paso** (es el modo por defecto).
3. Pulsa **⚙️ Ajustes → Conectar teclado MIDI** y acepta el permiso del navegador.
   Aparece el nombre del teclado con un punto verde. Si lo desenchufas y lo vuelves a
   enchufar, se reconecta solo.
4. Pulsa **▶ Empezar**. Abajo se indica qué nota tocar y en el teclado de la pantalla
   se ilumina en morado.
5. Toca la nota: se pinta de **verde** en la partitura y el cursor avanza. Si fallas,
   se pinta de **rojo** y la app espera; cuando la aciertes quedará **naranja** (acertada
   después de fallar). En los acordes hay que tocar todas las notas (en cualquier orden).
6. Al final aparece el resumen con estrellas y los compases que más cuestan.

En **⚙️ Ajustes** también puedes:

- Elegir **Mano derecha / Mano izquierda / Todo**.
- Practicar solo **del compás X al Y** y marcar **Repetir en bucle**.
- Activar **Vale cualquier octava** (útil con teclados pequeños de 25 teclas como el
  AKAI MPK mini).
- Mostrar u ocultar el **teclado en pantalla** (se puede tocar con el dedo o el ratón).

El teclado MIDI suena a través de la app (los controladores como el MPK mini no tienen
sonido propio), así que sube el volumen del ordenador.

## Cómo probar la fase 5 (modo con tempo y resumen)

1. Abre una pieza y arriba elige **🎵 Con tempo**.
2. En **⚙️ Ajustes** elige la **Velocidad** (del 40% al 120% del tempo de la
   partitura) y, si quieres, activa el **Metrónomo** (también funciona en los otros
   modos).
3. Pulsa **▶ Empezar**: suena un compás de cuenta atrás (4, 3, 2, 1…) y la partitura
   avanza sola. Toca a la vez que el cursor:
   - **verde**: nota correcta y a tiempo (menos de 0,15 s de diferencia);
   - **naranja**: nota correcta pero un poco pronto o tarde (hasta 0,3 s);
   - **rojo**: nota que no se ha tocado a tiempo.
4. Al terminar sale el **resumen**: estrellas, % de notas correctas, % a tiempo y los
   tres compases que más cuestan. **🔁 Practicar compás N** abre ese compás en bucle en
   el modo paso a paso.

Con micrófono se descuenta el retraso medido en la calibración, así que conviene
calibrar antes de usar este modo.

## Cómo probar la fase 3 (micrófono)

Funciona en Chrome, Edge y Safari (también en iPhone y iPad). La app tiene que abrirse
en su propia dirección (no dentro de otra página) para poder usar el micrófono.

1. Coloca el móvil o la tablet en el atril, cerca del piano.
2. Abre una pieza, pulsa **⚙️ Ajustes → 🎤 Usar micrófono** y acepta el permiso.
3. La primera vez se abre la **calibración** (unos 30 segundos):
   1. silencio, para medir el ruido de la sala;
   2. una nota fuerte, para comprobar que el piano se oye bien;
   3. un La, para saber si el piano está afinado a 440 o a otra frecuencia (se puede saltar);
   4. unos clics por el altavoz, para medir el retraso del micrófono (se puede saltar).
   Se guarda en el dispositivo; con **Calibrar de nuevo** se repite.
4. Pulsa **▶ Empezar** y toca. La barra junto a Ajustes muestra el volumen que oye la
   app y la nota que detecta. La rayita de la barra es el volumen mínimo: por debajo,
   la app no hace caso (ruido).

Qué hay que saber:

- El micrófono reconoce **una nota cada vez**. Si la partitura tiene un acorde, basta con
  la nota más aguda. Lo ideal es practicar **con una mano** (Ajustes → Qué tocar).
  Los acordes llegarán en la fase 6.
- Una nota que sigue sonando (pedal o tecla mantenida) **no** cuenta como nueva; volver a
  tocar la misma tecla sí.
- Con micrófono a veces la app confunde la octava. Si pasa, activa **Vale cualquier octava**.
- La app no hace sonar las notas que oye por el micrófono (ya suena tu piano).

## Abrir una partitura del dispositivo

En la biblioteca, **📂 Abrir partitura del dispositivo** carga un archivo MusicXML
(`.musicxml`, `.xml` o `.mxl`) desde el ordenador o la tablet sin subirlo a ningún sitio.
En MuseScore se exporta con *Archivo → Exportar → MusicXML*.

## Añadir partituras (fase 4: importación)

El formato interno es **MusicXML** (`.musicxml`, `.xml` o `.mxl`).

- Piezas incluidas con la app: `public/library/demo/` y la lista `public/library/index.json`.
- Tus partituras: `public/library/local/` y la lista `public/library/index.local.json`.
  Esta carpeta **no se sube a GitHub** (está en `.gitignore`), para no publicar
  partituras por error.

### Programas necesarios en tu ordenador

| Para importar… | Necesitas |
|---|---|
| MusicXML | nada más |
| MuseScore (`.mscz`) | [MuseScore](https://musescore.org) 4 |
| PDF y fotos | [Audiveris](https://audiveris.github.io/audiveris/) (reconocimiento óptico, necesita Java) y, para PDF, Poppler (`pdftoppm`) |

Si un programa no está en la ruta habitual, indica dónde está:
`MSCORE=/ruta/a/mscore`, `AUDIVERIS=/ruta/a/Audiveris`, `PDFTOPPM=/ruta/a/pdftoppm`.

### Importar

```bash
npm run importar -- "/ruta/a/mi carpeta de partituras"
npm run importar -- cancion.pdf --titulo "Canciones de Navidad"
```

- **MusicXML** se copia; **MuseScore** se convierte con MuseScore. Entran directamente en
  la biblioteca.
- **PDF y fotos** pasan por estos pasos:
  1. Cada página del PDF se convierte en imagen a 300 ppp.
  2. Se **limpia**: se quitan los colores (por ejemplo, las franjas azules del cursor de
     otras apps), se pasa a escala de grises y, si es pequeña, se amplía.
  3. Audiveris la reconoce y produce MusicXML.
  4. La pieza queda **pendiente de revisar** y no la ven los alumnos.

El reconocimiento óptico **siempre comete errores**, por eso existe la revisión.

### Revisar las piezas reconocidas

1. Arranca la app en tu ordenador con `npm run dev`.
2. En la biblioteca pulsa **📝 Revisar importaciones**.
3. Verás la partitura **original** a la izquierda y la **reconocida** a la derecha.
   Pulsa **🔊 Escuchar lo reconocido** para detectar notas equivocadas de oído.
4. Según lo que veas:
   - **✅ Aprobar**: pasa a la biblioteca.
   - **⬇️ Descargar para MuseScore**: ábrela en MuseScore, corrige los errores y guarda.
     Después pulsa **🔁 Subir versión corregida** y elige el archivo (`.mscz` o MusicXML):
     sustituye a la reconocida y queda aprobada.
   - **🗑️ Descartar**.

Las decisiones se guardan en `public/library/index.local.json`, por eso la revisión solo
funciona con la app abierta con `npm run dev` en tu ordenador.

## Biblioteca de la escuela (con clave)

Las canciones propias de la escuela se publican **cifradas** en
`public/library/school/`: quien descargue esos archivos solo ve datos sin sentido.
La primera vez que un alumno abre Notelisa, escribe la clave de la escuela y le
aparecen todas las canciones; el dispositivo la recuerda (da igual mayúsculas o
minúsculas). Con **🔒 Cerrar biblioteca de la escuela** se olvida la clave en ese
dispositivo.

Para publicar o actualizar la biblioteca (después de importar canciones nuevas):

```bash
npm run biblioteca-escuela -- --clave "la clave de la escuela"
```

Cifra todas las piezas aprobadas de tu biblioteca local y deja el resultado en
`public/library/school/`, listo para subir a GitHub. Con la misma clave, los alumnos
ven las canciones nuevas sin volver a escribirla. Si cambias la clave (o añades
`--nueva-llave`), la anterior deja de funcionar y tendrán que escribir la nueva.
La clave **no** se guarda en el repositorio.

## Actualizar la biblioteca desde una carpeta (con hoja de datos)

La forma habitual de mantener la biblioteca: deja todas las partituras (MuseScore o
MusicXML) en una carpeta y ejecuta

```bash
npm run actualizar-biblioteca -- <carpeta> --clave "la clave de la escuela"
```

En esa carpeta se crea (o actualiza) la hoja **datos-partituras.xlsx**, con una fila
por archivo: **Título, Compositor, Arreglista, Instrumento** (Piano o Flauta),
**Nivel** (1 a 5) y **Publicar** (sí/no). Lo que escribas en la hoja manda: el título,
el compositor y el arreglista se escriben también dentro de la partitura, y el
instrumento decide en qué botón (🎹 Piano / 🪈 Flauta) aparece. Las partituras nuevas
se añaden a la hoja solas, y las que borres de la carpeta desaparecen de la biblioteca.

Las filas cuyo archivo empieza por `libre/` son las partituras libres que trae la app
(`public/library/libre/`). No hace falta tenerlas en la carpeta: se quedan en la hoja y
de ellas solo se usa el **Nivel**, que se aplica a `public/library/index.json` al ejecutar
el comando (luego hay que subir ese cambio a GitHub como el resto).

## Ejercicios y escalas

En la pantalla de inicio, **🎯 Ejercicios y escalas** crea ejercicios nuevos al momento:

- **Tipo:** lectura (una melodía al azar) o escala (sube y baja).
- **Tonalidad:** las 15 mayores y las 15 menores; para las menores se elige natural, armónica o melódica (la melódica sube con 6.º y 7.º alterados y baja como la natural).
- **Instrumento, clave** (sol, fa o dos pentagramas) y **compás** (2/4, 3/4, 4/4, 6/8).
- **Figuras:** 1 redondas y blancas, 2 + negras, 3 + corcheas, 4 + puntillos y semicorcheas.
- **Silencios**, **notas** (5 notas, una octava o con saltos) y **compases** (4, 8 o 12).

Con dos pentagramas la mano izquierda toca una nota larga por compás (I, IV, V, I). Cada ejercicio se practica como cualquier pieza (paso a paso, con tempo, escuchar) y **🔄 Otro ejercicio** crea uno nuevo con las mismas opciones. Las opciones se recuerdan en el dispositivo. El generador está en `src/core/exercises/generator.ts`.

## Estructura del código

```
src/
  core/
    music/      utilidades de notas (MIDI, nombres, frecuencias)
    score/      partitura → "pasos" (timeline) y control del cursor (OSMD)
    audio/      reproducción con Tone.js y metrónomo
    input/      capa común de entrada: MIDI, teclado en pantalla y micrófono publican
                el mismo tipo de evento en un "bus" de notas
      mic/      micrófono: análisis de tono (pitchy), detector de notas y calibración
    practice/   lógica de práctica (comparar notas, modo espera, modo tempo, resumen) con tests
    exercises/  generador de ejercicios de lectura y escalas (MusicXML)
  instruments/  definición de cada instrumento (piano, flauta…)
  library/      catálogo de piezas
  ui/           pantallas y componentes React
tools/importer/ importación de partituras (MuseScore, Audiveris) y revisión
```

Para añadir un instrumento nuevo basta con crear su definición en `src/instruments/`.

## Partituras libres

La biblioteca incluye 40 piezas de piano de dominio público para todos los alumnos (sin clave), del
nivel ★ al ★★★★★: 12 arreglos sencillos de canciones populares y villancicos (Martinillo, Adeste
fideles, Greensleeves…) y 28 obras del Mutopia Project (minuetos del cuaderno de Anna Magdalena
Bach, Mozart, Schumann, Burgmüller, Clementi, Chaikovski, Para Elisa, Chopin, Satie, Bach, Grieg y
Kuhlau). Están en
`public/library/libre/` (MusicXML comprimido, `.mxl`) y en `public/library/index.json` con ids
`libre-…`. La fuente, el editor y la licencia de cada una están en
[`public/library/libre/FUENTES.md`](public/library/libre/FUENTES.md); para añadir más, ver
`tools/mutopia/`. Los arreglos de Notelisa están en `tools/arreglos/`.

## Créditos

- [OpenSheetMusicDisplay](https://opensheetmusicdisplay.org) (BSD-3) para dibujar la partitura.
- [Tone.js](https://tonejs.github.io) (MIT) para el sonido.
- Muestras de piano de [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) (CC BY 3.0).
- Partituras libres del [Mutopia Project](https://www.mutopiaproject.org) (dominio público y CC BY-SA 2.5; detalle en `public/library/libre/FUENTES.md`).
