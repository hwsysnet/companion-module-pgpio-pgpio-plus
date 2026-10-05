# PGPIO+ — WebSocket protokoll specifikáció (v1)

Ez a dokumentum írja le azt a protokollt, amit a Bitfocus Companion modul
(ez a repó) és a PGPIO+ board firmware-je közötti kommunikációhoz
használunk. A cél, hogy a firmware oldal ettől a specifikációtól
függetlenül, tetszőleges implementációval elkészülhessen (Arduino,
ESP-IDF, stb.) — a modul csak ezt a szerződést várja el.

## Áttekintés

- A **PGPIO+ a WebSocket szerver**, a Companion modul a **WebSocket
  kliens**. A modul konfigurációjában (Companion webes felületén) adjuk meg
  a PGPIO+ IP címét, portját és a WS útvonalat (path).
- Alapértelmezett javasolt path: `/ws`. Alapértelmezett javasolt port:
  **`32032`** (de ez tetszőleges lehet, a modul konfigból kézzel is
  állítható — lásd lent a Bonjour/mDNS szekciót az automatikus
  megtalálásról).
- Egy időben **egy aktív kapcsolatot** kell kiszolgálni (ha új kliens
  csatlakozik, a régi kapcsolatot a device lezárhatja/felülírhatja).
- Minden üzenet egyetlen **JSON objektum egyetlen WebSocket text frame-ben**.
  Nincs sor-alapú keretezés (nem kell `\n` a végére), a WS frame maga a
  határoló.
- A pin indexelés a **vezetéken (wire) 0-alapú** (`0..31`), a Companion UI-n
  viszont **1-alapú** (`GPI 1` .. `GPI 32`, `GPO 1` .. `GPO 32`) jelenik meg.
  Tehát a UI "GPI 1" ⇔ wire `pin: 0`.
- GPI = a device felől jövő bemenetek (kontaktzár / feszültségmentes
  érintkező érzékelése), GPO = a device kimenetei (relé / tranzisztoros
  kimenet a tally lámpákhoz).
- **Logikai polaritás (nagyon fontos, ezen múlik hogy a Companion oldalon
  minden feedback/változó helyesen mutasson):**
  - **GPI**: **nyitott** (nincs kontaktzárás, az érintkező szakadt) ⇒
    `state: 0` (Companion oldalon `false`). **Zárt** (kontaktzárás történt,
    az érintkező vezet) ⇒ `state: 1` (Companion oldalon `true`).
  - **GPO**: **nyitott** (a kimenet/relé nincs meghúzva, szakadt az
    áramkör) ⇒ `state: 0` (Companion oldalon `false`). **Zárt** (a
    kimenet/relé meg van húzva, zárt az áramkör) ⇒ `state: 1` (Companion
    oldalon `true`).
  - Tehát mindkét irányban egységesen: **nyitott = `0`/`false`, zárt =
    `1`/`true`.** A firmware-nek ezt a konvenciót kell követnie a
    `gpi_change`/`state`/`gpo_ack` üzenetekben, és ugyanígy kell
    értelmeznie a `set_gpo`/`set_gpo_bulk` parancsokban kapott `state`
    értéket (1 = zárja a kimenetet, 0 = nyissa).

## Automatikus eszközkeresés (Bonjour / mDNS) — FONTOS a firmware-nek

A Companion modul konfigurációjában a felhasználónak **nem kötelező kézzel
megadnia az eszköz IP címét** — a modul megpróbálja automatikusan
megtalálni a PGPIO+ boardot a helyi hálózaton Bonjour/mDNS-en keresztül
(ha ez nem sikerül / nem támogatott a hálózaton, a felhasználó kézzel is
beírhatja az IP-t és portot, ez a fallback megmarad).

Ehhez a **firmware-nek mDNS szolgáltatásként be kell jelentkeznie** a
hálózatra, az alábbi paraméterekkel:

- **Szolgáltatás típus (service type):** `_pgpio._tcp` (tehát a teljes
  mDNS bejegyzés `_pgpio._tcp.local.` lesz)
- **Port:** a WS szerver ténylegesen használt portja (alapértelmezetten
  `32032`, de ha a felhasználó/gyártó mást állít be a firmware-en, azt a
  portot kell hirdetni)
- TXT rekordra jelenleg nincs szükség, de ha a jövőben több PGPIO+
  terméktípus is lesz, javasolt egy `model` vagy hasonló TXT mező
  hozzáadása a megkülönböztetéshez.

**Arduino/ESP32 (ESPmDNS) minta:**
```cpp
#include <ESPmDNS.h>

void setup() {
  // ... WiFi.begin(...) és a kapcsolódás megvárása után:
  if (MDNS.begin("pgpio-plus")) {  // a hostname tetszőleges lehet
    MDNS.addService("pgpio", "tcp", 32032);  // a service type "pgpio", NEM "_pgpio"! az mDNS lib teszi elé az aláhúzást
  }
}
```

**ESP-IDF (mdns komponens) minta:**
```c
mdns_init();
mdns_hostname_set("pgpio-plus");
mdns_service_add(NULL, "_pgpio", "_tcp", 32032, NULL, 0);
```

Ha a firmware nem tud mDNS-t hirdetni, az sem gond — a Companion modulban
a felhasználó ekkor egyszerűen kézzel adja meg az IP címet és portot (ez a
korábbi működés, változatlanul támogatott).

## Kapcsolat életciklusa

1. Companion modul TCP/WS kapcsolatot nyit: `ws://<host>:<port><path>`.
2. Csatlakozás után a device **azonnal küldjön** egy `hello` üzenetet,
   majd egy teljes `state` snapshotot (lásd lent).
3. Ezután a device csak **változáskor** küld `gpi_change` eseményt (nem kell
   pollingolni / nem kell periodikusan újraküldeni a teljes state-et).
4. A modul időnként (alapértelmezetten 10 másodpercenként) `ping` üzenetet
   küld. A device-nek erre `pong`-gal kell válaszolnia. Ha a modul 15
   másodpercig semmilyen üzenetet nem kap a device-től (sem `pong`-ot, sem
   más eseményt), a kapcsolatot holtnak tekinti és újracsatlakozik.
5. Ha a kapcsolat megszakad, a modul automatikusan újrapróbálkozik
   (alapértelmezetten 5 másodpercenként).
6. Újracsatlakozáskor a folyamat az 1. pontról indul újra (`hello` + teljes
   `state`).

## Device → Modul üzenetek

### `hello`

Kötelező, közvetlenül a kapcsolat felépülése után egyszer.

```json
{
  "type": "hello",
  "device": "pgpio-plus",
  "fw_version": "1.0.0",
  "gpi_count": 32,
  "gpo_count": 32
}
```

- `gpi_count` / `gpo_count`: ha nem 32, a modul figyelmeztetést naplóz, de
  megpróbálja kezelni (a 32-nél kisebbet elfogadja, a 32-nél nagyobbat
  levágja 32-re). A jelenlegi modul verzió fix 32/32 pinnel dolgozik.

### `state` — teljes állapot snapshot

Kötelező, közvetlenül a `hello` után, illetve bármikor amikor a modul
`get_state`-et kér.

```json
{
  "type": "state",
  "gpi": [0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "gpo": [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
}
```

- Mindkét tömb pontosan 32 elemű, értékei `0` vagy `1`.
- `gpi[i]` / `gpo[i]` az `i`-edik (0-alapú) bemenet/kimenet állapota.

### `gpi_change` — egy bemenet állapotváltozása

Ezt küldi a device minden alkalommal, amikor egy GPI kontaktus állapota
megváltozik (a debounce-olás a device feladata — a modul nem debounce-ol).

```json
{ "type": "gpi_change", "pin": 4, "state": 1 }
```

- `pin`: 0-alapú index (0-31).
- `state`: `0` (nyitott kontaktus) vagy `1` (zárt kontaktus) — lásd fent a
  "Logikai polaritás" pontot.
- Opcionálisan tartalmazhat `ts` mezőt (device uptime ms), a modul ezt
  figyelmen kívül hagyja.

### `gpo_ack` — kimenet visszaigazolása (ajánlott, nem kötelező)

Miután a device végrehajtott egy `set_gpo` parancsot, visszaigazolhatja:

```json
{ "type": "gpo_ack", "pin": 10, "state": 1 }
```

Ha a device ezt nem küldi, a modul optimistán a parancsban küldött értéket
tekinti aktuális állapotnak.

### `pong`

Válasz a modul `ping` üzenetére, kapcsolat életben-tartás ellenőrzésére:

```json
{ "type": "pong" }
```

### `error` (opcionális)

```json
{ "type": "error", "message": "leírás a hibáról" }
```

A modul ezt csak naplózza, funkcionálisan nem kezeli másképp.

## Modul → Device üzenetek

### `set_gpo` — egyetlen kimenet állítása

```json
{ "type": "set_gpo", "pin": 10, "state": 1 }
```

- `state`: `1` = zárja a kimenetet (relé meghúz), `0` = nyissa (relé
  elenged) — lásd fent a "Logikai polaritás" pontot.

### `set_gpo_bulk` — több kimenet egyszerre

```json
{
  "type": "set_gpo_bulk",
  "pins": [
    { "pin": 0, "state": 1 },
    { "pin": 1, "state": 0 },
    { "pin": 2, "state": 1 }
  ]
}
```

Ezt használja a modul pl. az "összes GPO törlése" akcióhoz (minden pin
`state: 0`).

### `get_state` — teljes állapot lekérése

```json
{ "type": "get_state" }
```

Erre a device a fenti `state` üzenettel válaszol.

### `ping`

```json
{ "type": "ping" }
```

A device-nek `pong`-gal kell válaszolnia (lásd fent).

## Hibatűrés / elvárások a firmware felé

- A JSON parse hibát okozó vagy ismeretlen `type` mezőjű bejövő üzeneteket
  a device egyszerűen hagyja figyelmen kívül (ne omoljon össze rajta).
- Ha egyszerre két Companion-modul-kliens próbál csatlakozni, elég az
  utolsó kapcsolatot kiszolgálni, a régit le lehet zárni.
- A GPI bemeneteknél a debounce (kontaktzár zajszűrés) a device felelőssége
  — a modul minden `gpi_change` üzenetet azonnal, szűrés nélkül feldolgoz.
- **Valós idejűség / időzítés — kritikus.** Ezt a rendszert **kb. 0,5
  másodperces pontosságú vezérlésekhez** használjuk (pl. tally váltás
  élő adásban), ezért a device-firmware-nek **azonnal**, mesterséges
  késleltetés vagy batchelés nélkül kell küldenie a `gpi_change`
  üzeneteket, amint egy bemenet állapota (a debounce lezárása után)
  megváltozik. Ökölszabály:
  - A debounce idő legyen **rövid** (javasolt: kb. 5-20 ms — pont annyi,
    hogy a kontaktzár zajt kiszűrje, de ne adjon hozzá érezhető
    késleltetést).
  - Ne gyűjtsd össze / ne késleltesd a `gpi_change` üzeneteket egy közös
    időzítő ciklusra (pl. ne csak 100ms-onként egy "loop"-ban ellenőrizd
    és küldd ki a változásokat) — minden pin-váltás azonnal, önállóan
    generáljon egy üzenetet.
  - Ugyanez vonatkozik a `set_gpo` parancsok végrehajtására is: a
    kimenetet a parancs vételét követően azonnal (érezhető
    késleltetés — pl. egy lassú loop-ciklus — nélkül) állítsd be, majd
    (ha támogatott) azonnal küldd vissza a `gpo_ack`-et.
- WiFi kapcsolat elvesztése esetén a device a saját logikája szerint
  próbáljon újracsatlakozni a WiFi-hez; a WS szerver ettől függetlenül
  induljon el újra, amint van hálózat.

## Minta üzenetváltás

```
Device connect →
Device: {"type":"hello","device":"pgpio-plus","fw_version":"1.0.0","gpi_count":32,"gpo_count":32}
Device: {"type":"state","gpi":[0,0,...0],"gpo":[0,0,...0]}

(valaki megnyom egy gombot a Companion felületen, GPO 3-at bekapcsolja)
Modul → Device: {"type":"set_gpo","pin":2,"state":1}
Device → Modul: {"type":"gpo_ack","pin":2,"state":1}   (opcionális)

(egy kontaktzár záródik a device-en, GPI 5)
Device → Modul: {"type":"gpi_change","pin":4,"state":1}

(10 mp után a modul életjelet kér)
Modul → Device: {"type":"ping"}
Device → Modul: {"type":"pong"}
```

## Tesztelés

A repóban van egy `mock-device/mock-esp32.js` Node.js script, ami egy
minimális WebSocket szervert indít, és pontosan ezt a protokollt beszéli
(véletlenszerű GPI változásokat generál, és naplózza a kapott `set_gpo`
parancsokat). Ezzel a Companion modul a valódi hardver nélkül is
tesztelhető, és a hardveres kollégának is jó referencia lehet a firmware
elkészítéséhez:

```bash
npm run mock-device
```
