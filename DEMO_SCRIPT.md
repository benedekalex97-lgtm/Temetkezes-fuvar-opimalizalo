# Bemutatási forgatókönyv — Demo v0.1 (5–7 perc)

Előkészítés: `npm run dev`, böngésző 1440 px széles ablakban a `http://localhost:3000`
címen. Ha korábban már futott a demó: fejléc → **Demó visszaállítása** → **Visszaállítás**.

---

## 1. Reggeli terv (≈1 perc) — *Napi irányítópult*

- „2026. szeptember 29., kedd, a szimulált idő **11:22**. Reggel 07:00-kor mindhárom jármű a
  Ferihegyi úti telephelyről indult.”
- Mutasd a **napi idővonalat**: teljesített (csíkozott), folyamatban lévő (keretes) és
  tervezett blokkok; a sötétebb sávok a helyszíni munkát jelölik.
  - J-01: reggeli intézményi szállítás (Uzsoki → Bocskai) kész, **F-2026-097** rugalmas,
    alacsony prioritású átvétel 12:30–14:00 között, majd a **kézzel rögzített** F-2026-098
    hamvasztási szállítás (lakat ikon).
  - J-02: Bocskai → Csömör hamvasztási szállítás kész, most egy Bajcsy-kórházi átvétel fut.
  - J-03: urna Csömörről a Dembinszky utcai irodába, most pénz és iratok az Árpád úti
    irodából — **Késésveszély**: terepi jelzés +9 perc, 6 perc tartalék.
- KPI-sor: 3/3 csapat, 1 veszélyeztetett, 1 kiosztatlan (F-2026-099), következő határidő 11:30.
- Hangsúly: minden ügy csak belső azonosítóval szerepel, személyes adat nincs.

## 2. Járművek és csapatok (≈45 mp) — *Járművek és csapatok*

- J-01 + A csapat (2 fő): **ügyelet ma 07:00 – holnap 07:00**, 07:00–15:00 között napi
  feladatokat is végez; haláleseti felvételnél 2 órás kiérkezési határ.
- J-02 + B csapat (2 fő), J-03 + C csapat (1 fő): 07:00–15:00, visszaérkezéssel együtt.
- J-03 demó-konfigurációja: urnalogisztika, pénz- és iratszállítás — **elhunyt szállítására
  nem használható**.

## 3. Helyszínek (≈45 mp) — *Helyszínek*

- Telephely és Bocskai u. 56. hűtési pont: **belső operatív adat**; Csömöri Hamvasztó;
  négy AEVUM-iroda H–P 08:00–16:00.
- Budapesti **felvételi helytörzs**: nyitott, kereshető lista — nem szerződéses partnerlista.
- Élőben: **Új felvételi hely** → pl. „Demó Rendelőintézet”, `1045 Budapest, Megyeri út 10.`
  → a hely „ellenőrzésre vár” állapotban, kerületből becsült koordinátával kerül be.
  (Nem budapesti címet a rendszer elutasít.)

## 4. A 11:22-es sürgős esemény (≈45 mp) — *Napi irányítópult*

- Kattints: **11:22-es esemény indítása**.
- Megnyílik az **F-2026-100** részletezője: haláleseti felvétel, Szent Imre Egyetemi
  Oktatókórház → Bocskai István u. 56., bejelentve 11:22, **kiérkezési határ 13:22**,
  2 fő + szállító jármű. „A határ a felvételi címre érkezésre vonatkozik, nem a fuvar végére.”
- Zárd be, és kattints: **Javaslat készítése**.

## 5. Optimalizálói javaslat (≈1,5 perc)

- A panel fejlécén: **„Nem lép életbe jóváhagyás nélkül”** — a jóváhagyott terv (PV-1) nem
  változott; lent a Tervverziók 3. oszlopa ezt meg is mutatja.
- Javaslat: **J-01 + A csapat**, indulás 11:30 a Bocskai útról, szimulált kiérkezés 12:20,
  **1 ó 2 p tartalék** a 13:22-es határig.
- **Áthelyezés**: az ütköző, alacsony prioritású F-2026-097 → **J-02 (B csapat)**,
  kiérkezés 12:34 (határ 14:00), B csapat visszaér 14:16-ra — belefér a 15:00-s műszakvégbe.
- A kézzel rögzített F-2026-098 változatlan marad (szoros, 10 perces csatlakozás —
  figyelmeztetés).
- Jelöltek: J-02 is alkalmas lenne (41 p tartalék), **J-03 nem választható** (kis logisztikai
  jármű, 1 fő).
- Idővonal → **Javaslat előnézete**: szaggatott keret az új és az áthelyezett feladaton,
  a térképen szaggatott javasolt útvonal és bordó sürgős szakasz.

## 6. Diszpécseri módosítás vagy elfogadás (≈1 perc)

- **Módosítás**: válaszd a J-02-t, legkorábbi indulás 12:00, indoklás: „A csapat tartalékban
  marad”. → **Változat ellenőrzése**. A diszpécseri változat újraszámolja a határt és a
  hatást (J-01 megtartja F-2026-097-et). Megmutatható, hogy J-03 nem jelölhető ki.
- **Vissza az eredeti javaslathoz**, majd **Elfogadás** (megjegyzés nem kötelező).
  - Alternatíva: **Elutasítás** kötelező indoklással — a terv változatlan, a feladat
    kiosztatlan marad.

## 7. Frissített napi terv (≈45 mp)

- Az esemény kártyája zöld: „Jóváhagyva: J-01 (A csapat) indul 11:30 …”.
- **Tervverziók összevetése**: 1) eredeti reggeli terv (PV-1, változatlan) · 2) optimalizálói
  javaslat (JAV-001, elfogadva) · 3) jóváhagyott aktuális terv (PV-2) — „új” és
  „áthelyezve J-01 →” jelölésekkel. A **döntési napló** rögzíti a döntést.
- Idővonal: J-01-en az új sürgős feladat és a 13:22-es határ, J-02-n az átvett F-2026-097.

## 8. Zárás: a diszpécser dönt (≈15 mp)

- „Az optimalizáló gyorsan és átláthatóan javasol, indokol és figyelmeztet — de terv csak a
  diszpécser döntésével jön létre, visszakövethető tervverzióként.”
- Kiemelni: determinisztikus demólogika, becsült útvonal, szimulált ETA — nem production
  motor, nem valós idejű forgalmi adat.

Opcionális ráadás: *Feladatok* → **Új sürgős bejelentés** a frissen felvett helyre → a
javaslat most már **J-02**-t ajánlja, mert J-01 a jóváhagyott terv szerint foglalt.
