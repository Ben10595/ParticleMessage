# Referenzprüfung vor der Implementierung

Stand: 13. September 2026. Alle fünf Repositories wurden direkt von GitHub mit `git clone --depth 1` in ein temporäres Verzeichnis geladen. README, Lizenzdatei beziehungsweise deren Fehlen, Paketstruktur und die unten genannten Implementierungen wurden vor dem Schreiben der neuen Engine geprüft. Keine Abhängigkeiten dieser Repositories wurden installiert oder ausgeführt. Der Vergleich ist eine Quellcodeanalyse, kein geräteübergreifender Benchmark der fünf Projekte.

## Lizenzentscheidungen

| Repository / geprüfter Commit | Tatsächlicher Lizenzbefund | Verwendung |
| --- | --- | --- |
| [Particle Morph Engine](https://github.com/tbpatj/Particle-Morph-Engine/tree/6f32a972b9b74663766936b3160447c1f4cc812b) · `6f32a972` | `LICENSE`: MIT, © 2024 TJ Luebke | Technische Referenz für GPU-Rendering, wiederverwendete Ziele, Bild-/Text-Sampling. Keine kopierten Quellcodeabschnitte. |
| [dotmatter](https://github.com/Tresnanda/dotmatter/tree/0762bfee1aaa95a4f971aeb1ee324e20b7874611) · `0762bfee` | `LICENSE`: MIT, © 2026 Treshnanda | Technische Referenz für Home-Position, Geschwindigkeit, Feder, Kräfte, Touch und zugänglichen Text. Eigene Implementierung. |
| [ParticleFX](https://github.com/mitulgajera16/particle-effect/tree/2e1566b9638830aa44b2e1a8810668b330cd0cb4) · `2e1566b9` | README nennt MIT; im gesamten Checkout keine LICENSE-, LICENCE- oder COPYING-Datei. `package.json` enthält keinen Lizenztext. | Nur allgemeine technische Ideen. Keine direkte Codeübernahme, insbesondere keine kopierten Shader/Physics-Funktionen. |
| [Particles Playground](https://github.com/isladjan/particles-playground/tree/94446906443194a05b2d515212a36f990e0dbae4) · `94446906` | README und Paket nennen MIT; tatsächliche `LICENCE` heißt **Custom Notification License**, © 2024 isladjan, verlangt schriftliche Benachrichtigung **vor** Nutzung/Änderung und Attribution. | Kein Code, Shader, Simplex-Noise-Code, Bildmaterial, Font oder anderes Asset übernommen. Niemand wurde kontaktiert. Allgemeine Transition-/Touch-Ideen unabhängig umgesetzt. |
| [Canvas Particle Morphing](https://github.com/fytseng/canvas-particle-morphing/tree/41e8be9a2ff442f63169b8c2a933c5f148fc5df1) · `41e8be9a` | `LICENSE`: MIT, © 2026 fytseng | Referenz für mobile Rastergrößen, Schriftbereitschaft, Canvas-Fallback und Pausieren. Eigene Implementierung. |

Die neue Engine enthält keine direkt übernommenen Quellcodepassagen, keine Fremdshader und keine Referenzassets. Deshalb werden keine dieser Bibliotheken und keine ihrer Lizenzen als eingebetteter Programmcode ausgeliefert. Die Namen, Copyright-Zuordnungen und überprüften Lizenzquellen bleiben hier als technische Attribution dokumentiert. Bei späteren direkten Übernahmen müssen die vollständigen zugehörigen Lizenz- und Copyright-Hinweise zusätzlich neben dem übernommenen Code erhalten bleiben. README-Lizenzangaben allein werden bei widersprüchlichen oder fehlenden Lizenzdateien nicht als Freigabe für Copy/Paste behandelt.

## Particle Morph Engine

Gelesen: `readme.md`, `LICENSE`, `package.json`, Struktur unter `src/`, `src/webgl/shaders/{vertexShader,fragmentShader}.ts`, `src/webgl/loop.ts`, `src/canvasReader/canvasReading.ts`, `src/particles/loop.ts`, `src/particles/mouse/mouse.ts` sowie die Zuordnung zu Group-/CanvasReader-/WebGL-Modulen.

- Renderer und Physik sind in WebGL2 über Transform Feedback und wechselnde VAO/Feedback-Buffer verbunden. Positions-/Geschwindigkeitszustand bleibt auf der GPU; Gruppen ändern Ziele, Farben, Radien und Matrizen. Das ist interessant für sehr große Mengen.
- Der Vertexshader enthält Zielzug, Dämpfung, Lebensdauer, Randverhalten und Mauskräfte. Der Fragmentshader zeichnet runde Punktkerne. Text und Bilder gelangen über Canvas-Pixel/Alpha in die Zielmenge.
- Gruppen können überschrieben werden; die README weist selbst auf noch nicht ausgereifte Partikelallokation und fehlende aktive FPS-Regelung hin. Globale Singleton-Struktur und große Shader-Optionsfläche passen weniger gut zum abbrechbaren React-Szenenplayer.
- Touch verwendet vor allem den ersten Finger. Responsive Koordinaten berücksichtigen Canvas/DPI; die Nachricht braucht zusätzlich Wortumbruch, Tastatursemantik und Sensorfreigabe.
- Entscheidung: Das Prinzip persistenter Ziele und eines einzigen GPU-Draws übernehmen, aber keine globale Library oder Transform-Feedback-Physik. Für bis zu 18.000 Slots sind CPU-TypedArrays einfacher zu prüfen; lokalisierte Geheimnisse, exakte Rückkehr und der Canvas-Fallback können dieselbe Simulation verwenden. Ein späterer GPU-Simulationspfad bleibt möglich, ist aber nicht nötig, um Instancing zu nutzen.

## dotmatter

Gelesen: README, LICENSE, Root- und Paketstruktur (`core`, `shaders`, `react`, Playground), `core/src/{spring,particle-field,interaction,webgl,renderer}.ts`, `shaders/src/index.ts`, relevante Lebenszyklus-/Pointer-/Textteile von `react/src/index.tsx`.

- Saubere Trennung von Simulation, Renderer, deklarativen Effekten und React-Anbindung. Home, Position, Velocity und Source-UV liegen in TypedArrays.
- Zeitbasierte Feder-/Dämpfungsmodelle sind verständlich und testbar. Ambientkräfte und Cursorbeschleunigung ergänzen die Home-Feder; Mehrfinger-Eingaben werden explizit behandelt.
- WebGL-Shader bieten mehrere Bildstilisierungen, von denen diese Website nur runde Partikel benötigt. Den gesamten Effektkatalog einzubauen würde unnötige Optionen und Code mitbringen.
- `DotMatterText` rastert Text auf einem temporären Canvas und behält versteckten DOM-Text. Für mehrzeilige Nachrichten und präzise UTF-16-Geheimnisbereiche benötigt die App eine eigene Glyphenlayout-Schicht.
- React-Wrapper berücksichtigt Sichtbarkeit, reduzierte Bewegung, Quellenbereitschaft und Listener-Cleanup. Das pauschale `touchAction: none` wäre im Editor ungeeignet.
- Entscheidung: Zeitbasierte Feder, Kräftekomposition, Datenarrays, zugänglicher Text und Multi-Pointer als Architekturprinzipien. Eigene Integration mit kleinen Zeitschritten und klaren Gruppen für UI/Nachricht; natives Scrollen bleibt außerhalb der Hold-Fläche möglich.

## ParticleFX

Gelesen: README, `package.json`, vollständige Quellstruktur, `engine/{particle-engine,physics,renderer-webgl,renderer-canvas2d,sampler}.ts`. Lizenzdateien zusätzlich im gesamten Checkout gesucht: keine gefunden.

- Schlanke Trennung von Spring-Mass-Physik und zwei Renderern. WebGL2 zeichnet Quads per Instancing, Position/Farbe/Größe liegen in wiederverwendeten Upload-Arrays.
- Cursor-Abstoßung, geschwindigkeitsabhängiger Wind, magnetische/explosive Voreinstellungen und begrenzte Ripple-Wellen sind als Produktideen passend.
- Teile der Physik und Ripple-Zeit sind framebasiert; bei verschiedenen Bildwiederholraten kann sich das Verhalten ändern. Unsere Physik verwendet Sekunden und Substeps; Konvergenz wird bei 30/60/120 Hz getestet.
- Shader berechnen im Referenzprojekt harte runde/square Masken. Eigene Shader liefern weichere Kerne, einen kleinen Halo und geschwindigkeitsabhängig gestreckte Quads für Bewegungsspuren ohne Bildschirm-Ghosting.
- Touchstart/-move sind vorhanden; vollständiges Multitouch ist in der README noch als Beitragsidee genannt. Bei manchen Fehlern nach Erzeugen eines GL-Kontexts ist ein Canvas2D-Fallback auf derselben Canvas nicht mehr möglich. Unsere App bietet deshalb außerdem einen funktionalen HTML-Fallback und explizite Context-Loss-Behandlung.
- Bildsampler berücksichtigt Alpha, Farbwerte, Auflösungsbegrenzung und optionale Scatterparameter. Für die App sind gecachte Glyphen mit lesbarer Dichte wichtiger als Bildbearbeitungsregler.
- Entscheidung: Ideen neu implementieren, keinen Code ohne überprüfbare LICENSE-Datei übernehmen.

## Particles Playground

Gelesen: README, `LICENCE`, `package.json`, Projektstruktur, Engine/Renderer/Shader in `effect.js`, Pixel-Extraktion, `changeTexture`, ResizeObserver, Mouse-/Touch-Hooks, Frame-Limit und Tail-Canvas-Abschnitte.

- Three.js/GSAP, instanzierte Geometrie, Texturen und eine Touch-Tail-Texture erzeugen räumliche Bildanimationen. Shader mischen Tiefe, Rauschen und Touchdisplacement; Szenen animieren Parameter/Geometrie.
- Gute Referenz für Dramaturgie: Form öffnen, Tiefe verändern, dann neuen Inhalt sammeln. Die Referenz baut aber zum Teil Geometrie pro Textur neu auf; ihr Gesamtpaket ist für die kleine Nachrichtenapp unnötig groß.
- Globale Touchbehandlung mit `preventDefault()` und Voll-DPR passt weniger gut zum scrollbaren Editor und Akkuziel. Die ursprünglichen Fotos haben eigene Rechte und werden nicht benutzt.
- Entscheidung: Vollständig unabhängige isometrische Geschenkgeometrie, mathematische Spiral-/Portalbahnen und eigener weicher Shader. Kein `effect.js`, Noise-Snippet, GSAP, Three.js, Foto oder Referenzfont eingebaut.

## Canvas Particle Morphing

Gelesen: README, LICENSE, gesamte kleine Paketstruktur und `particle.js` (Sizing, Pixel-Sampling, Particle-Klasse, Morphing, Maus-/Touch-, Resize-, IntersectionObserver- und Font-Ready-Ablauf). Kein package.json, kein WebGL-Renderer und keine Shader vorhanden.

- Leichtgewichtiger einzelner Canvas mit Home-/Velocity-Feder, responsivem Sampling und dokumentierter Mobile-/Font-Loading-Behandlung.
- `document.fonts.ready` und Pausieren bei Unsichtbarkeit vermeiden typische leere oder unnötig laufende Canvas-Zustände.
- Die Referenz verwendet Objektpartikel, einzelne Draws, framebasierte Physik, zufälliges Sortieren und mehrere Pixel Jitter. Für längere lesbare Nachrichten sind das Nachteile.
- Entscheidung: Eigener gebündelter Canvas-Fallback, begrenzte DPR, gecachte Glyphraster, stabile Raumzuordnung statt zufälligem Sortieren, keine dauerhafte Buchstabenverwacklung. Pointer Events statt paralleler Mouse-/Touch-Systeme.

## Ergebnis des Vergleichs

Ein eigener Kern in `particles/matter/` verbindet die geeigneten Ideen, ohne fünf Engines einzubinden:

- `ParticleEngine`: Lebenszyklus, ein RAF, UI-/Szenenkoordination, Holds, Geheimnisse, Abbruch, Sichtbarkeit und Context-Recovery.
- `MorphSystem`: fester TypedArray-Pool, stabile IDs (zusätzliche freie IDs stützen lange Geheimtexte aus kurzen Markierungen), Zielzuordnung mit räumlicher Sortierung in O(n log n), Freigabe/Übernahme zwischen Gruppen.
- `PhysicsSystem`: Home-/Velocity-/Acceleration-Feder, zeitbasierte Substeps, Reveal-Pfade, Repulsion/Attraction, Ripple, Wind, Gravity, Float und Portal.
- `ParticleRenderer`: eigener WebGL2-Instancing-Renderer mit einem Upload/Draw, eigenem Halo-/Trail-Shader, Canvas2D-Fallback.
- `TextSampler`: gerasterte Glyphen, automatische Größe und Umbrüche, UTF-16-Bereiche, begrenzter Cache, Text-/Bildtargets.
- `ShapeSampler`: isometrisches Geschenk samt beweglichem Deckel/Schleife sowie ausgefülltes Herz, Stern und Unendlichkeit.
- `InteractionSystem`: gleichzeitige Pointer, begrenzte Ripple-Liste und vollständiger Listener-Abbau.
- `QualityManager`: verzögerte Qualitätsabsenkung und langsamere Erholung; begrenzte DPR und Samplingbudgets.

Der bestehende Supabase-Datenpfad und die getesteten, optionalen Szeneinstellungen werden weiterverwendet. Neue Links erhalten `/m/`, alte `/p/`-Links bleiben kompatibel. Keine neue Grafikbibliothek oder externe Schriftabhängigkeit.
