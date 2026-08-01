# Klokkrak

Klokkijken oefenen voor de lagere school — **per graad**, opgebouwd volgens de [GO!-visietekst kloklezen](https://pro.g-o.be/download/GOPRO-1830562155-11891/Visietekst%20kloklezen). Als installeerbare web-app (PWA) voor op iPads, met een aparte leerkracht-tool om oefeningen op maat te maken en te delen via QR-code of link.

Deel van de Krak-familie, naast [Rekenkrak](https://github.com/jellebraum-dotcom/rekenkrak) en [Taalkrak](https://github.com/jellebraum-dotcom/taalkrak).

## Twee toepassingen in één map

| Bestand           | Voor wie   | Wat                                                                                              |
| ----------------- | ---------- | -------------------------------------------------------------------------------------------------- |
| `index.html`      | Leerlingen | Zelf oefenen (kies je graad en onderwerpen) óf een QR-code van de juf/meester scannen. Werkt offline. |
| `leerkracht.html` | Leerkracht | Oefeningen op maat samenstellen, QR-codes/links genereren, en klassikaal oefenen op het digibord.  |

De QR-codes en links openen automatisch de leerlingapp met de juiste oefening erin — geen server, geen login.

## De GO!-aanpak, letterlijk gevolgd

Het GO! heeft een eigen, vernieuwde leerlijn kloklezen. Die wijkt bewust af van de traditionele aanpak, en die keuzes zitten in deze app ingebakken:

- **Absoluut lezen eerst.** Kinderen leren de klok eerst lezen als "X uur Y minuten" (10 uur 25). De relatieve lezing (kwart over, half, tien voor) komt er pas vanaf het derde leerjaar bij.
- **Geen "voor/over het half uur".** Uitdrukkingen als "tien voor half drie" komen nergens voor — het GO! laat die weg omdat ze enkel verwarring stichten.
- **Geen wijzers tekenen.** Opdrachten waarbij een kind wijzers op een lege klok moet zetten, zijn volgens de visietekst zinloos en niet functioneel. Ze zitten dus niet in de app.
- **Decoderen, interpreteren én meten.** Alle drie de soorten opdrachten komen aan bod, met vanaf het tweede leerjaar geleidelijk meer tijdrekenen.
- **Instelbare wijzerplaat.** Van veel hulp (uren én minuten) tot geen cijfers — precies de opbouw die de visietekst aanraadt.

## Leerlijn per graad

**1e graad (L1–L2)** — hele uren · halve uren als "X uur 30" · per 5 minuten · digitaal schrijven · welke klok hoort bij een digitale tijd · voormiddag of namiddag · hoeveel uur later · hoeveel minuten later.

**2e graad (L3–L4)** — tot op de minuut aflezen · over en voor het uur · kwart en half · 24-urenlezing · op de minuut voor/over het uur · kwartier of half uur bijdoen en wegnemen · tijdverschil over het uur heen.

**3e graad (L5–L6)** — nadruk op meten: hoe lang duurt het · hoe laat is het straks · tijdmaten omzetten · uurroosters lezen · op tijd of te laat.

## Verder

Aantal oefeningen (5/10/15/20/∞), optionele tijdsdruk, sterren en confetti. **Eén kans per oefening**: bij een fout verschijnt het juiste antwoord even in beeld en telt de fout mee — op het eindscherm staat een overzicht van de hele reeks met de fouten erbij, inclusief miniklokjes. In de klassikale modus staan extra grote knoppen voor op het digibord.

## Zelf hosten

Zet alle bestanden samen in één map op GitHub Pages. Stap voor stap: [LEESMIJ.md](LEESMIJ.md). Camera-scannen vereist **https**; GitHub Pages levert dat automatisch.

## Technisch

Puur statisch: HTML/CSS/JavaScript zonder build-stap. De wijzerplaat wordt als SVG getekend, met instelbare hoeveelheid hulp. [qrcode-generator](https://www.npmjs.com/package/qrcode-generator) maakt de QR-codes, [jsQR](https://www.npmjs.com/package/jsqr) leest ze. Service worker + manifest maken er een offline werkende, installeerbare PWA van.

## Licentie

[MIT](LICENSE)
