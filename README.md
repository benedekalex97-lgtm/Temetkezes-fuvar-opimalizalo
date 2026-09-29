# Temetkezési Operációs Optimalizáló — Demo v0.1

Bemutatható, magyar nyelvű diszpécseri irányítópult egy temetkezési szolgáltató napi
működéséhez. A demó egy szimulált munkanapot mutat (2026. szeptember 29., kedd, 11:22),
három jármű–csapat párral, a reggeli tervvel és egy 11:22-kor érkező sürgős haláleseti
felvétellel.

> **Az optimalizáló javasol. A diszpécser dönt.**
> A rendszer soha nem alkalmaz automatikusan javaslatot: terv csak diszpécseri
> elfogadással (vagy módosítással) jön létre, külön tervverzióként.

## Indítás

```bash
npm install
npm run dev          # http://localhost:3000
```

Production módban:

```bash
npm run build && npm start
```

Node.js 20.9+ szükséges (a fejlesztés Node 22-vel történt). Külső API-kulcs, adatbázis vagy
backend nem kell.

## Fontos parancsok

| Parancs | Mit csinál |
| --- | --- |
| `npm run dev` | Fejlesztői szerver |
| `npm run build` | Production build (statikusan előrenderelt oldalak) |
| `npm start` | A build kiszolgálása |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript szabályok) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest üzleti szabálytesztek (`tests/`) |
| `npm run check` | Lint + typecheck + teszt + build egyben |

## Mit tud a demó

- **Napi irányítópult** — szimulált idő (11:22), szolgálatban lévő csapatok, aktív járművek,
  sürgős/veszélyeztetett és kiosztatlan feladatok, következő határidő, műszakból hátralévő idő,
  napi idővonal (jóváhagyott terv / javaslat előnézete / reggeli terv), becsült útvonal
  térképen vagy sematikus nézetben, járművenként eltérő színnel.
- **11:22-es sürgős esemény** — egy gombbal betölthető új haláleseti felvétel
  (Szent Imre Egyetemi Oktatókórház → Bocskai István u. 56., kiérkezési határ 13:22).
- **Optimalizálói javaslat** — J-01 + A csapat, az ütköző alacsony prioritású F-2026-097
  áthelyezése J-02-re (B csapat), érthető indoklással, jelöltösszevetéssel, J-02-re gyakorolt
  hatással és figyelmeztetésekkel.
- **Diszpécseri döntés** — elfogadás; módosítás (másik alkalmas jármű, indulási idő,
  kötelező indoklás, újraszámolt változat); elutasítás indoklással.
- **Tervverziók** — az eredeti reggeli terv (PV-1), az optimalizálói javaslat (JAV-…) és a
  jóváhagyott aktuális terv (PV-2, …) egymás mellett, eltérések kiemelésével; döntési napló.
- **Feladatok** — szűrés státusz szerint, keresés, részletező oldalpanel (azonosító, típus,
  prioritás, felvételi és célhely, bejelentés, kiérkezési határ, szimulált ETA, jármű, csapat,
  státusz, optimalizálói indoklás, diszpécseri döntés és indok), új sürgős bejelentés
  rögzítése bármely aktív felvételi helyre.
- **Járművek és csapatok** — műszaksávok (A: ma 07:00 – holnap 07:00), aktuális szimulált
  tevékenység, demó-konfiguráció (J-03 nem szállíthat elhunytat), mai terv.
- **Helyszínek** — operatív helyszínek (telephely, hűtési pont, hamvasztó, 4 AEVUM-iroda) és a
  kereshető, bővíthető budapesti `PickupLocation` helytörzs (új hely hozzáadása, aktiválás /
  inaktiválás, becsült koordináta jelölése).
- **Demó visszaállítása** — a fejlécből; visszatölti az eredeti seed munkanapot.

Feladatstátuszok: Új · Kiosztatlan · Javaslat készült · Jóváhagyva · Folyamatban · Teljesítve ·
Késésveszély (származtatott jelzés) · Kézzel rögzítve.

## Technikai stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4, helyben kezelt UI-komponensek (`components/ui.tsx`), Lucide ikonok,
  IBM Plex Sans / Mono (`@fontsource`, offline is működik)
- Leaflet + CARTO Positron csempék (API-kulcs nélkül); csempehiba esetén automatikus
  sematikus SVG-nézet
- Kliensoldali állapot: tiszta reducer (`lib/domain/store.ts`) + `useSyncExternalStore`
  store localStorage-mentéssel (`lib/client/demo-store.ts`)
- Vitest az üzleti szabályokra

### Szerkezet

```
app/                      Oldalak: / (irányítópult), /feladatok, /jarmuvek, /helyszinek
components/               UI (dashboard/, map/, task-detail, app-shell, ui)
lib/demo-optimizer.ts     Determinisztikus mock optimalizáló (javaslat + elfogadhatóság)
lib/domain/types.ts       Domainmodell (Vehicle, Crew, Shift, Location, PickupLocation, Task,
                          Assignment, OptimizationSuggestion, DispatcherDecision, PlanVersion)
lib/domain/schedule.ts    Menetrend-szimuláció és kemény korlátok (műszak, napi ablak,
                          telephelyre visszaérés, nyitvatartás, rögzített feladat)
lib/domain/travel.ts      Szimulált utazási modell (demó-paraméterek)
lib/domain/seed.ts        Anonimizált demó-munkanap
lib/domain/store.ts       Reducer: esemény, javaslat, változat, elfogadás, elutasítás,
                          helytörzs, visszaállítás
lib/domain/selectors.ts   UI-lekérdezések (KPI-k, járműállapot, tervösszevetés)
tests/domain.test.ts      Üzleti szabálytesztek
```

A domainlogika nincs UI-komponensekbe rejtve; a komponensek csak a reducer akcióit hívják
és a selectorok eredményét jelenítik meg.

## Source of truth

A kanonikus dokumentáció a Google Drive **„temetkezés optimalizálás”** mappája
(D-06): `PROJECT_INDEX`, `PRODUCT_DOMAIN_SPEC_v0.1`, `DECISIONS_LOG`, `RESEARCH_LOG`,
`OPEN_QUESTIONS`. A demót a D-03, D-05, D-08, D-09, D-10 döntések és a specifikáció 28–29.
fejezete határozza meg. Részletek és a nyitott pontok: [`SOURCE_OF_TRUTH.md`](SOURCE_OF_TRUTH.md).

## Demó és production határa

Ez **demóprototípus** (D-10). Nem része és nem is készül elő:

- production infrastruktúra, adatbázis, backend, autentikáció, jogosultsági rendszer;
- éles vagy valódi személyes adat — minden feladat csak belső azonosítót használ
  (`F-2026-091` …), a csapattagok anonim kódok (`A-1`, `A-2` …);
- szerződéses partnerállítás — a felvételi helytörzs pontjai lehetséges operatív pontok,
  nem igazolt AEVUM-partnerek; a Ferihegyi út 47. és a Bocskai u. 56. belső operatív adat;
- VROOM / OSRM / Valhalla integráció vagy végleges optimalizálómotor;
- hiteles útvonal, ETA vagy kilométeradat.

## A mock optimalizáló korlátai

**Ez determinisztikus demólogika, nem production optimalizálómotor.** (`lib/demo-optimizer.ts`)

- A menetidő légvonal × 1,3 szorzó, egységes 32 km/h átlagsebesség és 4 perc ráhagyás
  alapján számolt **Szimulált ETA**; nincs forgalom, napszak vagy úthálózat.
- Az útvonal a térképen légvonalas szakaszokból álló **Becsült útvonal**.
- Egyfeladatos beillesztés: a célfeladatot minden jármű hátralévő sorának minden pozíciójába
  beilleszti, a kiszorult alacsonyabb prioritású feladatot egy másik alkalmas járműre próbálja
  áthelyezni. Nem globális optimum, nincs célfüggvény-súlyozás (Q-07 nyitott).
- Rangsor: alkalmasság → kemény ütközés hiánya → kiérkezési határ → kevesebb kiosztatlanul
  maradó feladat → sürgős haláleseti felvételnél az ügyeleti csapat (D-08) → korábbi kiérkezés.
- Teljesített, folyamatban lévő és kézzel rögzített feladatot nem mozgat; a bemenetet nem
  módosítja; elavult alaptervre épülő javaslat nem fogadható el.
- Időablakok, szolgáltatási idők, előkészítési idő (8 perc) és a késésveszély-küszöb
  (10 perc) demó-paraméterek, nem validált szakmai szabályok.

## Ismert korlátozások

- A szimulált idő rögzített (11:22); az idő nem halad, a feladatok nem lépnek tovább
  automatikusan.
- A térképcsempék külső szolgáltatásból töltődnek; hálózat nélkül a böngészőkonzolban a
  csempekérések hibaként jelennek meg, a felület pedig automatikusan sematikus nézetre vált.
- A demóállapot böngészőnként localStorage-ban él; nincs megosztott vagy szerveroldali állapot.
- Új felvételi hely koordinátája megadható, vagy az irányítószám kerületközéppontjából
  becsült (a felületen jelölve).
- Egy munkatárs–több jármű, szünetek, kapacitás, több telephely nincs modellezve
  (Q-04, Q-09, Q-10 nyitott).
