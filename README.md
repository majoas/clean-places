# Clean Places

Eine kleine installierbare Web-App für eine saubere Google-Places-Suche:

- Google Places als Datenquelle
- **harte Mindestbewertung** (`minRating`) bereits in der Google-Abfrage
- zusätzlicher zweiter Rating-Check im Browser
- Mindestzahl an Rezensionen
- „nur jetzt geöffnet“
- strikte Kategorie (z. B. nur `bakery`)
- aktueller Standort + harter Radius
- Sortierung nach Bewertung, Rezensionenzahl, Entfernung oder Name
- Karte + direkter Link zum jeweiligen Google-Maps-Eintrag
- keine gesponserten Suchtreffer in der Oberfläche
- als PWA auf dem iPhone zum Home-Bildschirm hinzufügbar

## 1. Google Cloud vorbereiten

Du brauchst ein Google-Cloud-Projekt mit aktiviertem Billing und einem API-Schlüssel.

Aktiviere im Projekt:

1. **Maps JavaScript API**
2. **Places API (New)**

Erstelle dann einen API-Schlüssel.

### Wichtig: Schlüssel einschränken

Für den später öffentlich/privat gehosteten Web-Aufruf:

- **Anwendungsbeschränkung:** Websites
- Erlaubte Website: deine konkrete Hosting-Domain, z. B. `https://DEINNAME.github.io/*`
- **API-Beschränkung:** nur
  - Maps JavaScript API
  - Places API (New)

Der Schlüssel wird in Clean Places nicht in den Quellcode geschrieben, sondern nach Eingabe im Browser gespeichert. Er ist bei einer Browser-App technisch trotzdem gegenüber dem Browser sichtbar; die Website- und API-Beschränkungen sind deshalb entscheidend.

## 2. Lokal testen

Nicht per Doppelklick als `file://` öffnen. Google empfiehlt für Browser-Apps HTTP/HTTPS, insbesondere wegen Referrer-basierten API-Key-Beschränkungen.

Im Ordner der App beispielsweise:

```bash
python3 -m http.server 8080
```

Dann öffnen:

`http://localhost:8080`

Für einen lokalen Test muss `http://localhost:*/*` als erlaubter Referrer im API-Schlüssel eingetragen sein.

## 3. Auf dem iPhone installieren

Am einfachsten statisch hosten, z. B. über GitHub Pages, Cloudflare Pages, Netlify oder einen eigenen Webserver.

Danach in Safari:

1. URL der App öffnen
2. Teilen
3. **Zum Home-Bildschirm**

Die App startet anschließend wie eine eigenständige App.

## 4. Nutzung

Beispiel:

- Suchbegriff: `Bäckerei`
- Kategorie: `Bäckerei`
- Ort: `Hamburg`
- Mindestbewertung: `4,5 ★`
- Mindestrezensionen: z. B. `50`
- Kategorie strikt: an

Google erhält dadurch bereits `minRating: 4.5`; Treffer darunter werden nicht nur optisch versteckt, sondern schon serverseitig aus der Places-Suche herausgefiltert. Clean Places prüft die Bewertung anschließend nochmals selbst.

## Wichtige Grenze der Google-Schnittstelle

`Place.searchByText()` liefert pro Abfrage maximal 20 Ergebnisse. Die App zeigt deshalb die besten bis zu 20 passenden Google-Treffer der jeweiligen Suche, nicht zwingend jeden existierenden Betrieb in einer großen Stadt.

Für sehr lokale Suchen ist der Standortmodus mit kleinem Radius besonders sinnvoll.

## Dateien

- `index.html` – Oberfläche
- `styles.css` – Layout
- `app.js` – Google-Places-Suche und Filterlogik
- `manifest.webmanifest` – PWA-Metadaten
- `sw.js` – Offline-Cache für die App-Oberfläche
- `icons/` – App-Symbole
