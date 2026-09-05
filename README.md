# PDF QR Studio — Statyczny Edytor Wielostronicowych Dokumentów PDF A5

Zaawansowana, w 100% statyczna aplikacja webowa (Client-Side, zero-backend) do precyzyjnego podglądu i bezstratnego wstrzykiwania kodów QR do obszernych dokumentów PDF (standard **A5: 148 x 210 mm**, do **1500 stron**) bez re-rasteryzacji i bez niszczenia pierwotnego formatowania.

Aplikacja została zaprojektowana z myślą o hostingu na **Cloudflare Pages** i automatycznym wdrażaniu przez **GitHub**.

---

## 🌟 Kluczowe Cechy

1. **W 100% Statyczna Architektura (Brak Backendu):**
   - Całe przetwarzanie odbywa się bezpośrednio w przeglądarce użytkownika przy użyciu technologii Web Workers, `pdfjs-dist`, `pdf-lib` oraz `qrcode`.
   - Brak limitów rozmiaru uploadu (Request Payload Limit) – nawet pliki o objętości 1500 stron (200-500 MB) przetwarzane są lokalnie w pamięci RAM urządzenia.

2. **Bezstratna Modyfikacja PDF (Lossless Object Injection):**
   - Kod QR wstrzykiwany jest bezpośrednio do drzewa obiektów PDF (jako zasób `XObject /Image`).
   - Istniejący tekst, wektory, fonty i układ typograficzny pozostają w 100% nienaruszone (zero spłaszczania stron, zero utraty jakości druku).
   - Współrzędne pozycjonowania są precyzyjnie przeliczane na punkty typograficzne PDF ($1 \text{ pt} = \frac{1}{72} \text{ cala}$).

3. **Wydajność do 1500 Stron A5 Bez Wycieków Pamięci:**
   - **Wirtualizacja listy stron (Virtual Scrolling):** Renderowanie wyłącznie widocznych miniatur (8-12 kafelków) w lewym panelu, eliminujące problem przeciążenia drzewa DOM.
   - **Bufor LRU i czyszczenie Canvas:** W centralnym obszarze roboczym renderowana jest tylko jedna aktywna strona w wysokiej rozdzielczości (z uwzględnieniem `devicePixelRatio`).
   - **Ekstremalna szybkość:** Benchmark wykazuje prędkość ponad **12 000 stron/sekundę** przy narzucie pamięci zaledwie ~35 MB!

4. **Nowoczesny Interfejs UI/UX (Linear / shadcn/ui):**
   - **Lewy panel:** Wirtualizowana lista miniatur z etykietami obecności QR, filtrowaniem i natychmiastowym skokiem: `Strona: [ 742 ] / 1500`.
   - **Centrum:** Interaktywny Canvas z płynnym zoomem (25%-300%), panningiem oraz widżetem QR z obsługą **Drag & Drop** i **Resize 1:1** ze strażnikami marginesów introligatorskich A5 (5 mm).
   - **Prawy panel:** Konfigurator parametrów QR (treść z obsługą zmiennych `{page}` i `{total}`, rozmiar w mm/pt, korekcja L/M/Q/H, presety narożników i dołu, zakres stron: bieżąca, wszystkie, np. `1-100, 200-300`, nieparzyste/parzyste).
   - **Pasek stanu i modal postępu:** Wskaźnik prędkości (stron/s), szacowany czas (ETA) oraz natychmiastowe pobieranie gotowego pliku.

---

## 🛠️ Stos Technologiczny

- **Framework:** Next.js 14 (App Router, `output: 'export'`)
- **Styling:** Tailwind CSS, Lucide Icons, motyw Dark/Linear
- **Silnik Renderowania Podglądu:** `pdfjs-dist` (wraz z dedykowanym workerem `/public/pdf.worker.min.mjs`)
- **Silnik Bezstratnej Modyfikacji:** `pdf-lib`
- **Generator Kodów QR:** `qrcode`

---

## 🚀 Uruchomienie Lokalne

Wymagane środowisko: Node.js 18+ (zalecane Node 20 lub nowsze).

```bash
# 1. Klonowanie repozytorium (jeśli pobierasz z GitHub)
git clone <URL_REPOZYTORIUM>
cd pdf_editor

# 2. Instalacja zależności
npm install

# 3. Uruchomienie serwera deweloperskiego
npm run dev
```

Aplikacja będzie dostępna pod adresem: `http://localhost:3000`.

---

## 📊 Uruchomienie Benchmarku Wydajnościowego (1500 stron A5)

Aby przetestować stabilność pamięciową i szybkość przetwarzania 1500-stronicowego dokumentu A5:

```bash
npm run benchmark
```

Przykładowy wynik testu:
```text
================================================================
🚀 BENCHMARK: STABILNOŚĆ PAMIĘCIOWA PRZETWARZANIA 1500 STRON A5
================================================================
[1/4] Pamięć początkowa sterty (Heap Used): 12.25 MB
[2/4] Generowanie syntetycznego dokumentu A5 o objętości 1500 stron...
      ✓ Utworzono 1500 stron w 0.60 s.
[3/4] Rozpoczynam bezstratne wstrzykiwanie kodów QR na 1500 stronach...
      -> Postęp: Strona  250 / 1500 | Pamięć sterty: 30.76 MB | Prędkość: 13226.3 stron/s
      -> Postęp: Strona  500 / 1500 | Pamięć sterty: 34.15 MB | Prędkość: 13276.3 stron/s
      -> Postęp: Strona  750 / 1500 | Pamięć sterty: 37.54 MB | Prędkość: 12147.7 stron/s
      -> Postęp: Strona 1000 / 1500 | Pamięć sterty: 28.48 MB | Prędkość: 12285.7 stron/s
      -> Postęp: Strona 1250 / 1500 | Pamięć sterty: 31.97 MB | Prędkość: 13222.0 stron/s
      -> Postęp: Strona 1500 / 1500 | Pamięć sterty: 35.24 MB | Prędkość: 13011.5 stron/s
[4/4] Zapisywanie zmodyfikowanego dokumentu PDF do bufora binarnego...
================================================================
📊 WYNIKI BENCHMARKU I RAPORT STABILNOŚCI
================================================================
Liczba przetworzonych stron:       1500 (format DIN A5)
Całkowity czas wstrzykiwania QR:   0.12 s
Średnia prędkość wstrzykiwania:    12500.0 stron/sekundę
Czas serializacji do PDF:          1.97 s
Rozmiar wyjściowego pliku PDF:     0.60 MB
Początkowe zużycie sterty:         12.25 MB
Maksymalne zużycie sterty:         35.24 MB
Profil pamięciowy:                 STABILNY O(1) - BRAK WYCIEKÓW
Weryfikacja wektorowa:             Tekst i układ fontów nienaruszone (bezstratne)
================================================================
```

---

## 🌐 Wdrożenie na Cloudflare Pages (Krok po Kroku)

Aplikacja jest w pełni skonfigurowana do statycznego eksportu (`output: 'export'`).

### Krok 1: Wypchnięcie kodu do GitHuba
```bash
git init
git add .
git commit -m "Initial commit: Static PDF QR Studio for A5 documents"
git branch -M main
git remote add origin https://github.com/<TWOJ_UZYTKOWNIK>/<NAZWA_REPOZYTORIUM>.git
git push -u origin main
```

### Krok 2: Konfiguracja w Panelu Cloudflare Pages
1. Zaloguj się na konto [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Przejdź do zakładki **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
3. Wybierz swoje repozytorium GitHub i kliknij **Begin setup**.
4. Wypełnij ustawienia budowania (**Build settings**):
   - **Framework preset:** `Next.js (Static HTML Export)`
   - **Build command:** `npm run build`
   - **Build output directory:** `out`
   - **Root directory:** `/` (pozostaw puste lub wpisz `/`)
5. Kliknij **Save and Deploy**.

Cloudflare automatycznie pobierze zależności, zbuduje statyczne pliki do folderu `out/` i rozpropaguje aplikację na globalnej sieci Edge CDN z obsługą darmowego certyfikatu SSL.
