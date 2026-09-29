# Source of truth — fejlesztési hivatkozás

Ez a fájl **csak fejlesztési hivatkozás**. Nem másolja le a Drive-dokumentációt; a kanonikus
forrás továbbra is a Google Drive **„temetkezés optimalizálás”** mappája (D-06). Eltérés
esetén a Drive és a legutóbbi termékgazdai utasítás az irányadó.

## Beolvasott dokumentumok (2026-09-29, csak olvasás)

| Dokumentum | Drive-állapot a beolvasáskor | Megjegyzés |
| --- | --- | --- |
| PROJECT_INDEX | módosítva 2026-09-28 | Még Phase 0 állapotot és D-01–D-07-et mutat; D-10 a demóra feloldja. |
| PRODUCT_DOMAIN_SPEC_v0.1 | DRAFT, módosítva 2026-09-29 | 28. (AEVUM demo baseline) és 29. (Demo v0.1 engedély) fejezet APPROVED. |
| DECISIONS_LOG | módosítva 2026-09-29 | D-01–D-10. |
| RESEARCH_LOG | módosítva 2026-09-28 | R-01–R-13. |
| OPEN_QUESTIONS | módosítva 2026-09-29 | Q-01–Q-25. |

## Releváns döntések

| Azonosító | Tartalom a demóban |
| --- | --- |
| D-03 | „Az optimalizáló javasol. A diszpécser dönt.” — nincs automatikus kiosztás. |
| D-05 | Adatminimalizálás: belső ID, koordináta, operatív paraméter; nincs elhunyt/hozzátartozó adat. |
| D-08 | J-01+A (2 fő, ügyelet 07:00–07:00, napi feladat 07:00–15:00, 2 órás kiérkezési határ), J-02+B (2 fő), J-03+C (1 fő), B és C 07:00–15:00. |
| D-09 | Telephely Ferihegyi út 47., hűtési pont Bocskai u. 56. (belső adat), Csömöri Hamvasztó, J-03 urna/pénz/irat folyamat, nyitott budapesti felvételi helytörzs. |
| D-10 | Demo v0.1 implementáció engedélyezve; production, éles adat, auth, partnerállítás, végleges motor nincs. |
| Spec 28–29 | APPROVED demóbaseline és implementációs keret. |
| R-11 | Négy AEVUM-iroda, H–P 08:00–16:00 (nyilvánosan igazolt). |
| R-13 | Kórházak/patológiák: lehetséges felvételi pontok, nem igazolt partnerek. |

## APPROVED adatok (demóbaseline)

- Jármű–csapat párok, létszámok, műszakok, a 2 órás kiérkezési határ (D-08, Q-25).
- Telephely, hűtési pont, hamvasztó, felvételi terület: Budapest (D-09, Q-20).
- J-03 feladatköre: urnák az irodákba, pénz és iratok vissza (D-09, Q-24 alapfeladat).
- Irodák és nyitvatartás (R-11 — DOCUMENTED).
- A 11:22-es esemény és a javaslat elvárt tartalma (termékgazdai prompt, 2026-09-29).

## OPEN vagy PARTIAL — a demó nem dönti el

- **Q-01–Q-05 (BLOCKER, OPEN)**: valós munkanap, feladattaxonómia, sérthetetlen szabályok,
  erőforrás-részletek, időmodell → a demó időablakai, szolgáltatási idői és sebessége
  demó-paraméterek.
- **Q-06** kézi rögzítés pontos szemantikája — a demóban a „Kézzel rögzített” feladat időpontja
  és járműve nem változtatható.
- **Q-07** célfüggvény — a mock optimalizáló csak rögzített, dokumentált rangsort használ.
- **Q-08–Q-12** napközbeni változás, crew-mozgás, több telephely, tesztnap, felülírási jog.
- **Q-13–Q-17** routing pontosság, VROOM-korlátok, kivételkezelés, adatkezelés, baseline.
- **Q-21 (PARTIAL)** intézményi átvételi pontok, időablakok, dokumentumigény.
- **Q-22 (PARTIAL)** hamvasztóüzemi foglalási és átadási ablakok.
- **Q-23 (OPEN)** temetők, templomok, kápolnák és kapcsolódó fuvarok.
- **Q-24 (PARTIAL)** J-03 járási gyakoriság és további feladatok.

## Eltérések Drive és a fejlesztési utasítás között

- A PROJECT_INDEX még „nincs kód / Phase 0” állapotot mutat — a D-10 és a spec 29. fejezet
  ezt a demóprototípusra feloldja. Nem blokkoló; a Drive-ot ez a fejlesztési kör nem módosította.
- Egyéb ellentmondást nem találtunk; a prompt helyszín-, műszak- és irodaadatai egyeznek
  D-08, D-09 és R-11 tartalmával.
