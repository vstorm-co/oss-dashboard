# Vstorm Open Source Pulse

Prosty, responsywny dashboard statystyk publicznych repozytoriów **vstorm-co**, gotowy do hostowania na GitHub Pages. Bez backendu, bazy danych, bundlera i zależności npm/Python. Przeglądarka pobiera tylko statyczny JSON, a sekrety pozostają w GitHub Actions.

## Funkcje

- Automatyczne wykrywanie publicznych projektów organizacji.
- Gwiazdki i forki: aktualne stany oraz dzienne zmiany netto od pierwszego pomiaru.
- Pull requests i issues: osobne liczby nowych zgłoszeń w okresie, liczba aktualnie otwartych, historia według daty utworzenia.
- Pobrania PyPI bez mirrorów, z mapowaniem nazw pakietów na repozytoria.
- Zakresy 7, 30, 90 i 365 dni; grupowanie dzienne, miesięczne i roczne.
- Filtr projektu, wyszukiwanie, sortowanie, dostępna tekstowo tabela danych wykresu i eksport CSV.
- Zachowywanie historii, oznaczanie braków i przestarzałych danych.

## Lokalnie

Wymagane Python 3.12+; Node 22+ do testów JavaScript. Nie trzeba instalować pakietów.

```bash
npm start
# http://localhost:4173
```

Repozytorium zawiera pierwszy rzeczywisty pomiar, więc strona działa od razu.

```bash
python3 scripts/collect.py  # odświeżenie danych
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
npm run build             # pliki do publikacji w dist/
```

Kolektor korzysta z `GH_TOKEN`, następnie `GITHUB_TOKEN`, a lokalnie opcjonalnie z zalogowanego `gh`. Bez tokena limit publicznego API GitHub może nie wystarczyć. Nie zapisuj tokenów w kodzie ani w plikach strony.

## GitHub Pages

1. W repozytorium **Settings → Pages → Build and deployment → Source** wybierz **GitHub Actions**.
2. W **Settings → Actions → General → Workflow permissions** zezwól workflow na zapis zawartości repozytorium. Workflow deklaruje `contents: write`, aby archiwizować pomiary. Reguły chroniące `main` muszą dopuszczać te commity; w przeciwnym razie potrzebny jest dopuszczony bot/token w sekrecie `METRICS_GITHUB_TOKEN`.
3. Wyślij pliki na `main` lub uruchom workflow **Collect metrics and deploy Pages** ręcznie w zakładce Actions.
4. Adres po udanym wdrożeniu: `https://vstorm-co.github.io/oss-dashboard/`.

Workflow uruchamia testy, pobiera dane, zapisuje historię w `data/dashboard.json`, buduje czysty katalog `dist/` i wdraża przez `actions/deploy-pages`. Aktualizacja odbywa się codziennie o **07:17 UTC** oraz przy pushu na `main`. GitHub może opóźniać zaplanowane uruchomienia i wyłącza harmonogramy w nieaktywnych publicznych repozytoriach; w razie potrzeby włącz workflow ponownie. Commit danych używa `[skip ci]`, aby uniknąć dodatkowego uruchomienia po pushu tokenem bota.

Samo lokalne utworzenie plików nie publikuje strony ani nie włącza harmonogramu. GitHub Pages trzeba skonfigurować powyższymi krokami.

## Konfiguracja projektów

Edytuj `config.json`:

- `organization`: organizacja GitHub.
- `exclude`: nazwy repozytoriów pomijanych w dashboardzie. Domyślnie pomijamy strony firmowe, treści blogowe i sam dashboard. Forki i archiwa pomijane są automatycznie.
- `packages`: repozytorium → lista pakietów PyPI, np. `"memv": ["memvee"]`. Dodawaj tylko pakiety faktycznie należące do projektu; nie przypisuj jednego pakietu do kilku repozytoriów, bo spowoduje to podwójne liczenie.

Usunięcie projektu z konfiguracji/organizacji usuwa go z bieżącego widoku; poprzednie pliki nadal są dostępne w historii Git.

## Znaczenie danych

Wszystkie daty agregacji używają UTC. Zakres kończy się w dniu ostatniego uruchomienia kolektora. Bieżący dzień GitHub jest niepełny, a pobrania uwzględniają wyłącznie zakończone dni udostępnione przez źródło. Miesiące/lata sumują tylko część przypadającą na wybrany zakres.

- **Gwiazdki/forki:** wykres to różnica dwóch kolejnych dziennych snapshotów, także ujemna. Nie odtwarzamy nieistniejącej historii. Przy luce pomiarowej zmiana pozostaje nieznana. Uruchomienie kilka razy tego samego dnia zastępuje snapshot tego dnia.
- **PR/issues:** `/issues?state=all` zawiera oba rodzaje; rozdzielamy je polem `pull_request`. Historia przedstawia daty utworzenia obecnie dostępnych zgłoszeń, nie daty zamknięcia/merge. Usunięte lub przeniesione zgłoszenia mogą zmieniać odtworzoną historię. Nie zapisujemy treści zgłoszeń ani danych autorów.
- **PyPI:** źródło [PyPI Stats](https://pypistats.org/api/) oferuje około 180 dni historii. Pobieramy ją raz dziennie dla pakietu i łączymy z zapisanymi danymi, zachowując starsze dni. Brak dnia nie jest zerem, a częściowe sumy są oznaczone. Suma organizacji może być częściowa, gdy choć jeden pakiet nie ma danych. Pobrania nie oznaczają unikalnych użytkowników.
- **Awarie:** po błędzie pojedynczego repo/pakietu zachowujemy dostępne wcześniejsze dane i zapisujemy ostrzeżenie. Błąd listy organizacji przerywa zadanie bez nadpisania pliku. Zapis JSON jest atomowy. Informacja o świeżości repozytorium/pakietu pozostaje w JSON. Ponad 48 godzin od aktualizacji oznacza widoczne ostrzeżenie na stronie.
- **CSV:** eksportuje widoczne, przefiltrowane wiersze, zakres UTC i flagę częściowych pobrań. Puste wartości oznaczają brak danych.

Pełna historia roczna gwiazdek/forków wymaga roku pomiarów. Roczne pobrania będą kompletne po zgromadzeniu brakujących dni; wcześniejszą historię można osobno zaimportować z [publicznych danych PyPI w BigQuery](https://packaging.python.org/en/latest/guides/analyzing-pypi-package-downloads/) (nie jest to część tej wersji).

## Pliki

`index.html`, `styles.css`, `app.js` — interfejs; `metrics.js` — agregacja; `scripts/collect.py` — kolektor; `scripts/build.py` — budowa artefaktu Pages; `data/dashboard.json` — publiczne pomiary; `.github/workflows/` — CI i publikacja.

Fonty pobierane są z Google Fonts; przy braku dostępu strona korzysta z systemowego sans-serif. Wszystkie ścieżki aplikacji są względne, dzięki czemu działa także pod `/oss-dashboard/`.
