# Fejlesztési jegyzetek — PGPIO+ Companion modul

Ez a dokumentum a fejlesztés közbeni döntéseket, a jelenlegi állapotot és a
nyitott feladatokat rögzíti, hogy egy későbbi munkamenet (akár másik
fejlesztő, akár egy másik Claude Code session) gyorsan vissza tudjon
kapcsolódni anélkül, hogy újra végig kellene gondolnia ugyanazokat a
döntéseket. A modul **felhasználói** dokumentációja a [README.md](README.md)
(fejlesztői gyorsindítás, fájlstruktúra), a
[companion/HELP.md](companion/HELP.md) (Companion admin felületen megjelenő
súgó) és a [PROTOCOL.md](PROTOCOL.md) (WS protokoll a firmware-nek) —
ez a fájl ezeket **nem ismétli meg**, csak a hátteret/indoklást adja hozzá.

## Állapot (2026-09-08)

- A modul funkcionálisan kész: kapcsolatkezelés (`device-connection.js`),
  akciók (`actions.js`), feedback-ek (`feedbacks.js`), változók
  (`variables.js`), presetek (`presets.js`) megvannak, `npm run check`
  hibamentes.
- **Publikálás (2026-10-05):** a modul ID `pgpio-pgpio-plus`-ra változott
  (Bitfocus `gyártó-termék` konvenció, manufacturer: `PGPIO`), a HELP.md,
  a README és a konfigurációs mezők angolra fordítva, LICENSE (MIT)
  hozzáadva. Git repó: https://github.com/hwsysnet/companion-module-pgpio-pgpio-plus
  (`v1.0.0` tag). Hátralévő lépés: a Bitfocus Slack `#module-development`
  csatornáján repót kérni a `bitfocus` szervezetben, majd a
  https://developer.bitfocus.io/ portálon beküldeni a verziót.
- A README által ajánlott `smoke-test.mjs` (hamis `InstanceContext`-tel
  futtatott `init`/`configUpdated`/`destroy` életciklus-teszt, lásd
  README "`@companion-module/base` v2 API" szakasz) **még nincs
  megírva**. Eddig helyette ad-hoc `node -e "..."` szkriptekkel
  ellenőriztük az `actions.js`/`presets.js` viselkedését — ezeket érdemes
  lenne egy tényleges `smoke-test.mjs`-be konszolidálni.

## GPO vezérlés — a "Set GPO" akció módjai és miért így alakultak

A `set_gpo` akció (`actions.js`) módjai: **Toggle**, **On**, **Off**,
**Momentary**. A Momentary mód a "csengőgomb" jellegű, csak nyomvatartás
alatt aktív kimenet igényéből született — ennek a kialakítása több
iteráción ment át ebben a munkamenetben, érdemes ismerni a köztes
próbálkozásokat is, mert a trigger-alapú vezérlés kapcsán ugyanezek a
korlátok fognak újra előjönni.

### A Companion-architektúra alapkorlátja (ez motivált mindent)

Egy Companion modul **action callback-je nem kapja meg**, hogy egy adott
hívás gombnyomásra (`down`) vagy -elengedésre (`up`) történt-e —
ellenőriztük a `@companion-module/base` SDK típusdefinícióit
(`CompanionActionEvent`, lásd
`node_modules/@companion-module/base/dist/module-api/action.d.ts`): nincs
benne fázis-jelző, és nincs semmilyen "auto-release"/"run on release"
mechanizmus sem, amit a modul kérhetne. A `down`/`up` felosztás **csak a
gomb konfigurációjának szintjén** létezik (lásd
`CompanionButtonStepActions` a
`node_modules/@companion-module/base/dist/module-api/preset/definition.d.ts`-ben):
egy gombnak van külön **Press (down)** és **Release (up)**
akciólistája, és Companion ezeket a fizikai nyomás/elengedés pillanatában
futtatja le — de a modul callback-je szemszögéből a két hívás
megkülönböztethetetlen, ha nem mi magunk tartunk nyilván állapotot.

**Ebből következik:** valódi "amíg nyomva tartod, addig aktív" viselkedés
**kizárólag** úgy érhető el, hogy ugyanaz (vagy egy erre tervezett) akció
**mindkét** listában (Press és Release) szerepel, és a modul saját maga
tartja nyilván, hogy éppen "fel van-e fegyverezve" (arm/disarm páros
hívás). Ha az akció csak az egyik listában van, nincs mód a modul oldaláról
kitalálni, mikor kellene visszakapcsolnia.

### Kipróbált és elvetett megoldás: fix idejű impulzus módban "Momentary"

Egy köztes iterációban a Momentary módot **duration-alapú impulzusra**
cseréltük (a meglévő "Pulse GPO" logikájával megegyezően: bekapcsol, majd
`momentary_duration` ms után automatikusan visszakapcsol) — ennek előnye,
hogy **csak Press-listás** akcióként működik, Release nélkül. A felhasználó
ezt **kifejezetten elvetette**, mert megbízhatatlanabbnak találta (nem
igazodik a tényleges nyomvatartás hosszához) — **vissza lett állítva** a
Press+Release arm/disarm megoldásra. **Ha valaki később újra ezt az utat
akarná bejárni, tudja: ezt már kipróbáltuk, és a felhasználó explicit
elvetette — ne ismételjük meg kérdés nélkül.**

### A jelenleg élő megoldás: Press+Release arm/disarm

- `main.js`: `this.momentaryPins = new Set()` — pinenként tárolja, hogy a
  Momentary akció épp "fel van-e fegyverezve" (bekapcsolva tartva).
- `actions.js` `set_gpo` callback, `mode === 'momentary'` ág: ha a pin
  nincs a Setben, felveszi és bekapcsolja (ez a "press" hívás); ha már
  benne van, törli és kikapcsolja (ez a "release" hívás). Van egy
  `self.log('debug', ...)` sor is ebben az ágban kifejezetten diagnosztikai
  célból (`momentary pin=... wasArmed=... -> ON/OFF`) — ezt **szándékosan
  nem távolítottuk el**, mert a hibakereséshez (lásd lent) hasznos volt és
  hasznos is marad, ha valaha megint "beragad" a viselkedés.
- `presets.js`: a `GPO n (Momentary)` preset (`gpo_momentary_<n>` id-k, a
  `gpo_momentary` struktúra-szekcióban) ugyanazt a `set_gpo`
  (`mode: 'momentary'`) akciót teszi be **mindkét** (`down` és `up`)
  listába egy lépésben — ez a **javasolt, megbízható** módja a Momentary
  gomb létrehozásának, **nem** a kézi összeállítás.

### Hibakeresési tapasztalat: miért "toggle-szerű" / "beragadt" a viselkedés

A felhasználó két különböző tünetet is tapasztaltút közben kézzel épített
gombbal (nem a preseten keresztül):

1. **"Ugyanazt csinálja, mint a toggle"** — ennek oka az volt, hogy az
   akció csak a Press listában szerepelt, a Release listában nem (vagy
   csak részben lett odarakva). Mivel a callback csak egyszer (nyomásra)
   fut le, az arm/disarm páros logika **minden egyes nyomásra felváltva**
   be- majd kikapcsol — ez kívülről pontosan úgy néz ki, mint a Toggle mód,
   noha a kód szintjén más útvonalon megy végig.
2. **"Beragad az állapot"** — ez akkor jelentkezett, amikor a Release
   listában is szerepelt az akció, de feltehetően **duplikált
   akciósorokkal** (pl. korábbi kézi próbálkozásból ott maradt extra
   sorok) — ha egy adott listában **kétszer** szerepel ugyanaz az akció,
   egyetlen fizikai nyomás/elengedés két callback-hívást vált ki, ami
   megbontja az arm/disarm páros számolást, és kiszámíthatatlan (esetenként
   "beragadt") végállapotot eredményez.

**Végül a kész preset használatával** (nem kézi gombbal) mindkét probléma
megoldódott — ez megerősíti, hogy a kód logikája helyes, a hibák a kézi
gombépítés során becsúszott hiányos/duplikált akció-konfigurációból
adódtak. **Tanulság további fejlesztéshez:** ha valaki manuálisan épít
Momentary gombot (nem presettel), nyomatékosan ellenőrizni kell, hogy a
"Set GPO" (Momentary) akció **pontosan egyszer** szerepel a Press és
**pontosan egyszer** a Release listában — sem több, sem kevesebb.

## Nyitott kérdés: Momentary viselkedés Trigger-ből (nem gombról)

A felhasználó felvetette, hogy **Companion Triggerből** (Triggers/Events
fül, nem gomb) szeretné indítani a "csak amíg aktív, addig ON" logikát.
Ez **más architekturális helyzet**, mint a gomb Press/Release, mert egy
Trigger nem feltétlenül ad "vége" jelzést:

- **Ha a triggert kiváltó forrás (pl. MIDI/OSC/HTTP) csak egyszeri,
  pillanatnyi eseményt küld** (nincs pl. MIDI note-off vagy második
  HTTP hívás a "vége" jelzésére), akkor **nincs mód** a modul oldaláról
  kitalálni, mikor kell visszakapcsolni — ez nem a modul korlátja, hanem
  az adatforrásé. Ilyenkor az egyetlen technikailag helyes megoldás a
  **már meglévő "Pulse GPO" akció** (fix, konfigurálható időtartam,
  `actions.js` `pulse_gpo`), **nem** a Momentary mód — ehhez **nem kell
  új kódot írni**, a Pulse GPO már megvan.
- **Ha viszont VAN egy tényleges true/false állapot/változó**, amiből a
  trigger jön (pl. egy Companion belső változó vagy egy másik modul
  feedback-je, ami igaz amíg "aktív", hamis amikor "nem aktív"), akkor
  **nem kell ismerni előre az időtartamot** — csak **két külön Triggert**
  kell felvenni a Companion Triggers/Events fülön:
  - Trigger A: feltétel = a változó **igaz** → Action: `Set GPO`, mode:
    **On**.
  - Trigger B: feltétel = ugyanaz a változó **hamis** → Action: `Set GPO`,
    mode: **Off**.

  Ez pontosan ugyanaz a minta, mint a gomb Press/Release-e, csak a két
  "oldalt" nem egy gomb két akciólistája, hanem két külön Trigger adja.
  **Ehhez sem kell modul-kód változtatás** — a `Set GPO` akció On/Off
  módja már megvan, ez tisztán Companion-oldali Trigger-konfiguráció.

**Ez a beszélgetés végén még nyitva maradt**: nem tisztázódott, pontosan
melyik változó/feedback adja a felhasználó valós true/false forrását, így
a konkrét Trigger-feltétel (Event type, összehasonlítás) beállítása még
hátravan — ezt kell elsőként tisztázni a következő munkamenet elején, ha a
téma folytatódik.

## Tesztelési módszerek, amiket eddig használtunk

- `npm run check` (`companion-module-check`) — manifest/struktúra
  validáció, minden módosítás után érdemes lefuttatni.
- Ad-hoc Node szkriptek (`node -e "import('./actions.js')..."`) egy
  hamis `self` objektummal (`{ device: { gpo: [...], setGpo() {...} },
  momentaryPins: new Set(), log() {...} }`) — ezekkel közvetlenül
  tesztelhető egy akció `callback`-je vagy a `getPresets()` kimenete
  Companion nélkül. Gyors, de **nem helyettesíti** a valódi Companion
  GUI-ban történő tesztelést (lásd a fenti "toggle-szerű"/"beragadt"
  esetet, amit csak valódi gombbal lehetett reprodukálni és
  diagnosztizálni).
- `npm run mock-device` — szimulált ESP32 a device-connection.js
  end-to-end teszteléséhez, valódi hardver nélkül.
- A `set_gpo` Momentary ágában lévő `self.log('debug', ...)` sor — ezt
  kifejezetten azért hagytuk bent, hogy Companion Debug log szintjén
  látszódjon minden arm/disarm hívás párja; hasznos, ha megint
  furcsaság jelentkezne.

## Rövid táv: mit érdemes legközelebb csinálni

1. Tisztázni a Trigger-alapú true/false forrást (lásd fent), és ha kell,
   segíteni a konkrét Trigger-konfigurációban (ez Companion-oldali
   beállítás, nem kód).
2. `git init` + kezdeti commit, hogy a jövőbeli változtatások
   követhetők legyenek.
3. `smoke-test.mjs` megírása a README-ben leírt módon (hamis
   `InstanceContext` + `init`/`configUpdated`/`destroy` életciklus).
