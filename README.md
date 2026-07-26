# MAESTRO

**A concert hall made of dots.** A streaming application for an invented
classical repertoire, in which nothing is a media file: the artwork is a
photograph screened into halftone dots on a canvas, and every note you hear is
composed and synthesised in your browser at the moment you press play.

Static HTML, CSS and ES modules. No build step, no framework, no runtime
dependencies, no network requests after first load.

```
python3 -m http.server 8000    # or any static server
open http://localhost:8000
```

---

## Two rooms

The site is in two parts, and the order matters.

**`/` is the prelude** — a piece in thirteen short movements, made of the only
two things this project is built from: a point and a line. One population of
5,200 points carries the whole sequence. It arrives as a conductor's hands, is
drawn out into a Lissajous figure of a perfect fifth, and then becomes each
plate in turn — a child answering himself in a mirror, two animals cheek to
cheek, a held look, a figure alone with a lamp, a face under water, a fish that
is nothing but a line, a flower that opens at night, three blooms held in a
fist, two people running through weather — and finally the hands again, holding
the door.

Nothing sounds here and nothing is a control except the way in. The same points
travel from one picture to the next; no image ever fades in or out.

**`/#/hall` is the application.** The catalogue, the transport, the concert
view: everything that plays. It is reached through the last movement of the
prelude, or by the *skip* link, and once you are inside the prelude is taken
down completely — its canvas stops, and the hall's begin.

The movement between the two rooms is not a page transition. It is the point of
the piece: the streaming application is a *function*, and the prelude is what
the function is for.

## The idea

The project starts from two photographs of a conductor's hands: black frame,
one hard light, a bright shirt cuff, a baton catching the highlight.

Those photographs are the artwork. They are not redrawn or illustrated — they
are put through a **halftone screen**: sampled on a rotated lattice, with a
round dot at every lattice point whose radius follows the local brightness.
Highlights become fat dots that just touch; shadows thin to nothing; the black
falls away completely. One ink, one paper, the whole tonal range carried by dot
size.

Everything else in the interface follows from that.

It is a fine screen, not a coarse one. The whole interface follows the same
discipline — points and hairlines, nothing thick.

- **Bone-white on void black**, with a single warm gold for the baton and for
  whatever is currently sounding. Nothing else is coloured.
- **Everything is dots or hairlines.** The display face is a 5×7 bitmap drawn as
  round dots rather than square pixels; generated sleeves go through the same
  halftone screen as the photographs; the spectrum, the piano roll, the beat
  lamps, the seek markers and the slider handles are all points.
- **The chrome recedes.** Icons are hairline geometry, panels are outlined
  rather than filled, corners are square, and the grid is 4px throughout. The
  only solid mass in the interface is the play button.
- **The dots move.** The screen is re-laid every frame, so the photograph
  breathes with the music.

## What is actually happening

Three claims the application makes about itself, all of which are literally
true:

**The picture is the photograph, screened.** `pixel/halftone.js` samples the
source once into a luminance field and then re-lays a dot screen over it on
every frame with a different dot gain. The ictus of each beat swells the dots —
hardest on the downbeat, decaying across the beat — so the image pulses in the
piece's real metre. The measured signal level and the section's planned
intensity set the resting dot size, so quiet passages thin out and tuttis bloom,
and a slow ripple travels across the screen once per bar.

**The music is composed, not sampled.** Each track is a specification — a seed,
a style, a key, a tempo. `audio/composer.js` turns that into a complete score:
one rhythmic and melodic cell developed by sequence, inversion, augmentation and
fragmentation, over a functional chord progression that cadences properly, in a
planned form (introduction, theme, restatement, development, recapitulation,
coda). The whole score is materialised up front, which is why seeking is exact
and why the runtimes in list views are the real runtimes.

**The sound is synthesised, not streamed.** `audio/instruments.js` builds eleven
voices out of oscillators, filters and noise: bowed strings with a vibrato that
eases in and a whisper of bow noise under the attack; a Karplus–Strong plucked
string, rendered offline into an AudioBuffer and memoised per pitch (Web Audio
clamps feedback delay loops to one render quantum, which would otherwise cap the
pitch around F4); FM bells; a formant chorus; timpani with a pitch drop. The
hall is a convolution reverb whose impulse response is generated at start-up
from decaying noise with a handful of early reflections.

## The opening

The hall page is staged rather than laid out. Nothing is present when it loads;
a cue sheet releases the elements one at a time over about two seconds, in the
order the eye should travel — greeting, title, sentence, photograph, the record
being offered.

Three things move, and only three:

- **The photograph assembles.** The halftone screen takes a `reveal` parameter:
  a sweep crosses the frame on a diagonal and each dot grows from nothing as it
  is reached, with a little deterministic grain on the leading edge so it reads
  as an exposure rather than a wipe.
- **The title is set, column by column.** The bitmap face takes the same
  parameter, so a heading arrives one dot column at a time.
- **A line drifts.** Three hairlines cross the marquee — the only curved,
  continuous thing in the interface. Idle, they are layered sines at periods
  that never coincide. Once a score is playing, the front line stops
  improvising and traces the melody's actual pitch contour, scrolling under the
  playhead. They are masked away behind the copy so they never compete with it.

Below the fold, blocks arrive as they are scrolled to: a few pixels up, a slow
resolve, staggered across a grid. Nothing bounces, nothing scales, nothing
overshoots. `prefers-reduced-motion` removes all of it and simply shows the
page.

## Architecture

```
index.html            shell markup: prelude host, boot curtain, app grid
assets/reference/     the two conductor photographs
assets/plates/        the plates the prelude's points become
css/
  tokens.css          the entire design system as custom properties
  base.css            reset, typography primitives, utilities
  layout.css          app shell grid and its responsive collapse order
  components.css      buttons, cards, track table, sliders, empty states
  views.css           boot, transport, now-playing, concert hall, overlays
  prelude.css         the front of the house: stage, movements, rail
  motion.css          entrances, the cue sheet, reduced-motion opt-outs
js/
  core/               store, router, event bus, DOM layer, storage, utils
  art/                points.js  — plate sampling and the point field
                      curves.js  — Lissajous figures of musical intervals
  pixel/              halftone screen, photo sleeves, bitmap font,
                      dithering, PixelSurface, generated cover motifs
  audio/              engine, instruments, theory, composer, transport
  data/catalog.js     the repertoire
  ui/                 shell, transport bar, now-playing, concert, overlays,
                      conductor, visualiser, melody line, entrances, icons,
                      slider, a11y
  views/              prelude, home, album/artist/playlist/queue,
                      search/library
  state.js            one store, one shape, all the actions
  player.js           queue, score cache, playhead broadcast, media session
  app.js              bootstrap, routes, key map, prelude/hall staging
dev/
  test.mjs            unit suite for every DOM-free layer
  shot.mjs            Playwright visual-QA harness
  film.mjs            films the piece on a virtual clock, straight to H.264
  halftone-lab.html   dot pitch, screen angle, tonal response
  art-lab.html        the bitmap face and the generated sleeve motifs
```

### How a plate is made

`art/points.js` turns a photograph into a *constellation*: a list of positions
and weights the point field can be told to become.

The plate is **placed** in the frame rather than stretched across it — it keeps
the photograph's own proportions, takes a given fraction of the frame's height,
and stands in one half of the screen while the writing takes the other. A wide
monitor therefore crops nothing; it just leaves the plate standing in a larger
darkness. The weight is feathered away at the border, so a plate dissolves
instead of ending in a rectangle.

Candidates are taken on the same rotated lattice as the halftone screen, but the
lattice is anchored to the centre of the *frame*, never the plate, so successive
movements land on one grid and the points slide between pictures rather than
re-forming. Four readings decide what a cell is worth:

| mode | weight is | for |
| --- | --- | --- |
| `tone` | brightness | a subject lit out of a black ground |
| `shadow` | darkness | a dark subject on a pale one — a fish, a brow, hair |
| `edge` | gradient magnitude | when only the contour survives |
| `relief` | departure from the picture's commonest tone, normalised separately above and below it | a pale animal and a dark one on the same wall |

Points the plate cannot use are not stacked on cells that are already lit. They
are let go, and hang in the dark around the picture as dust.

### Motion as material

The prelude does not animate *between* states; the animation is the state.

When a movement is called for, the whole field is first given a **tangential
impulse** about the centre — every point leaves on a curve, the way a hand
leaves a downbeat — and the direction alternates from movement to movement, so
the piece beats one way and then the other.

While the field is travelling the canvas is not wiped, only **washed**: each
frame lays down a nearly-transparent black, so every point leaves the trace of
its own path. For those two seconds the picture is made of lines. As it arrives
the wash returns to opaque and the lines close up into points again. A held
picture then keeps turning by a fraction of a degree and breathing by a fraction
of a percent, on two periods that do not divide into one another.

`prefers-reduced-motion` removes the impulse, the wash and the breath; the
plates simply appear.

### Two kinds of artwork

The records whose subject is the conductor use the photograph, screened
(`pixel/photo.js`), each at a different dot pitch and crop so the sleeves are
distinguishable at thumbnail size. Everything else in the catalogue gets a
generated motif (`pixel/art.js`) — a small greyscale scene drawn with ordinary
canvas calls, then put through the *same* halftone screen, inked in one colour
drawn from the record's palette. The dot pitch scales with the display size, so
a 96px thumbnail is not a solid mass and a 384px sleeve is not a grey mist.

### State

One `Store` holding one flat object. Anything that survives a reload is mirrored
into `localStorage` by an action; anything per-frame — the playhead, the
spectrum, beat events — travels on the event bus instead, so the store never
churns at 60 Hz. Components subscribe to narrow selectors and dispose themselves
when they leave the DOM, so a hundred-row track list costs a hundred small
subscriptions rather than a re-render.

### Performance notes

- The halftone samples its source once per resize, never per frame; a redraw is
  just arcs on a pre-computed luminance field.
- Scores are composed lazily and memoised; the composer is deterministic, so the
  cache never needs invalidating.
- Plucked-string tables are rendered once per pitch and warmed in idle time
  after the first play.
- `estimateDuration` computes a track's exact runtime from its form plan without
  composing a note, so list views do not pay for 105 compositions at boot.
- Canvas loops skip their work entirely when the surface is off-screen.

## Keyboard

| | |
|---|---|
| `Space` | Play / pause |
| `←` `→` | Seek five seconds |
| `Shift` + `←` `→` | Previous / next movement |
| `↑` `↓` | Volume |
| `M` `S` `R` | Mute · shuffle · repeat |
| `F` | Concert hall |
| `Q` | Queue |
| `/` | Focus search |
| `⌘K` / `Ctrl K` | Command palette |
| `?` | Shortcut sheet |
| `G` then `H` `S` `L` `Q` | Go to hall · search · library · queue |
| `Esc` | Close whatever is open |

## Accessibility

The interface is heavily canvas-driven, so the usual affordances are provided
explicitly: every `<px-text>` heading emits a visually-hidden text node, so the
accessibility tree and browser text-search behave as if it were real type; a
live region announces track and view changes; focus is trapped in the palette,
the shortcut sheet and the concert hall, and moved to the top of the main region
after a route change; the transport controls implement the full `role="slider"`
contract with keyboard support; and `prefers-reduced-motion` stills the dot
pulse, the ripple and the boot sequence.

## Development

```
node dev/test.mjs                 # 52 assertions over theory, composer,
                                  # catalogue, search, store and utils
node dev/shot.mjs /tmp/shots      # screenshots every route and breakpoint,
                                  # including scripted "while playing" states,
                                  # and reports any console error
node dev/shot.mjs /tmp/shots --only=concert
node dev/film.mjs /tmp/maestro.mp4 # films the whole piece — see below
open dev/halftone-lab.html        # tune the screen against the photographs
open dev/art-lab.html             # the bitmap face and the sleeve motifs
```

`film.mjs` records one continuous take: the prelude from the first movement to
the door, the way in, and the hall playing. The page runs on a **virtual
clock** — `performance.now`, `Date.now`, `requestAnimationFrame` and the timer
functions are all replaced before the application loads, and the harness
advances them exactly one frame at a time. Nothing is dropped and nothing
stutters: a screenshot that takes a tenth of a second to capture still
represents one thirtieth of a second of the piece. Frames go straight into
ffmpeg over a pipe as lossless PNG, because handing a field of single-pixel
dots on near-black to a low-bitrate intermediate codec destroys exactly the
thing worth filming. Point `FFMPEG_PATH` at an ffmpeg with libx264.

The test suite covers the parts where a silent regression would be hardest to
notice by eye — that the composer's estimated durations match its real ones,
that every piece cadences on its tonic, that events stay sorted and in range,
that the catalogue's references all resolve, that search ranks exact titles
first.

## The repertoire

Nine ensembles, twenty records, 105 movements, six curated programmes, about six
hours of music — all of it invented for this project, none of it a recording of
anyone's work. The composers, the sleeve notes and the ensemble biographies are
fiction.

Elias Vantor conducts in the dark. The Vesper Quartet build a programme the way
a printer builds a tone: not by mixing, but by spacing. The Pixel Philharmonic
perform under a grid of 4,096 lamps, on the argument that a symphony, like an
image, has a resolution — and that lowering it does not destroy the work but
reveals its structure.
