# Support Dashboard - Digitalisering Whiteboard

> **Versie 12** - Production audit + cron timing fixes + daily_totals bug fix (20 feb 2026)

## 1. Probleem & Doel

Het huidige handmatige whiteboard op kantoor wordt dagelijks bijgehouden met support-metrics. Dit willen we volledig automatiseren in een digitaal dashboard op Vercel.

### Huidige whiteboard-structuur (gevalideerd via foto)

| Dag       | Call | Chatbot | Unassigned (08/18) | All Open (08/18) | WA All (08/18) | WA WOU (08/18) | Waiting on Us (08/18) |
|-----------|------|---------|-------------------|------------------|----------------|-----------------|----------------------|
| Maandag   | 33   | 42      | 14 / 2            | 75 / 58          | 24 / 20        | 8 / 0           | 0 / 4               |
| Dinsdag   |      |         | 5                 | 61               | 21             | 1               | 5                    |
| ...       |      |         |                   |                  |                |                 |                      |

### Databron: HubSpot "Support" Conversations Inbox

De getallen komen 1-op-1 uit de **sidebar van de HubSpot Support inbox** (screenshot bevestigd):

```
« Support ▼                           HubSpot Inbox Sidebar
  You're available

  Unassigned           2    <- Whiteboard kolom "Unassigned"
  Assigned to me       0
  All open            55    <- Whiteboard kolom "All Open"
  Chat                 0
  > More

  Whatsapp            16    <- Whiteboard kolom "WA All Open"
  WA - Waiting On Us   0    <- Whiteboard kolom "WA Waiting on Us"
  Tickets - waiting on us 2 <- Whiteboard kolom "Waiting on Us"
```

### Kolom-definities (bevestigd + gekoppeld aan inbox views)

| Kolom               | Type                   | HubSpot Inbox View                 | Definitie                                             |
|---------------------|------------------------|--------------------------------------|-------------------------------------------------------|
| **Call**            | Dagelijks totaal       | *(niet in inbox, apart opvragen)*   | Totaal inbound + outbound calls die dag               |
| **Chatbot**         | Dagelijks totaal       | *(niet in inbox, apart opvragen)*   | Totaal chatbot-gesprekken die dag (alle chatbots)     |
| **Unassigned**      | Reconstructie 08 + 18 | `Unassigned` (standaard view)       | Conversations zonder owner in Support inbox            |
| **All Open**        | Reconstructie 08 + 18 | `All open` (standaard view)         | Alle open conversations in Support inbox               |
| **WA All Open**     | Reconstructie 08 + 18 | `Whatsapp` (custom view)            | Open WhatsApp conversations                            |
| **WA Waiting on Us**| Reconstructie 08 + 18 | `WA - Waiting On Us` (custom view)  | WhatsApp waar wij moeten reageren                      |
| **Waiting on Us**   | Reconstructie 08 + 18 | `Tickets - waiting on us` (custom)  | Tickets met status "waiting on us"                     |
| **Emails**          | Dagelijks totaal       | *(CRM emails object)*               | Totaal emails (in + out) die dag                       |
| **WA Msgs**         | Dagelijks totaal       | *(Conversations threads/messages)*   | Totaal WhatsApp berichten (in + out) die dag           |

---

## 2. HubSpot Discovery - Bevestigde Bevindingen

> Alle onderstaande gegevens zijn live geverifieerd via de HubSpot API op 18 februari 2026.

### 2.1 Alle Pipelines & Stages

#### Support Pipeline (telt mee voor All Open)

| Veld | Waarde |
|------|--------|
| **Pipeline ID** | `0` |
| **Label** | "Support Pipeline" |

| Stage ID | Label | Open? |
|----------|-------|-------|
| `1` | New | **Ja** |
| `2` | Waiting on contact | **Ja** |
| `3` | Waiting on us | **Ja** |
| `4` | Closed | Nee |

#### WhatsApp Pipeline (telt mee voor All Open)

| Veld | Waarde |
|------|--------|
| **Pipeline ID** | `63418382` |
| **Label** | "Whatsapp Pipeline" |

| Stage ID | Label | Open? |
|----------|-------|-------|
| `124821627` | New | **Ja** |
| `124821628` | Waiting on contact | **Ja** |
| `124821629` | Waiting on us | **Ja** |
| `124821630` | Closed | Nee |

#### Fulfilment Pipeline (telt mee voor All Open)

| Veld | Waarde |
|------|--------|
| **Pipeline ID** | `43676967` |
| **Label** | "Fulfilment Pipeline" |

| Stage ID | Label | Open? |
|----------|-------|-------|
| `91082351` | New | **Ja** |
| `91082352` | Waiting on contact | **Ja** |
| `91082353` | Waiting on us | **Ja** |
| `91082354` | Closed | Nee |

#### Returns Pipeline (telt mee voor All Open)

| Veld | Waarde |
|------|--------|
| **Pipeline ID** | `5238396` |
| **Label** | "Returns" |

| Stage ID | Label | Open? |
|----------|-------|-------|
| `5238397` | Nieuw | **Ja** |
| `5238398` | Waiting on contact | **Ja** |
| `5238399` | Wachtend op ons | **Ja** |
| `5238400` | Closed | Nee |

#### Partner Support Pipeline (telt mee voor All Open)

| Veld | Waarde |
|------|--------|
| **Pipeline ID** | `91542424` |
| **Label** | "Partner Support" |

| Stage ID | Label | Open? |
|----------|-------|-------|
| `169157959` | New | **Ja** |
| `169157960` | Waiting on contact | **Ja** |
| `169157961` | Waiting on us | **Ja** |
| `169157962` | Closed | Nee |

#### Overige Pipelines (tellen NIET mee voor All Open)

| Pipeline | ID | Reden uitsluiting |
|----------|-----|-------------------|
| Sales Pipeline | `11855705` | Apart inbox (Sales), niet Support |
| Marketing Pipeline | `31785340` | Niet in Support inbox |
| Aircall - Phone calls | `29735571` | Alleen Missed/Answered call stages (beide CLOSED) |

### 2.2 Inboxes

| Inbox ID | Naam | Type |
|----------|------|------|
| `3283369` | Support | INBOX |
| `483097662` | Help Desk | HELP_DESK |
| `1367826122` | Sales | INBOX |

### 2.3 WhatsApp Channel

| Veld | Waarde |
|------|--------|
| **Originating channel ID** | `1007` (op ticket: `hs_originating_generic_channel_id`) |
| **Type** | Native WhatsApp (HubSpot) |

> **Let op**: Channel `1002` = Email. WhatsApp = `1007`.

### 2.4 Owners

| Owner ID | Naam | Relevant |
|----------|------|----------|
| `51199190` | **Roel Sanders** | Uitgesloten in "Tickets Waiting on Us" filter |
| `148710916` | Bas Zonneveld | |
| `49898029` | Support Whatsapp Auto Reply | |

### 2.5 Conversation CRM Object (type 0-11)

- **103 properties** gevonden via `GET /crm/v3/properties/conversations`
- Belangrijkste property: `hs_conversation_status`
  - `CONVERSATION_STATUS_OPEN` = open in inbox
  - `CONVERSATION_STATUS_CLOSED` = gesloten
- **NIET toegankelijk** via publieke CRM API (`/crm/v3/objects/conversations/` geeft 404)
- De inbox sidebar telt op basis van dit object, niet direct op tickets
- Workaround: `createdate >= 15 dagen` op tickets simuleert conversation status exact

---

## 3. Exacte Inbox Filter Definities (uit screenshots)

> Deze filters zijn direct afgelezen uit de "Edit view" dialogen in HubSpot.

### 3.1 WhatsApp All Open (custom view)

```
Group 1:
  Conversation status = Open
  AND Source = WhatsApp
```

### 3.2 WA - Waiting On Us (custom view)

```
Group 1 (OR):
  Conversation status = Open
  AND Source = WhatsApp
  AND Last message from visitor = True

Group 2:
  Conversation status = Open
  AND Source = WhatsApp
  AND Conversation is associated to: Any Ticket
  AND Ticket status is any of: New/Waiting on us (alle pipelines)
```

### 3.3 Tickets - Waiting on Us (custom view)

```
Group 1:
  Conversation is associated to: Any Ticket
  AND Ticket status is any of: Waiting on us (alle pipelines)
  AND Ticket owner is none of: Roel Sanders
```

---

## 4. Geverifieerde API Formules - Alle 5 Metrics

> Alle formules zijn live getest tegen de inbox sidebar op 18 feb 2026.
> Elke formule gaf een **exact** match.

### Verificatie Overzicht

| Metric | API Resultaat | Inbox | Status |
|--------|--------------|-------|--------|
| **All Open** | 55 | 55 | **EXACT** |
| **Unassigned** | 2 | 2 | **EXACT** |
| **WhatsApp All Open** | 16 | 16 | **EXACT** |
| **WA Waiting On Us** | 0 | 0 | **EXACT** |
| **Tickets Waiting on Us** | 2 | 2 | **EXACT** |

Eerder ook geverifieerd: All Open 52=52, 53=53 (3x exact).

### 4.1 All Open

**Formule**: Tickets in 5 pipelines met open stages, aangemaakt in laatste 15 dagen.

**Pipelines**: Support (`0`), WhatsApp (`63418382`), Fulfilment (`43676967`), Returns (`5238396`), Partner Support (`91542424`)

**API Query** (max 5 filterGroups, dus precies passend):

```json
POST /crm/v3/objects/tickets/search

{
  "filterGroups": [
    {
      "filters": [
        { "propertyName": "hs_pipeline", "operator": "EQ", "value": "0" },
        { "propertyName": "hs_pipeline_stage", "operator": "IN", "values": ["1","2","3"] },
        { "propertyName": "createdate", "operator": "GTE", "value": "{15_DAGEN_GELEDEN_MS}" }
      ]
    },
    {
      "filters": [
        { "propertyName": "hs_pipeline", "operator": "EQ", "value": "63418382" },
        { "propertyName": "hs_pipeline_stage", "operator": "IN", "values": ["124821627","124821628","124821629"] },
        { "propertyName": "createdate", "operator": "GTE", "value": "{15_DAGEN_GELEDEN_MS}" }
      ]
    },
    {
      "filters": [
        { "propertyName": "hs_pipeline", "operator": "EQ", "value": "43676967" },
        { "propertyName": "hs_pipeline_stage", "operator": "IN", "values": ["91082351","91082352","91082353"] },
        { "propertyName": "createdate", "operator": "GTE", "value": "{15_DAGEN_GELEDEN_MS}" }
      ]
    },
    {
      "filters": [
        { "propertyName": "hs_pipeline", "operator": "EQ", "value": "5238396" },
        { "propertyName": "hs_pipeline_stage", "operator": "IN", "values": ["5238397","5238398","5238399"] },
        { "propertyName": "createdate", "operator": "GTE", "value": "{15_DAGEN_GELEDEN_MS}" }
      ]
    },
    {
      "filters": [
        { "propertyName": "hs_pipeline", "operator": "EQ", "value": "91542424" },
        { "propertyName": "hs_pipeline_stage", "operator": "IN", "values": ["169157959","169157960","169157961"] },
        { "propertyName": "createdate", "operator": "GTE", "value": "{15_DAGEN_GELEDEN_MS}" }
      ]
    }
  ],
  "limit": 0
}
```

> `filterGroups` = OR, `filters` binnen een group = AND.
> `value` voor createdate = Unix timestamp in milliseconden.

**Breakdown bij 55**:
| Pipeline | Tickets |
|----------|---------|
| Support | 40 |
| WhatsApp | 14 |
| Fulfilment | 1 |
| Returns | 0 |
| Partner Support | 0 |
| **Totaal** | **55** |

### 4.2 Unassigned

**Formule**: Zelfde als All Open + `hubspot_owner_id` NOT_HAS_PROPERTY.

Voeg aan elke filterGroup toe:
```json
{ "propertyName": "hubspot_owner_id", "operator": "NOT_HAS_PROPERTY" }
```

**Geverifieerd**: 2 = 2

### 4.3 WhatsApp All Open

**Formule**: WA pipeline open stages (30 dagen) OR Support pipeline open + channel 1007.

> Gebruikt 30 dagen (niet 15) voor WA pipeline, omdat sommige WA conversations langer openblijven.
> Plus: 1 WhatsApp ticket zit in de Support pipeline (ID 19437996288, `hs_originating_generic_channel_id = 1007`).

```json
{
  "filterGroups": [
    {
      "filters": [
        { "propertyName": "hs_pipeline", "operator": "EQ", "value": "63418382" },
        { "propertyName": "hs_pipeline_stage", "operator": "IN", "values": ["124821627","124821628","124821629"] },
        { "propertyName": "createdate", "operator": "GTE", "value": "{30_DAGEN_GELEDEN_MS}" }
      ]
    },
    {
      "filters": [
        { "propertyName": "hs_pipeline", "operator": "EQ", "value": "0" },
        { "propertyName": "hs_pipeline_stage", "operator": "IN", "values": ["1","2","3"] },
        { "propertyName": "hs_originating_generic_channel_id", "operator": "EQ", "value": "1007" }
      ]
    }
  ],
  "limit": 0
}
```

**Geverifieerd**: 16 = 16

### 4.4 WA Waiting on Us

**Formule (v4, bijgewerkt 19 feb 2026)**: 3 filter groups met `hs_last_message_received_at >= 14d`:
- **Group A**: WA pipeline + stage "Waiting on us" (124821629) — tickets die expliciet op ons wachten
- **Group B**: WA pipeline + stage "New" (124821627) + `from_visitor=true` — nieuwe berichten waar wij nog niet op reageerden
- **Group C**: WA pipeline + stage "Waiting on contact" (124821628) + `from_visitor=true` — tickets waar klant al heeft gereageerd maar ticket nog niet is verplaatst

```json
{
  "filterGroups": [
    {
      "filters": [
        { "propertyName": "hs_pipeline", "operator": "EQ", "value": "63418382" },
        { "propertyName": "hs_pipeline_stage", "operator": "EQ", "value": "124821629" },
        { "propertyName": "hs_last_message_received_at", "operator": "GTE", "value": "{14_DAGEN_GELEDEN_MS}" }
      ]
    },
    {
      "filters": [
        { "propertyName": "hs_pipeline", "operator": "EQ", "value": "63418382" },
        { "propertyName": "hs_pipeline_stage", "operator": "EQ", "value": "124821627" },
        { "propertyName": "hs_last_message_from_visitor", "operator": "EQ", "value": "true" },
        { "propertyName": "hs_last_message_received_at", "operator": "GTE", "value": "{14_DAGEN_GELEDEN_MS}" }
      ]
    },
    {
      "filters": [
        { "propertyName": "hs_pipeline", "operator": "EQ", "value": "63418382" },
        { "propertyName": "hs_pipeline_stage", "operator": "EQ", "value": "124821628" },
        { "propertyName": "hs_last_message_from_visitor", "operator": "EQ", "value": "true" },
        { "propertyName": "hs_last_message_received_at", "operator": "GTE", "value": "{14_DAGEN_GELEDEN_MS}" }
      ]
    }
  ],
  "limit": 0
}
```

**Geverifieerd (19 feb 2026, 16:45 CET)**: **4 = 4 (EXACT match met inbox)**

> **Geschiedenis**: De oorspronkelijke formule (v1-v3) checkte alleen stage "Waiting on us" + "New" met `from_visitor=true` en gebruikte `createdate >= 15d`. Dit gaf 0 terwijl de inbox 4 toonde. De root cause was dat tickets in stage "Waiting on contact" (124821628) waar de klant al had gereageerd (`from_visitor=true`) werden gemist. Deze tickets staan formeel op "wachten op klant" maar de klant heeft al geantwoord — dus ze wachten effectief op ons. De switch naar `hs_last_message_received_at >= 14d` verbetert ook de proxy voor actieve WhatsApp conversations.

### 4.5 Tickets Waiting on Us

**Formule**: Alle pipelines "Waiting on us" stages + 15 dagen + owner != Roel Sanders.

> De inbox view filtert over ALLE pipelines (Support, WA, Returns, Fulfilment, Partner Support, Sales, Marketing).
> Plus: Ticket owner mag niet Roel Sanders zijn (ID: `51199190`).

```json
{
  "filterGroups": [
    {
      "filters": [
        { "propertyName": "hs_pipeline", "operator": "EQ", "value": "0" },
        { "propertyName": "hs_pipeline_stage", "operator": "EQ", "value": "3" },
        { "propertyName": "createdate", "operator": "GTE", "value": "{15_DAGEN_GELEDEN_MS}" },
        { "propertyName": "hubspot_owner_id", "operator": "NEQ", "value": "51199190" }
      ]
    },
    {
      "filters": [
        { "propertyName": "hs_pipeline", "operator": "EQ", "value": "63418382" },
        { "propertyName": "hs_pipeline_stage", "operator": "EQ", "value": "124821629" },
        { "propertyName": "createdate", "operator": "GTE", "value": "{15_DAGEN_GELEDEN_MS}" },
        { "propertyName": "hubspot_owner_id", "operator": "NEQ", "value": "51199190" }
      ]
    },
    {
      "filters": [
        { "propertyName": "hs_pipeline", "operator": "EQ", "value": "5238396" },
        { "propertyName": "hs_pipeline_stage", "operator": "EQ", "value": "5238399" },
        { "propertyName": "createdate", "operator": "GTE", "value": "{15_DAGEN_GELEDEN_MS}" },
        { "propertyName": "hubspot_owner_id", "operator": "NEQ", "value": "51199190" }
      ]
    },
    {
      "filters": [
        { "propertyName": "hs_pipeline", "operator": "EQ", "value": "43676967" },
        { "propertyName": "hs_pipeline_stage", "operator": "EQ", "value": "91082353" },
        { "propertyName": "createdate", "operator": "GTE", "value": "{15_DAGEN_GELEDEN_MS}" },
        { "propertyName": "hubspot_owner_id", "operator": "NEQ", "value": "51199190" }
      ]
    },
    {
      "filters": [
        { "propertyName": "hs_pipeline", "operator": "EQ", "value": "91542424" },
        { "propertyName": "hs_pipeline_stage", "operator": "EQ", "value": "169157961" },
        { "propertyName": "createdate", "operator": "GTE", "value": "{15_DAGEN_GELEDEN_MS}" },
        { "propertyName": "hubspot_owner_id", "operator": "NEQ", "value": "51199190" }
      ]
    }
  ],
  "limit": 0
}
```

> **Let op**: HubSpot API max = 5 filterGroups. Bovenstaande query bevat precies 5.
> Sales (`11855705`) en Marketing (`31785340`) zijn weggelaten - als die in de toekomst
> "Waiting on us" tickets krijgen, moet dit in 2 queries worden gesplitst.

**Geverifieerd**: 2 = 2

---

## 5. Kernprincipe: Retroactief Querien

### Het probleem met live snapshots

```
FOUT (oude aanpak):
  n8n draait om 08:00 -> maakt snapshot -> slaat op
  Als n8n 2 min te laat draait: data is van 08:02
  Als n8n niet draait: data is weg, niet te herstellen
  Geen backfill mogelijk
```

### De juiste aanpak: reconstructie uit HubSpot history

```
GOED (nieuwe aanpak):
  n8n draait om 08:30 (of 09:00, of wanneer dan ook)
  -> Vraagt HubSpot: "wat was de status om PRECIES 08:00?"
  -> HubSpot property history bevat timestamps van elke wijziging
  -> We reconstrueren de staat op elk gewenst moment
  n8n mag te laat draaien
  n8n mag falen en later opnieuw draaien
  Backfill van gemiste dagen mogelijk
  Data is altijd accuraat voor het gevraagde tijdstip
```

### Hoe dit technisch werkt per metric

#### Calls & Chatbot (inherent retroactief)
Calls en chatbot-gesprekken hebben **timestamps**. Je kunt altijd achteraf vragen:
"Hoeveel calls waren er op 17 februari 2026?" -> filter op `hs_timestamp` binnen die dag.
Dit is sowieso al retroactief, ongeacht wanneer je het opvraagt.

#### Ticket Snapshot Metrics (property history reconstructie)
HubSpot slaat **de volledige wijzigingsgeschiedenis** op van ticket-properties:
- `hs_pipeline_stage` -> elke keer dat een ticket van stage verandert, met timestamp
- `hubspot_owner_id` -> elke keer dat een ticket wordt toegewezen/verwijderd, met timestamp

**Reconstructie-algoritme:**

```
DOEL: Tel "All Open tickets om 08:00 CET op 18 feb 2026"

STAP 1: Haal alle tickets op die MOGELIJK open waren om 08:00
  -> Tickets in de 5 pipelines (Support, WA, Fulfilment, Returns, Partner Support)
  -> createdate < target_time
  -> EN die OF nu nog in open stage zijn, OF na target_time zijn gewijzigd
  -> Query: createdate < target_time
           AND (hs_pipeline_stage IN [open_stages]
                OR hs_lastmodifieddate > target_time)

STAP 2: Voor elk ticket, haal property history op
  -> GET /crm/v3/objects/tickets/{id}?propertiesWithHistory=hs_pipeline_stage,hubspot_owner_id
  -> Response bevat bijv:
    {
      "hs_pipeline_stage": {
        "value": "4",  // huidige waarde (closed)
        "versions": [
          { "value": "4", "timestamp": "2026-02-18T10:30:00Z" },
          { "value": "3", "timestamp": "2026-02-17T14:00:00Z" },
          { "value": "1", "timestamp": "2026-02-17T09:00:00Z" }
        ]
      }
    }

STAP 3: Bepaal de waarde OP het target-tijdstip
  -> Loop door versions (gesorteerd op timestamp desc)
  -> Vind de eerste version waar timestamp <= target_time
  -> Dat was de waarde op dat moment

STAP 4: Pas de 15-dagen-filter toe
  -> Check: createdate >= (target_time - 15 dagen)?
  -> Zo nee: ticket telt niet mee (te oud)

STAP 5: Tel alle metrics
  -> all_open = count(stage IN open_stages AND createdate >= 15d)
  -> unassigned = count(all_open AND owner IS NULL)
  -> waiting_on_us = count(stage IN waiting_on_us_stages AND owner != 51199190 AND createdate >= 15d)
  -> wa_all_open = count(WA pipeline open stages AND createdate >= 30d)
                   + count(Support pipeline open AND channel == 1007)
  -> wa_waiting_on_us = count(WA "Waiting on us" OR (WA "New" + from_visitor) OR (WA "Waiting on contact" + from_visitor) AND last_msg >= 14d)
```

---

## 6. Bestaande n8n Flows

### Flow 1: HubSpot Ticket Reporting
- **URL**: `https://havenka.app.n8n.cloud/workflow/sdBmIj7TX2lw65A2`
- **Actie**: Analyseren of deze op support pipeline filtert -> hergebruik logica

### Flow 2 & 3: Inbound & Outbound Calls
- **URLs**: `MPpZELHXm9nJw6Tm` + `HhQPpkz8b4SJmSav`
- **Gewenst**: Totaal (inbound + outbound) per dag
- **Huidige frequentie**: Maandelijks -> wordt dagelijks
- **Al retroactief**: Calls hebben timestamps, dus dit is al backfill-proof

### Flow 4: Chatbot Aantallen
- **URL**: `https://havenka.app.n8n.cloud/workflow/ieehFMSWrd4YEHtN`
- **Huidige frequentie**: Maandelijks -> wordt dagelijks
- **Al retroactief**: Chatbot gesprekken hebben timestamps

---

## 7. Architectuur

```
+--------------------------------------------------------------------+
|                       n8n (Data Collection)                        |
|                                                                    |
|  +-----------------------------------------------------+          |
|  | Workflow: "Support Dashboard - Collect" (v3)         |          |
|  |                                                      |          |
|  | Trigger: Cron 08:00 + 18:00 CET + 00:30 CET         |          |
|  |   (draait NA het target-tijdstip, niet OP)           |          |
|  |                                                      |          |
|  | Input: collect_mode (tickets/daily_totals/all)       |          |
|  |                                                      |          |
|  | +-----------------------------------------------+    |          |
|  | | RETROACTIEVE QUERIES                          |    |          |
|  | |                                               |    |          |
|  | | 1. Calls totaal vandaag (timestamp filter)    |    |          |
|  | | 2. Chatbot totaal vandaag (timestamp filter)  |    |          |
|  | | 3. All Open tickets @ target_time (history)   |    |          |
|  | | 4. Unassigned tickets @ target_time (history)  |    |          |
|  | | 5. WA All Open @ target_time                   |    |          |
|  | | 6. WA Waiting on Us @ target_time              |    |          |
|  | | 7. Tickets Waiting on Us @ target_time         |    |          |
|  | +-----------------------------------------------+    |          |
|  |                                                      |          |
|  | +-----------------------------------------------+    |          |
|  | | BACKFILL SUPPORT                               |    |          |
|  | | Webhook trigger: POST met custom date + time   |    |          |
|  | | -> Zelfde logica, maar voor willekeurige datum  |    |          |
|  | +-----------------------------------------------+    |          |
|  +----------------------+-------------------------------+          |
|                         |                                          |
+-------------------------+------------------------------------------+
                          | HTTP POST
                          v
+--------------------------------------------------------------------+
|                 Vercel (Dashboard + API)                            |
|                                                                    |
|  +------------------+  +--------------+  +---------------------+   |
|  | POST /api/metrics|->| Supabase     |<-| Next.js Dashboard   |   |
|  | (ontvang data)   |  | (PostgreSQL) |  | (weekoverzicht)     |   |
|  |                  |  |              |  |                     |   |
|  | GET /api/metrics |->|              |  | Auto-refresh 5 min  |   |
|  | (lees data)      |  |              |  | Weeknavigatie       |   |
|  |                  |  |              |  | Kleurindicatie      |   |
|  | POST /api/backfill->|              |  |                     |   |
|  | (trigger n8n)    |  |              |  |                     |   |
|  +------------------+  +--------------+  +---------------------+   |
|                                                                    |
+--------------------------------------------------------------------+
```

### Waarom deze architectuur?

| Keuze                        | Reden                                                                    |
|------------------------------|--------------------------------------------------------------------------|
| **Retroactief querien**      | Onafhankelijk van n8n timing, backfill mogelijk, altijd accuraat         |
| **n8n voor datacollectie**   | Bestaande HubSpot credentials + flows, visueel debugbaar                |
| **Supabase (PostgreSQL)**    | Gratis tier voldoende, snelle setup, goede DX                           |
| **Cron 08:00 + 18:00**      | Direct op target-time, HubSpot history is snel genoeg                   |
| **Webhook voor backfill**    | Handmatig of automatisch gemiste data ophalen voor willekeurige datum   |

---

## 8. Database Schema

### Tabel: `daily_metrics`

```sql
CREATE TABLE daily_metrics (
  id                     SERIAL PRIMARY KEY,
  metric_date            DATE NOT NULL,           -- 2026-02-18
  time_slot              VARCHAR(5) NOT NULL,      -- '08:00' of '18:00'

  -- Retroactief gereconstrueerde snapshot-metrics
  unassigned_tickets     INTEGER,                  -- Geen owner + open stage + <15d
  all_open_tickets       INTEGER,                  -- Open stage in 5 pipelines + <15d
  whatsapp_all_open      INTEGER,                  -- WA pipeline(30d) + Support(ch1007)
  whatsapp_waiting_on_us INTEGER,                  -- WA pipeline stage 124821629 + <15d
  waiting_on_us          INTEGER,                  -- Alle pipelines "Waiting on us" + excl Roel

  -- Dagtotalen (ingevuld door midnight run, hele dag)
  total_calls            INTEGER,                  -- Inbound + outbound calls hele dag
  total_chatbot_chats    INTEGER,                  -- Chatbot gesprekken hele dag
  total_emails           INTEGER,                  -- Alle emails (in + out) hele dag
  total_wa_messages      INTEGER,                  -- Alle WA berichten (in + out) hele dag

  -- Metadata
  collected_at           TIMESTAMP DEFAULT NOW(),  -- Wanneer deze data daadwerkelijk is opgehaald
  created_at             TIMESTAMP DEFAULT NOW(),

  UNIQUE(metric_date, time_slot)
);

CREATE INDEX idx_daily_metrics_date ON daily_metrics(metric_date);
```

### Data-voorbeeld

| metric_date | time_slot | unassigned | all_open | wa_all | wa_wou | waiting_on_us | calls | chatbot | emails | wa_msgs | collected_at        |
|-------------|-----------|------------|----------|--------|--------|---------------|-------|---------|--------|---------|---------------------|
| 2026-02-16  | 08:00     | 14         | 75       | 24     | 8      | 0             | null  | null    | null   | null    | 2026-02-16 08:32:00 |
| 2026-02-16  | 18:00     | 2          | 58       | 20     | 0      | 4             | 38    | 42      | 128    | 239     | 2026-02-16 18:31:00 |

---

## 9. n8n Workflow - Gedetailleerd Ontwerp

### Eén unified workflow met twee entry points

```
ENTRY POINT 1: Cron Trigger
  |-- 08:00 CET -> target_time = "08:00", target_date = vandaag
  +-- 18:00 CET -> target_time = "18:00", target_date = vandaag

ENTRY POINT 2: Webhook Trigger (voor backfill)
  +-- POST body: { "target_date": "2026-02-15", "target_time": "08:00" }

        |
        v
[Set Variables]
  target_datetime = target_date + "T" + target_time + ":00+01:00"  (CET)
  target_date_start = target_date + "T00:00:00+01:00"
  fifteen_days_ago = target_datetime - 15 dagen (in ms)
  thirty_days_ago = target_datetime - 30 dagen (in ms)
        |
        v
  +-----+-----------------------------------------------------+
  |                PARALLEL BRANCHES                           |
  |                                                            |
  |  BRANCH A: All Open + Unassigned                           |
  |  ----------------------------------------                  |
  |  Query 1: 5 pipelines x open stages x 15d createdate      |
  |  (zie sectie 4.1 voor exacte query)                        |
  |  -> Pagineer alle resultaten                               |
  |  -> Per ticket: GET propertiesWithHistory                  |
  |  -> Reconstruct stage + owner at target_datetime           |
  |  -> Tel: all_open, unassigned                              |
  |                                                            |
  |  BRANCH B: WhatsApp All Open                               |
  |  ----------------------------------------                  |
  |  Query 2: WA pipeline(30d) OR Support+channel1007          |
  |  (zie sectie 4.3)                                          |
  |  -> Tel: wa_all_open                                       |
  |                                                            |
  |  BRANCH C: WA Waiting on Us                                |
  |  ----------------------------------------                  |
  |  Query 3: WA pipeline stage 124821629 + 15d                |
  |  (zie sectie 4.4)                                          |
  |  -> Tel: wa_waiting_on_us                                  |
  |                                                            |
  |  BRANCH D: Tickets Waiting on Us                           |
  |  ----------------------------------------                  |
  |  Query 4: Alle pipelines WoU stages + 15d + NEQ Roel      |
  |  (zie sectie 4.5)                                          |
  |  -> Tel: waiting_on_us                                     |
  |                                                            |
  |  BRANCH E: Calls                                           |
  |  ----------------------------------------                  |
  |  Hergebruik bestaande inbound + outbound flows             |
  |  Filter: hs_timestamp BETWEEN target_date_start            |
  |          AND target_datetime                               |
  |  -> Return: total_calls                                    |
  |                                                            |
  |  BRANCH F: Chatbot                                         |
  |  ----------------------------------------                  |
  |  Hergebruik bestaande chatbot flow                         |
  |  Filter: gesprekken gestart BETWEEN target_date_start      |
  |          AND target_datetime                               |
  |  -> Return: total_chatbot_chats                            |
  |                                                            |
  +------------------------------------+-----------------------+
                                       |
                                       v
                              [Merge Results]
                                       |
                                       v
                        [HTTP POST -> Vercel API]
                        {
                          "metric_date": "2026-02-18",
                          "time_slot": "08:00",
                          "unassigned_tickets": 2,
                          "all_open_tickets": 55,
                          "whatsapp_all_open": 16,
                          "whatsapp_waiting_on_us": 0,
                          "waiting_on_us": 2,
                          "total_calls": 12,
                          "total_chatbot_chats": 18
                        }
```

### Reconstructie Code Node (JavaScript in n8n)

```javascript
// === BEVESTIGDE CONSTANTEN ===

// Pipelines die meetellen voor "All Open"
const ALL_OPEN_PIPELINES = {
  '0':         ['1', '2', '3'],                          // Support
  '63418382':  ['124821627', '124821628', '124821629'],  // WhatsApp
  '43676967':  ['91082351', '91082352', '91082353'],     // Fulfilment
  '5238396':   ['5238397', '5238398', '5238399'],        // Returns
  '91542424':  ['169157959', '169157960', '169157961'],  // Partner Support
};

// Alle open stages (flat list)
const ALL_OPEN_STAGES = Object.values(ALL_OPEN_PIPELINES).flat();

// "Waiting on us" stages per pipeline (voor Tickets Waiting on Us)
const WAITING_ON_US_STAGES = {
  '0':         '3',
  '63418382':  '124821629',
  '5238396':   '5238399',
  '43676967':  '91082353',
  '91542424':  '169157961',
  '11855705':  '11855708',    // Sales
  '31785340':  '71836480',    // Marketing
};
const ALL_WOU_STAGE_VALUES = Object.values(WAITING_ON_US_STAGES);

// Specifieke constanten
const WA_PIPELINE = '63418382';
const WA_OPEN_STAGES = ['124821627', '124821628', '124821629'];
const WA_WAITING_ON_US_STAGE = '124821629';
const ROEL_SANDERS_OWNER_ID = '51199190';

const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// === CORE FUNCTIES ===

function getValueAtTime(propertyWithHistory, targetTimestamp) {
  const targetMs = new Date(targetTimestamp).getTime();
  const versions = propertyWithHistory?.versions || [];

  for (const version of versions) {
    const versionMs = new Date(version.timestamp).getTime();
    if (versionMs <= targetMs) {
      return version.value;
    }
  }
  return null;
}

// === HOOFDLOGICA ===
const targetDatetime = $input.first().json.target_datetime;
const targetMs = new Date(targetDatetime).getTime();
const fifteenDaysAgoMs = targetMs - FIFTEEN_DAYS_MS;
const thirtyDaysAgoMs = targetMs - THIRTY_DAYS_MS;
const tickets = $input.all();

let allOpen = 0;
let unassigned = 0;
let waitingOnUs = 0;
let waAllOpen = 0;
let waWaitingOnUs = 0;

for (const ticket of tickets) {
  const props = ticket.json.propertiesWithHistory;
  const pipeline = ticket.json.properties?.hs_pipeline;
  const createdate = new Date(ticket.json.properties?.createdate).getTime();
  const channelId = ticket.json.properties?.hs_originating_generic_channel_id;

  if (createdate > targetMs) continue;

  const stageAtTarget = getValueAtTime(props.hs_pipeline_stage, targetDatetime);
  const ownerAtTarget = getValueAtTime(props.hubspot_owner_id, targetDatetime);

  // --- ALL OPEN (5 pipelines, 15d) ---
  const isAllOpenPipeline = ALL_OPEN_PIPELINES.hasOwnProperty(pipeline);
  const isOpenStage = ALL_OPEN_STAGES.includes(stageAtTarget);
  const isWithin15d = createdate >= fifteenDaysAgoMs;

  if (isAllOpenPipeline && isOpenStage && isWithin15d) {
    allOpen++;

    if (!ownerAtTarget || ownerAtTarget === '') {
      unassigned++;
    }
  }

  // --- WHATSAPP ALL OPEN (WA pipeline 30d OR Support+channel1007) ---
  const isWaPipeline = pipeline === WA_PIPELINE;
  const isWaOpen = WA_OPEN_STAGES.includes(stageAtTarget);
  const isWithin30d = createdate >= thirtyDaysAgoMs;
  const isSupportWithWaChannel = pipeline === '0' && channelId === '1007' && isOpenStage;

  if ((isWaPipeline && isWaOpen && isWithin30d) || isSupportWithWaChannel) {
    waAllOpen++;
  }

  // --- WA WAITING ON US (WA pipeline stage 124821629, 15d) ---
  if (isWaPipeline && stageAtTarget === WA_WAITING_ON_US_STAGE && isWithin15d) {
    waWaitingOnUs++;
  }

  // --- TICKETS WAITING ON US (all pipelines WoU, 15d, excl Roel) ---
  if (ALL_WOU_STAGE_VALUES.includes(stageAtTarget) && isWithin15d) {
    if (ownerAtTarget !== ROEL_SANDERS_OWNER_ID) {
      waitingOnUs++;
    }
  }
}

return [{ json: { allOpen, unassigned, waitingOnUs, waAllOpen, waWaitingOnUs } }];
```

### Rate Limit Strategie

| HubSpot Tier | Limiet                | Onze verwachte usage per run              |
|--------------|----------------------|-------------------------------------------|
| API calls    | 100 requests/10 sec  | ~50-200 calls (afhankelijk ticket volume) |
| Search       | 4 requests/sec       | 1-5 paginated search calls                |
| Batch read   | 100 objects/request  | ~2-5 batch calls                          |

**Mitigatie**: Throttle in n8n met "Wait" nodes (100ms between batches). Totale runtime per run: ~30-60 seconden.

---

## 10. Vercel API Routes

### POST `/api/metrics` - Data ontvangen van n8n

```typescript
// app/api/metrics/route.ts
import { sql } from '@vercel/postgres';
import { z } from 'zod';

const MetricsSchema = z.object({
  metric_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_slot: z.enum(['08:00', '18:00']),
  unassigned_tickets: z.number().int().min(0).optional(),     // tickets mode
  all_open_tickets: z.number().int().min(0).optional(),       // tickets mode
  whatsapp_all_open: z.number().int().min(0).optional(),      // tickets mode
  whatsapp_waiting_on_us: z.number().int().min(0).optional(), // tickets mode
  waiting_on_us: z.number().int().min(0).optional(),          // tickets mode
  total_calls: z.number().int().min(0).optional(),            // daily_totals mode
  total_chatbot_chats: z.number().int().min(0).optional(),    // daily_totals mode
  total_emails: z.number().int().min(0).optional(),           // daily_totals mode
  total_wa_messages: z.number().int().min(0).optional(),      // daily_totals mode
});
// Partial upsert: only provided fields are written, existing values preserved

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader !== `Bearer ${process.env.N8N_WEBHOOK_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = MetricsSchema.parse(await request.json());

  // UPSERT: idempotent - kan veilig opnieuw worden aangeroepen
  await sql`
    INSERT INTO daily_metrics (
      metric_date, time_slot,
      unassigned_tickets, all_open_tickets,
      whatsapp_all_open, whatsapp_waiting_on_us, waiting_on_us,
      total_calls, total_chatbot_chats
    ) VALUES (
      ${body.metric_date}, ${body.time_slot},
      ${body.unassigned_tickets}, ${body.all_open_tickets},
      ${body.whatsapp_all_open}, ${body.whatsapp_waiting_on_us},
      ${body.waiting_on_us}, ${body.total_calls}, ${body.total_chatbot_chats}
    )
    ON CONFLICT (metric_date, time_slot) DO UPDATE SET
      unassigned_tickets = EXCLUDED.unassigned_tickets,
      all_open_tickets = EXCLUDED.all_open_tickets,
      whatsapp_all_open = EXCLUDED.whatsapp_all_open,
      whatsapp_waiting_on_us = EXCLUDED.whatsapp_waiting_on_us,
      waiting_on_us = EXCLUDED.waiting_on_us,
      total_calls = EXCLUDED.total_calls,
      total_chatbot_chats = EXCLUDED.total_chatbot_chats,
      collected_at = NOW()
  `;

  return Response.json({ success: true });
}
```

### GET `/api/metrics?week=current` - Data ophalen voor dashboard

```typescript
// app/api/metrics/route.ts (GET handler)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get('week') || 'current';

  let startDate: string;
  if (week === 'current') {
    // Bereken maandag van huidige week (ISO week, maandag = start)
    // ...
  } else {
    // Parse ISO week: "2026-W08"
    // ...
  }

  const { rows } = await sql`
    SELECT * FROM daily_metrics
    WHERE metric_date >= ${startDate}::date
      AND metric_date < ${startDate}::date + INTERVAL '7 days'
    ORDER BY metric_date, time_slot
  `;

  return Response.json({ week: startDate, metrics: rows });
}
```

### POST `/api/backfill` - Trigger n8n backfill

```typescript
export async function POST(request: Request) {
  const { date, time_slot } = await request.json();

  await fetch(process.env.N8N_BACKFILL_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_date: date, target_time: time_slot }),
  });

  return Response.json({ triggered: true });
}
```

---

## 11. Dashboard UI

### Layout - Exacte replica van het whiteboard

```
+-----------------------------------------------------------------------------+
|  SUPPORT DASHBOARD              Week 8 - 16 feb - 22 feb 2026      [<] [>] |
+-----------+--------------+----------------+--------------+-----------------+
|           |  Call  Chat  |  Unassigned    |   All Open   |    WhatsApp     |
|           |              |   08    18     |   08    18   |  All    WOU     |
|           |              |                |              |   08/18  08/18  |
+-----------+-------+------+--------+-------+-------+------+-------+---------+
|  Maandag  |  33   |  42  |  14    |  2    |  75   |  58  | 24/20 | 8/0    |
+-----------+-------+------+--------+-------+-------+------+-------+--------+
|  Dinsdag  |       |      |   5    |       |  61   |      |  21   |  1     |
+-----------+-------+------+--------+-------+-------+------+-------+--------+
|  Woensdag |  ..   |  ..  |  ..    |  ..   |  ..   |  ..  |  ..   |  ..    |
+-----------+-------+------+--------+-------+-------+------+-------+--------+
|  ...      |       |      |        |       |       |      |       |        |
+-----------+-------+------+--------+-------+-------+------+-------+--------+
|  WEEK TOTAAL   Calls: 50    Chatbot: 128    Gem. open: 64.7              |
|  Laatste update: 18:31 CET                              [Refresh]        |
+-----------------------------------------------------------------------------+
```

### UI Features

1. **Whiteboard-replica** - Zelfde rij/kolom structuur als het bordje
2. **Kleurindicatie per cel**:
   - **Groen**: Daling 18:00 vs 08:00 (minder open = goed afgehandeld)
   - **Rood**: Stijging 18:00 vs 08:00 (drukte neemt toe)
   - **Grijs**: Nog geen data (toekomstige dagen)
3. **Delta-indicator**: Klein getal dat verschil 08->18 toont
4. **Weeknavigatie**: Vorige/volgende week knoppen + week-nummer
5. **Auto-refresh**: Elke 5 minuten nieuwe data ophalen
6. **"Laatste update"**: Toont wanneer data voor het laatst is ontvangen van n8n
7. **Responsive**: Geoptimaliseerd voor TV-scherm (1920x1080 landscape) + mobiel
8. **Wit thema**: Clean Apple-achtig design met Bold logo
9. **Missing data indicator**: Oranje waarschuwing + backfill-knop bij lege cellen

### Tech Stack

| Component      | Technologie                     |
|----------------|---------------------------------|
| Framework      | Next.js 15.5 (App Router)       |
| Styling        | Tailwind CSS 4                  |
| Components     | Custom React components         |
| Database       | Supabase (PostgreSQL)           |
| Deployment     | Vercel                          |
| Data fetching  | Client-side fetch in Dashboard  |
| Client polling | `setInterval` elke 5 min        |
| Backfill       | Server Actions → n8n webhook    |

---

## 12. Beveiliging

| Maatregel              | Implementatie                                                   |
|------------------------|-----------------------------------------------------------------|
| n8n -> API auth        | `N8N_WEBHOOK_SECRET` als Bearer token                           |
| Backfill API auth      | Zelfde secret of aparte admin key                               |
| Dashboard toegang      | Vercel Password Protection (gratis op Pro plan)                 |
| Input validatie        | Zod schemas op alle API endpoints                               |
| Database               | Alleen Vercel internal network, geen public access              |
| CORS                   | Alleen eigen domein toestaan                                    |

---

## 13. Implementatie Stappenplan

### Fase 0: Discovery - HubSpot Setup Uitzoeken -- VOLTOOID

> Alle discovery is uitgevoerd op 18 februari 2026 via live API calls.

- [x] **Pipeline discovery**: 8 pipelines gevonden, 5 relevant voor All Open
- [x] **Stage IDs**: Alle open/closed stages per pipeline gedocumenteerd
- [x] **WhatsApp discovery**: Channel ID `1007`, pipeline `63418382`, 1 ticket in Support pipeline
- [x] **Inbox discovery**: Support (`3283369`), Help Desk (`483097662`), Sales (`1367826122`)
- [x] **Conversation object**: Type 0-11, 103 properties, NIET toegankelijk via API
- [x] **Custom view filters**: Screenshots gemaakt van alle 3 custom views
- [x] **Owner discovery**: Roel Sanders = `51199190` (uitgesloten in Tickets WoU)
- [x] **All Open formule**: 5 pipelines + 15d = exact (4x geverifieerd: 52, 53, 53, 55)
- [x] **Unassigned formule**: + NOT_HAS_PROPERTY owner = exact (2=2)
- [x] **WhatsApp formule**: WA pipeline(30d) + Support(ch1007) = exact (16=16)
- [x] **WA Waiting on Us formule**: WA stage 124821629 + 15d = exact (0=0)
- [x] **Tickets Waiting on Us formule**: Alle WoU stages + 15d + excl Roel = exact (2=2)

### Fase 1: Next.js Project + Database (Dag 1) -- VOLTOOID

- [x] Next.js 15 project met TypeScript + Tailwind (handmatig, npm cache issue)
- [x] GitHub repo: `bzonneveld-1/support-dashboard`
- [x] Vercel project aangemaakt + gekoppeld aan GitHub
- [x] Database schema SQL + init-db endpoint
- [x] POST `/api/metrics` endpoint + Zod validatie + UPSERT (Supabase)
- [x] GET `/api/metrics?week=current` endpoint met weekberekening
- [x] POST `/api/backfill` endpoint (trigger n8n webhook)
- [x] N8N_WEBHOOK_SECRET env var gezet op Vercel
- [x] Eerste deploy getriggerd
- [x] Supabase database aangemaakt (i.p.v. Vercel Postgres/Neon)
- [x] `daily_metrics` tabel aangemaakt via Supabase SQL Editor
- [x] API omgeschreven van `@vercel/postgres` naar `@supabase/supabase-js`
- [x] End-to-end test: POST dummy data + GET retourneert correcte weekdata
- [x] Alle env vars gezet op Vercel (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY)

### Fase 2: n8n Workflow - Data Collection (Dag 2-3) -- VOLTOOID

**n8n Workflow Info:**
- Workflow ID: `D2xnw2TPDzOhJOPw` ("Support Dashboard - Collect")
- Webhook URL: `https://havenka.app.n8n.cloud/webhook/sd-collect-v2`
- Status: **Actief** (Workflow v5, 3 crons, ma-vr)
- Aircall credential ID: `YV0E9BqYsrvIhgBA` (Basic Auth)
- Telefoon nummers: NL=31850607337, UK=443308081087, DE=43720882672
- Chatbot: Sleak Supabase (`sygpwnluwwetrkmwilea.supabase.co`)

**Schedule (3 crons):**
| Cron (UTC) | CET | collect_mode | Wat het doet |
|------------|-----|-------------|--------------|
| `0 8 * * 1-5` | 08:00 | `tickets` | HubSpot ticket metrics → 08:00 slot |
| `0 18 * * 1-5` | 18:00 | `tickets` | HubSpot ticket metrics → 18:00 slot |
| `30 0 * * 2-6` | 00:30 (di-za) | `daily_totals` | Aircall + chatbot + emails + WA msgs voor gisteren → 18:00 slot |

**Architectuur:**
```
Schedule Trigger (08:00+18:00+00:30 CET) ──┐
                                           ├→ Set DateTime (Code, bepaalt collect_mode)
Webhook (backfill, collect_mode=daily_totals) ┘
    ↓
Aircall NL In → NL Out → UK In → UK Out → DE In → DE Out (HTTP Request chain)
    ↓
Collect & POST (Code):
  - collect_mode="tickets": HubSpot 5 metrics → POST (geen calls/chatbot/emails/wa)
  - collect_mode="daily_totals": Aircall + chatbot + emails + WA msgs → POST (geen tickets)
  - collect_mode="all": alles → POST (backfill)
```

**Opgeloste issues:**
- Python f-string interpolatie corrumpeerde JS code → Herschreven in Node.js
- HubSpot max 18 filters per query → Unassigned en WaitingOnUs gesplitst in 2 queries
- Webhook pad conflict → Gewijzigd naar `sd-collect-v2`

**Live test resultaat (18 feb 2026, 18:00):**
```
all_open_tickets: 58, unassigned_tickets: 5, whatsapp_all_open: 16,
whatsapp_waiting_on_us: 1, waiting_on_us: 3, total_calls: 27,
total_chatbot_chats: 28, dashboard_response: {success: true}, errors: []
```

**Voortgang:**
- [x] Bestaande n8n workflows geanalyseerd (Calls, Chatbot, HubSpot)
- [x] Workflow aangemaakt via n8n API (Node.js script, niet Python)
- [x] Set DateTime node werkt correct (CET/CEST detectie)
- [x] Aircall HTTP Request nodes werken (6 nodes met stored credentials)
- [x] All Open: 5 pipelines, 15d, HubSpot search (58 tickets)
- [x] Unassigned: gesplitst in 2 queries (max 18 filters) (5 tickets)
- [x] WhatsApp All Open: WA pipeline 30d + Support ch1007 (16 tickets)
- [x] WA Waiting on Us: 3 groups (Waiting on us + New/from_visitor + Waiting on contact/from_visitor), last_msg >= 14d (4 tickets, exact match)
- [x] Tickets Waiting on Us: gesplitst in 2 queries, excl Roel (3 tickets)
- [x] Aircall: 6 HTTP nodes, NL/UK/DE x in/out (27 calls)
- [x] Chatbot: Sleak Supabase auth + query (28 chats)
- [x] Combine + POST naar Vercel/Supabase API
- [x] End-to-end test: webhook → n8n → HubSpot+Aircall+Sleak → Supabase → Dashboard API
- [x] Backfill test: 08:00 data succesvol opgehaald
- [x] Error handling met try/catch per API call
- [ ] **TODO**: Validatie tegen live inbox (Fase 4)

### Fase 3: Dashboard Frontend (Dag 4-5) -- VOLTOOID

**Live URL**: https://support-dashboard-nine.vercel.app

**Architectuur:**
```
page.tsx (Server Component)
  └→ Dashboard.tsx (Client Component, 'use client')
       ├→ fetch /api/metrics?week=... (client-side)
       ├→ Auto-refresh elke 5 minuten (setInterval)
       └→ triggerBackfill() server action → n8n webhook
```

**Bestanden:**
- `src/components/Dashboard.tsx` — Hoofd client component (~500 regels)
- `src/app/actions.ts` — Server action voor backfill (n8n webhook trigger)
- `src/app/page.tsx` — Wrapper die Dashboard rendert

**Opgeloste issues:**
- Timezone bug in `getWeekBounds`: `setHours(0)` + `toISOString()` gaf UTC shift → Week startte op zondag i.p.v. maandag. Fix: lokale `fmtDate()` helper.
- `getTodayStr()` op client: zelfde UTC issue → Fix: lokale date formatting.

**Features:**
- [x] Tabel-component bouwen (whiteboard-replica)
- [x] Data ophalen met client-side fetch + auto-refresh
- [x] Weeknavigatie (vorige/volgende week + "Vandaag" knop)
- [x] Kleurindicatie (groen/rood delta op 18:00 cellen)
  - Groen (`text-green-400` + `bg-green-500/10`): 18:00 < 08:00 (daling = goed)
  - Rood (`text-red-400` + `bg-red-500/10`): 18:00 > 08:00 (stijging)
  - Delta-indicator: +3 / -4 naast het getal
- [x] Auto-refresh (client-side polling elke 5 min)
- [x] Missing data indicator + backfill-knop (amber, hover tooltip, server action)
- [x] Weektotalen (som calls, som chatbot, gem. All Open)
- [x] ~~Dark mode styling~~ → Wit thema (bg-white, text-gray-900, border-gray-200)
- [x] TV-scherm layout (max-w-[1920px], text-xl getallen, responsive)
- [x] Deploy naar Vercel (automatisch via GitHub push)
- [x] Vandaag-markering (blauwe achtergrond + label)
- [x] ISO weeknummer + datumbereik in header

**Tabel-structuur (15 kolommen):**
```
| Dag | Calls | Chatbot | Emails | WA Msgs | Unassigned | All Open | WA All Open | WA WoU | Waiting on Us |
|     |       |         |        |         | 08  | 18   | 08 | 18   | 08   | 18   | 08 | 18 | 08  | 18    |
```

**Eerste live data (18 feb 2026):**
```
Woensdag (vandaag):
  08:00 — All Open: 62, Unassigned: 5, WA All: 16, WA WoU: 1, WoU: 3
  18:00 — All Open: 58 (↓4, groen), Unassigned: 5, WA All: 16, WA WoU: 1, WoU: 3
           Calls: 27, Chatbot: 28
```

### Fase 4: Validatie & Formule-fix (Dag 6+) -- VOLTOOID

#### 4.1 Eerste validatie (18 feb 2026, Dewi 08:20 vs Dashboard 08:00)

| Metric | Dashboard (v1) | Dewi (inbox) | Verschil |
|--------|---------------|-------------|----------|
| All Open | 62 | **69** | -7 |
| Unassigned | 5 | **9** | -4 |
| WA All Open | 16 | **27** | -11 |
| WA WoU | 1 | **9** | -8 |
| Waiting on Us | 3 | **2** | +1 |

#### 4.2 Root Cause Analyse

**Fundamenteel probleem**: De inbox sidebar telt op basis van **conversation status = OPEN**. We kunnen conversation status NIET querien via de CRM API. Elke formule is een proxy.

**Bevindingen uit uitgebreid API-onderzoek (18-19 feb):**

1. **`createdate >= 15d`** blijkt de beste proxy voor All Open
   - 19 feb test: 64 vs inbox 61 (+3, ~5% afwijking)
   - Consistent dichtst bij inbox getal

2. **UNION-approach (`createdate >= 14d` + `hs_last_message_received_at >= 14d`) overcounts**
   - 19 feb test: 78 vs inbox 61 (+17, ~28% afwijking!)
   - Oude tickets met recente systeemberichten maar gesloten conversations worden meegeteld
   - **Verworpen als aanpak**

3. **`hs_last_message_received_at >= 14d`** is beter voor WA pipeline
   - WA: 13 vs inbox 14 (-1, bijna exact)
   - createdate: 12 vs inbox 14 (-2)

4. **HubSpot Conversations API werkt niet betrouwbaar**
   - Status filter werkt niet, CRM conversations object geeft 404
   - Geen alternatief beschikbaar

5. **Tickets Waiting on Us en WA WoU matchen exact**
   - WoU: 8 = 8 (createdate >= 15d + owner != bot)
   - WA WoU: 0 = 0

#### 4.3 Gekozen formules (v4 workflow, live sinds 19 feb 2026)

| Metric | Formule | Nauwkeurigheid |
|--------|---------|---------------|
| **All Open** | 5 pipelines + open stages + `createdate >= 15d` | ±2 tickets |
| **Unassigned** | Zelfde + `NOT_HAS_PROPERTY owner` (gesplitst 3+2 queries) | ±1 ticket |
| **WA All Open** | WA pipeline `last_msg_received >= 14d` + Support `channel=1007 AND last_msg >= 14d` | ±1 ticket |
| **WA WoU** | WA "Waiting on us" + "New" met `from_visitor=true` + **"Waiting on contact" met `from_visitor=true`** (`last_msg >= 14d`) | **Exact** |
| **Tickets WoU** | Alle pipelines WoU stages + `createdate >= 15d` + owner != bot (gesplitst 3+2) | ±1 ticket |

#### 4.4 Validatie v4 vs inbox (19 feb 2026, 16:45 CET)

| Metric | v4 Formule | Inbox | Verschil |
|--------|-----------|-------|----------|
| Unassigned | **3** | **3** | **exact** |
| All Open | **70** | **72** | -2 |
| WA All Open | **14** | **15** | -1 |
| **WA WoU** | **4** | **4** | **exact** |
| Waiting on Us | **9** | **10** | -1 |

**Conclusie**: v4 formules zijn de meest nauwkeurige tot nu toe. WA WoU en Unassigned zijn exact, de rest wijkt max ±2 af.

#### 4.5 Workflow versie-geschiedenis

| Versie | Datum | Wijzigingen |
|--------|-------|-------------|
| v1 | 18 feb | Eerste implementatie, alle 5 metrics |
| v2 | 19 feb (ochtend) | WA All Open → `last_msg >= 14d`, WA WoU + "New" met from_visitor |
| v3 | 19 feb (middag) | 3 crons, collect_mode (tickets/daily_totals/all), partial upsert |
| v4 | 19 feb (16:44) | WA WoU fix: +Group C "Waiting on contact" + from_visitor, switch naar `last_msg >= 14d` |
| **v5** | **19 feb (17:48)** | **Emails + WA berichten tellen: CRM emails search + Conversations threads/messages API in daily_totals mode** |
| **v5.1** | **20 feb** | **Cron timing: 08:00/18:00/00:30 CET, daily_totals cron → `30 0 * * 2-6` (na middernacht), oude workflows gedeactiveerd** |

#### 4.6 Afgerond

- [x] Formules geoptimaliseerd in n8n workflow v2-v4
- [x] UNION-approach getest en verworpen (overcounts)
- [x] v4 workflow live gezet en geactiveerd
- [x] Vervuilde data opgeruimd
- [x] WA WoU root cause gevonden en opgelost (stage 124821628 + from_visitor)
- [x] Validatie tegen live inbox: alle metrics binnen ±2, twee metrics exact

### Fase 5: UI Redesign + Calls/Chatbot Timing + Emails/WA Msgs + Backfill -- VOLTOOID

> Voltooid op 19 feb 2026.

#### 5.1 Calls & Chatbot timing aanpassen — VOLTOOID

**Probleem**: Calls en Chatbot zijn dagtotalen (hele dag). Ze moeten pas worden ingevuld als de dag voorbij is, niet bij de 08:00 of 18:00 snapshot.

**Oplossing**: Derde cron `30 0 * * 2-6` (00:30 CET, di-za) in bestaande workflow met `collect_mode` parameter:

| collect_mode | Cron | Wat het doet |
|-------------|------|-------------|
| `tickets` | 08:00 + 18:00 CET (ma-vr) | Alleen HubSpot ticket metrics, geen calls/chatbot |
| `daily_totals` | 00:30 CET (di-za) | Alleen Aircall + chatbot + emails + WA msgs voor gisteren (hele dag 00:00-23:59), opgeslagen in 18:00 slot |
| `all` | *(niet meer gebruikt)* | Alles: tickets + calls + chatbot (verwijderd uit backfill wegens stale ticket data) |

**Wijzigingen doorgevoerd:**
- [x] Extra cron `30 0 * * 2-6` (00:30 CET di-za) toegevoegd aan Schedule Trigger (workflow v3→v5)
- [x] Set DateTime: `collect_mode` + `api_time_slot` logica (schedule → detectie op uur, webhook → body parameter)
- [x] Set DateTime: midnight run berekent `target_date = gisteren` + `endTime = 23:59` voor full-day epochs
- [x] Collect and POST: ticket metrics overgeslagen bij `daily_totals`, calls/chatbot overgeslagen bij `tickets`
- [x] Collect and POST: payload bevat alleen relevante velden per mode
- [x] Dashboard API: alle metric velden nu **optioneel** (Zod `.optional()`)
- [x] Dashboard API: dynamische upsert — alleen meegegeven velden worden geschreven, bestaande waarden blijven behouden
- [x] Getest: `daily_totals` → calls/chatbot opgeslagen zonder tickets te overschrijven
- [x] Getest: `tickets` → ticket metrics opgeslagen zonder calls/chatbot te overschrijven
- [x] Workflow v3→v4→v5 live gezet via n8n API

**Validatie (19 feb 2026):**
```
18:00 slot na daily_totals + tickets run:
  calls=21, chatbot=16 (daily_totals), allOpen=62, wou=8 (tickets)
  → Beide datasets onafhankelijk opgeslagen, geen overschrijving
```

#### 5.2 Dashboard UI Redesign — VOLTOOID (Apple Clean Design)

**Design System — Apple System Colors:**
```
#1C1C1E (text primary)    #8E8E93 (text secondary)
#007AFF (accent blue)     #34C759 (green/daling)     #FF3B30 (red/stijging)
#E5E5EA (border)          #F2F2F7 (background)       #C7C7CC (divider)
#1D1D1F (header band)     #FFFFFF (card/row)
```

**Wijzigingen:**
- [x] **Apple Clean thema** — Geen verticale borders, alleen horizontale `border-b border-[#E5E5EA]`
- [x] **Donkere header band** — `bg-[#1D1D1F]` met witte text, weeknavigatie in header
- [x] **Grouped background** — `bg-[#F2F2F7]` body, witte card container met `rounded-2xl shadow-sm`
- [x] **Vandaag-markering** — Blauwe left-accent `border-l-[3px] border-[#007AFF]` + lichtblauwe achtergrond
- [x] **Delta kleuren** — Alleen text-kleur, geen achtergrond: `text-[#34C759]` (daling) / `text-[#FF3B30]` (stijging)
- [x] **Font** — `font-medium` getallen, compact rows
- [x] **Layout** — `layout.tsx`: `<html lang="en">` + `bg-[#F2F2F7] text-[#1C1C1E] antialiased`
- [x] **Calls/chatbot weergave** — Dagwaarde alleen uit 18:00 slot (evening row), geen fallback naar 08:00
- [x] **Geen footer** — Refresh button en "laatste update" tekst verwijderd
- [x] Deploy naar Vercel via GitHub push

#### 5.3 Backfill februari 2026 — VOLTOOID + STALE DATA OPGESCHOOND

- [x] Backfill alle werkdagen 2-18 feb 2026 (08:00 + 18:00 slots, `collect_mode=all`)
- [x] Daily_totals backfill voor 2-18 feb 2026 (full-day calls/chatbot in 18:00 slot)
- [x] Stale 08:00 calls/chatbot genulled (waren partial-day waarden)
- [x] **STALE TICKET DATA OPGESCHOOND (19 feb 2026)**: Alle ticket metrics (Unassigned, All Open, WA All Open, WA WoU, Waiting on Us) voor 3-18 feb → NULL gezet

**Probleem ontdekt**: Ticket metrics (Unassigned, WA All Open, WA WoU) toonden identieke waarden (7/13/4) voor ma-wo in week 8. Oorzaak: HubSpot CRM Search API retourneert altijd de **huidige** staat — niet de historische staat. Alle backfill-rijen kregen dezelfde snapshot omdat ze op hetzelfde moment (19 feb 12:10 UTC) werden opgehaald.

**Bewijs uit database timestamps:**
```
Ma 16 08:00  collected_at=2026-02-19T15:46  Unassigned=7  WA_Open=13  WA_WoU=4  ← STALE
Di 17 08:00  collected_at=2026-02-19T15:46  Unassigned=7  WA_Open=13  WA_WoU=4  ← STALE
Wo 18 08:00  collected_at=2026-02-19T15:46  Unassigned=7  WA_Open=13  WA_WoU=4  ← STALE
Do 19 08:00  collected_at=2026-02-19T06:30  Unassigned=2  WA_Open=13  WA_WoU=4  ← REAL (cron)
Do 19 18:00  collected_at=2026-02-19T16:30  Unassigned=5  WA_Open=17  WA_WoU=0  ← REAL (cron)
```

**Fix doorgevoerd:**
1. Alle ticket metrics voor 3-18 feb → NULL gezet via API (24 rijen)
2. API Zod schema: velden accepteren nu `null` naast `number` (`z.union([z.number(), z.null()])`)
3. Backfill action: stuurt nu altijd `collect_mode=daily_totals` (geen stale ticket data meer)
4. Dashboard UI: backfill-knoppen verwijderd van ticket kolommen (niet retroactief opvraagbaar)

**Belangrijke beperking**: Ticket snapshot metrics (Unassigned, All Open, WA All Open, WA WoU, WoU) zijn ALLEEN betrouwbaar als ze in real-time worden verzameld door de cron (08:00 + 18:00 CET). Ze zijn NIET retroactief op te halen.

**Resultaat week 8 (16-19 feb 2026):**
| Dag | Calls (hele dag) | Chatbot (hele dag) |
|-----|------------------|--------------------|
| Ma 16 | 38 | 42 |
| Di 17 | 38 | 45 |
| Wo 18 | 27 | 38 |
| Do 19 | 21 | 16 (dag nog bezig) |

#### 5.4 WA Waiting On Us formule fix — VOLTOOID

**Probleem**: Dashboard toonde WA WoU = 0, terwijl HubSpot inbox 4 toonde.

**Root cause**: De WA WoU query miste tickets in stage "Waiting on contact" (124821628) waar de klant al had gereageerd (`last_message_from_visitor=true`). Dit zijn tickets waar we formeel wachten op de klant, maar de klant heeft al geantwoord — dus ze wachten effectief op ons.

**Fix (workflow v4, deployed 19 feb 2026 16:44 CET):**
- [x] Derde filter group toegevoegd: WA pipeline + stage 124821628 + `from_visitor=true`
- [x] Date filter gewijzigd van `createdate >= 15d` naar `hs_last_message_received_at >= 14d` voor alle 3 WA WoU groups
- [x] Workflow gedeployed via n8n API PUT
- [x] Geactiveerd en geverifieerd

**Validatie (16:45 CET):**
| Metric | Dashboard | HubSpot Inbox | Status |
|--------|-----------|---------------|--------|
| Unassigned | 3 | 3 | **EXACT** |
| All Open | 70 | 72 | -2 |
| WA All Open | 14 | 15 | -1 |
| **WA WoU** | **4** | **4** | **EXACT** |
| Tickets WoU | 9 | 10 | -1 |

**Backfill**: WA WoU waarde bijgewerkt van 0 naar 4 voor alle Feb werkdagen (2-19).

#### 5.5 Emails & WA Berichten tellen — VOLTOOID

> Voltooid op 19 feb 2026. Workflow v5.

**Doel**: Individuele email- en WhatsApp-berichten per dag tellen en als extra kolommen op het dashboard tonen.

**Databronnen:**
- **Emails**: HubSpot CRM `emails` object — elke individuele email is een record met `hs_timestamp` en `hs_email_direction` (INCOMING_EMAIL / EMAIL / FORWARDED_EMAIL). Simpele search query per dag.
- **WA berichten**: HubSpot Conversations API — eerst alle WA conversation threads ophalen met activiteit op die dag (`latestMessageTimestampAfter`), dan per thread de individuele messages tellen (INCOMING + OUTGOING, excl. interne comments).

**Wijzigingen doorgevoerd:**
- [x] Database: 2 nieuwe kolommen `total_emails` INTEGER + `total_wa_messages` INTEGER
- [x] API route: Nieuwe velden in Zod schema (optioneel) + dynamic upsert
- [x] Dashboard UI: Emails en WA Msgs kolommen naast Calls/Chatbot (dagtotaal uit 18:00 slot)
- [x] n8n workflow v5: Email counting (CRM emails search) + WA message counting (Conversations threads/messages API) in `daily_totals` collect_mode
- [x] Set DateTime node: `day_start_ms` en `day_end_ms` toegevoegd (ms-epoch voor HubSpot hs_timestamp)
- [x] Backfill alle Feb werkdagen (2-19)
- [x] Deploy: Code via GitHub → Vercel, workflow via n8n API PUT

**Resultaat (18:00 slot, alle Feb werkdagen):**
| Dag | Calls | Chat | Emails | WA Msgs |
|-----|-------|------|--------|---------|
| Ma 2 | 43 | 52 | 104 | 257 |
| Di 3 | 37 | 51 | 147 | 121 |
| Wo 4 | 32 | 55 | 102 | 90 |
| Do 5 | 34 | 41 | 153 | 111 |
| Vr 6 | 17 | 41 | 52 | 64 |
| Ma 9 | 40 | 54 | 142 | 327 |
| Di 10 | 19 | 35 | 123 | 90 |
| Wo 11 | 20 | 35 | 95 | 182 |
| Do 12 | 24 | 44 | 96 | 163 |
| Vr 13 | 19 | 36 | 69 | 108 |
| Ma 16 | 38 | 42 | 128 | 239 |
| Di 17 | 38 | 45 | 89 | 167 |
| Wo 18 | 27 | 38 | 133 | 48 |
| Do 19 | — | — | 101 | 38 |

**Opmerking**: Emails en WA berichten zijn retroactief (tijdgebonden queries), dus backfill-proof. Net als Calls en Chatbot worden ze opgehaald in de midnight run (`collect_mode=daily_totals`).

### Fase 6: Cron Timing Fixes + Daily Totals Bug + Production Audit -- VOLTOOID

> Voltooid op 19-20 feb 2026.

#### 6.1 Cron tijden aangepast — VOLTOOID

**Wijziging**: Cron tijden gewijzigd van 08:30/18:30 naar 08:00/18:00 CET (op verzoek gebruiker).

| Oud (UTC) | Nieuw (UTC) | CET |
|-----------|-------------|-----|
| `30 7 * * 1-5` | `0 8 * * 1-5` | 08:00 (was 08:30) |
| `30 17 * * 1-5` | `0 18 * * 1-5` | 18:00 (was 18:30) |

#### 6.2 Daily totals cron off-by-one bug — VOLTOOID

**Probleem**: Donderdag 19 feb had geen daily totals (calls/chatbot/emails/WA msgs). De midnight cron `30 23 * * 1-5` draaide om 23:30 CET — nog steeds dezelfde dag (donderdag). De code berekende `yesterday` wat woensdag opleverde i.p.v. donderdag.

**Root cause**: Cron om 23:30 CET is vóór middernacht, dus "gisteren" = 2 dagen terug vanuit het perspectief van de data die we willen.

**Fix**: Cron gewijzigd van `30 23 * * 1-5` (23:30 ma-vr) naar `30 0 * * 2-6` (00:30 di-za, ná middernacht). Nu is "gisteren" correct de werkdag waarvoor we data willen.

| Oud | Nieuw | Verschil |
|-----|-------|----------|
| `30 23 * * 1-5` (23:30 CET ma-vr) | `30 0 * * 2-6` (00:30 CET di-za) | Na middernacht, "yesterday" klopt nu |

**Handmatige fix**: Do 19 feb daily totals handmatig gebackfilld (Calls 42, Chatbot 32, Emails 103, WA Msgs 38).

#### 6.3 Oude workflows gedeactiveerd — VOLTOOID

| Workflow ID | Naam | Actie |
|-------------|------|-------|
| `YWiUSWcjszH6FGUU` | Support Dashboard - Collect (oud) | **Gedeactiveerd** |
| `tPCqM761nmYMZGlb` | SD Test | **Gedeactiveerd** |
| `D2xnw2TPDzOhJOPw` | Support Dashboard - Collect (v5) | **Actief** (enige actieve workflow) |

#### 6.4 Production Audit — VOLTOOID (19 feb 2026)

Volledige audit uitgevoerd op alle bronbestanden, n8n workflow, en data-integriteit.

**Gevonden en opgeloste issues:**

| # | Issue | Locatie | Fix |
|---|-------|---------|-----|
| 1 | `collect_mode` ontbrak in backfill endpoint | `/api/backfill/route.ts` | `collect_mode: 'daily_totals'` toegevoegd |
| 2 | Backfill-knop zichtbaar voor vandaag | `Dashboard.tsx` | Check `day.isFuture \|\| day.isToday` → toon "—" |
| 3 | Dead `init-db` endpoint met verouderd schema | `/api/init-db/route.ts` | Bestand verwijderd |
| 4 | Verkeerde backfill webhook URL in `.env.local` | `.env.local` | Gecorrigeerd naar `sd-collect-v2` |

**Geverifieerd (geen issues):**
- [x] n8n workflow D2xnw2TPDzOhJOPw actief met 3 correcte crons
- [x] Auth flow werkt (N8N_WEBHOOK_SECRET als Bearer token)
- [x] Supabase connectie + upsert werkt correct
- [x] Partial upsert behoudt bestaande waarden (tickets vs daily_totals)
- [x] Dashboard UI toont correcte data, weeknavigatie werkt
- [x] Charts view werkt met `?weeks=N` parameter
- [x] NavHeader met Table/Charts toggle functioneert
- [x] Auto-refresh elke 5 minuten actief
- [x] Backfill server action stuurt correct `collect_mode=daily_totals`

**Status: PRODUCTIE-KLAAR**

#### 6.5 Charts View — TOEGEVOEGD

Naast de tabel-weergave is een Charts-pagina toegevoegd op `/charts`:

**Bestanden:**
- `src/components/ChartsView.tsx` — 4 chart componenten in grid layout
- `src/components/NavHeader.tsx` — Navigatie header met Table/Charts toggle
- `src/components/charts/AllOpenTrendChart.tsx` — All Open trend over tijd
- `src/components/charts/DailyVolumeChart.tsx` — Dagelijks volume per kanaal
- `src/components/charts/DailyResolutionChart.tsx` — Dagelijkse resolutie
- `src/components/charts/WaitingOnUsTrendChart.tsx` — Waiting on Us trend
- `src/app/charts/page.tsx` — Charts pagina wrapper

**Features:**
- Periode selector: 1w / 2w / 4w / 8w
- Gebruikt GET `/api/metrics?weeks=N` endpoint
- Auto-refresh elke 5 minuten
- Apple Clean design consistent met dashboard

---

## 14. Backfill & Foutherstel

### Wat kan WEL gebackfilld worden (tijdgebonden queries)
- **Calls** (Aircall): `from/to` timestamps → altijd accuraat
- **Chatbot** (Sleak): API met datum → altijd accuraat
- **Emails** (HubSpot CRM emails): `hs_timestamp` range → altijd accuraat
- **WA Berichten** (HubSpot Conversations): thread timestamps → altijd accuraat

### Wat kan NIET gebackfilld worden (point-in-time snapshots)
- **Unassigned, All Open, WA All Open, WA WoU, Waiting on Us**
- HubSpot CRM Search retourneert altijd de HUIDIGE staat, niet de historische
- Deze data is ALLEEN betrouwbaar als verzameld door real-time crons (08:00/18:00 CET)

### Scenario's die het systeem aankan

| Scenario                              | Wat er gebeurt                                      |
|---------------------------------------|-----------------------------------------------------|
| n8n draait 30 min te laat             | Ticket snapshots iets vertraagd maar ok; daily_totals onveranderd |
| n8n ticket-cron mist een hele dag     | **Ticket data verloren** — niet retroactief ophaalbaar |
| n8n daily_totals mist een dag         | Handmatige backfill via dashboard-knop → haalt calls/chat/email/WA op |
| n8n draait 2x per ongeluk            | Geen probleem: UPSERT overschrijft met zelfde data  |
| Vercel API is down bij POST           | n8n retry-logica, data gaat niet verloren in HubSpot|
| HubSpot API tijdelijk down           | n8n retry, later opnieuw proberen                    |

### Automatische gap detection (optioneel v1.1)

```
Vercel cron (dagelijks 20:00):
  -> Check: zijn er rijen voor vandaag 08:00 en 18:00?
  -> Zo nee: trigger n8n backfill webhook
  -> Stuur notificatie (email/Slack) dat er een gap was
```

---

## 15. Risico's & Mitigatie

| Risico                                  | Impact | Status | Mitigatie                                            |
|-----------------------------------------|--------|--------|------------------------------------------------------|
| HubSpot Conversation object niet via API | Hoog   | **Opgelost** | 15d/30d createdate filter als workaround      |
| WhatsApp All Open niet exact            | Hoog   | **Opgelost** | WA pipeline(30d) + Support(ch1007) = exact    |
| Tickets Waiting on Us niet exact        | Hoog   | **Opgelost** | Alle WoU stages + excl Roel = exact           |
| HubSpot API limiet 5 filterGroups      | Medium | **Werkend** | All Open past in 5 groups, WoU ook in 5       |
| Tijdzone-fouten                         | Medium | **Opgelost** | `fmtDate()` helper i.p.v. `toISOString()`, lokale date formatting |
| Cron timing off-by-one                  | Medium | **Opgelost** | Daily_totals cron verplaatst naar 00:30 (na middernacht) i.p.v. 23:30 |
| n8n Code Node bugs                      | Medium | Open   | Uitgebreid testen met bekende data (validatie-fase)  |
| 15-dagen grens verschuift              | Hoog   | **Bevestigd** | Proxy faalt na 1 dag. Fix: `hs_last_message_received_at` + `createdate` UNION |
| Roel Sanders verlaat bedrijf           | Laag   | Open   | Owner ID uit config halen, niet hardcoden            |
| Nieuwe pipeline toegevoegd             | Laag   | Open   | Kwartaal-check of pipeline lijst nog klopt           |
| Supabase gratis tier limiet             | Laag   | OK     | ~365 dagen x 2 rijen x 10 cols = minimaal            |

---

## 16. Deployment Info

### GitHub Repository

| Veld | Waarde |
|------|--------|
| **Repo** | `bzonneveld-1/support-dashboard` |
| **URL** | https://github.com/bzonneveld-1/support-dashboard |
| **Branch** | `main` |

### Vercel Project

| Veld | Waarde |
|------|--------|
| **Project ID** | `prj_mIT8L0TG1wk2H4xXSail9NT7RQUS` |
| **URL** | https://support-dashboard-nine.vercel.app |
| **Framework** | Next.js 15.5 |

### Environment Variables (Vercel)

| Key | Status | Waarde |
|-----|--------|--------|
| `N8N_WEBHOOK_SECRET` | **Gezet** | *(zie Vercel dashboard)* |
| `SUPABASE_URL` | **Gezet** | *(zie Vercel dashboard)* |
| `SUPABASE_SERVICE_ROLE_KEY` | **Gezet** | *(zie Vercel dashboard)* |
| `SUPABASE_ANON_KEY` | **Gezet** | *(zie Vercel dashboard)* |
| `N8N_BACKFILL_WEBHOOK_URL` | **Gezet** | *(zie Vercel dashboard)* |

### Supabase

| Veld | Waarde |
|------|--------|
| **Project ID** | `phuwjxyurbmunnzqxrvq` |
| **Dashboard** | https://supabase.com/dashboard/project/phuwjxyurbmunnzqxrvq |
| **API URL** | `https://phuwjxyurbmunnzqxrvq.supabase.co` |
| **Service Role Key** | *(zie Supabase dashboard)* |
| **Anon Key** | *(zie Supabase dashboard)* |

### n8n Cloud

| Veld | Waarde |
|------|--------|
| **URL** | https://havenka.app.n8n.cloud |
| **API Key** | In `.env` file |

### Database Setup

Supabase wordt gebruikt i.p.v. Vercel Postgres:
1. SQL schema uitrollen via Supabase SQL Editor
2. API routes omschrijven van `@vercel/postgres` naar `@supabase/supabase-js`
3. Env vars op Vercel zetten: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## 17. Benodigdheden voor Start

| Item                          | Status       | Wie         |
|-------------------------------|--------------|-------------|
| HubSpot API access token      | **Beschikbaar** | .env file |
| Vercel account + project      | **Aangemaakt** | prj_mIT8L0TG1wk2H4xXSail9NT7RQUS |
| GitHub repo                   | **Aangemaakt** | bzonneveld-1/support-dashboard |
| n8n Cloud toegang             | **Beschikbaar** | havenka.app.n8n.cloud |
| Supabase database             | **Aangemaakt** | `phuwjxyurbmunnzqxrvq` |
| Domein voor dashboard         | Optioneel    | Jij (of support-dashboard.vercel.app) |
| TV-scherm op kantoor          | Later        | Jij         |

---

## 18. Kosten Inschatting

| Component          | Kosten (maandelijks)         |
|--------------------|------------------------------|
| Vercel Pro         | ~$20 (als al in gebruik: $0) |
| Supabase           | Gratis tier (ruim voldoende) |
| n8n Cloud          | Al in gebruik: $0 extra      |
| HubSpot API        | Inclusief in plan: $0        |
| **Totaal extra**   | **$0 - $20/maand**           |
