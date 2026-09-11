import {
  SelfPublishingProvider,
  ProviderId,
  KdpPrintConfig,
  EpubConfig,
  DocxConfig,
} from '@/types/kdp-epub';

export const SELF_PUBLISHING_PROVIDERS: SelfPublishingProvider[] = [
  {
    id: 'empik',
    name: 'Empik Selfpublishing',
    shortName: 'Empik',
    badge: '0 zł na start • Salony Empik & Empik Go',
    category: 'hybrid',
    zeroCostStart: true,
    zeroCostDetails:
      'W 100% darmowa rejestracja, brak opłat za wgranie plików i publikację. Prowizja jest potrącana wyłącznie od realnie sprzedanych egzemplarzy.',
    isbnPolicy:
      'Darmowy numer ISBN od Empiku przydzielany automatycznie dla wydania drukowanego (POD) oraz e-booka (można również użyć własnego numeru ISBN z serwisu e-ISBN).',
    distributionChannels: [
      'Empik.com (największa księgarnia internetowa w Polsce)',
      'Aplikacja Empik Go (e-booki w abonamencie i sprzedaży jednostkowej)',
      'Salony stacjonarne Empik w całej Polsce (zamówienia online z bezpłatnym odbiorem)',
    ],
    royaltiesInfo:
      'Do 70% ceny netto dla e-booków w sprzedaży jednostkowej; rozliczenia za przeczytane strony w Empik Go; marża autorska ustalana przez autora przy druku na życzenie (POD).',
    bleedRequirementMm: 3.0,
    hasBleed: true,
    recommendedGutterMm: 18,
    recommendedOuterMarginMm: 14,
    recommendedTopBottomMm: 15,
    supportedFormats: ['PDF', 'ePUB', 'DOCX'],
    portalUrl: 'https://selfpublishing.empik.com',
    description:
      'Wiodąca polska platforma self-publishingowa z dostępem do milionów klientów ekosystemu Empik. Umożliwia jednoczesny bezpłatny druk na życzenie i dystrybucję cyfrową.',
    accentColor: '#f59e0b', // amber
    guideSteps: [
      'Zarejestruj bezpłatne konto na selfpublishing.empik.com.',
      'Wybierz format książki: Druk na życzenie (Paperback A5) lub eBook (ePUB 3.0).',
      'Wgraj wygenerowany z aplikacji plik PDF do druku (ze spadem 3 mm lub bez) oraz plik okładki.',
      'Dla e-booka wgraj wygenerowany plik ePUB 3.0.',
      'Zaznacz opcję darmowego numeru ISBN od Empik.',
      'Ustal cenę detaliczną i marżę autorską — publikacja trafi do sprzedaży w Empik.com i Empik Go.',
    ],
  },
  {
    id: 'legimi',
    name: 'Legimi (eBooki & Audiobooki)',
    shortName: 'Legimi',
    badge: '0 zł na start • Lider Abonamentu w Polsce',
    category: 'ebook',
    zeroCostStart: true,
    zeroCostDetails:
      'Brak jakichkolwiek opłat wstępnych za udostępnienie publikacji w abonamencie Legimi. Wynagrodzenie generowane jest za każdą przeczytaną stronę.',
    isbnPolicy:
      'Darmowy numer ISBN przy publikacji przez partnerskich agregatorów (np. Ridero, Empik Selfpublishing) lub własny bezpłatny ISBN z BN (Biblioteki Narodowej).',
    distributionChannels: [
      'Abonament Legimi (najpopularniejsza usługa subskrypcyjna czytelnictwa w Polsce)',
      'Czytniki PocketBook, inkBOOK, Kindle (wsparcie wybranych modeli)',
      'Aplikacje mobilne Legimi na Android, iOS i Windows',
      'Sprzedaż detaliczna e-booków w księgarni Legimi',
    ],
    royaltiesInfo:
      'Wynagrodzenie w modelu "pay-per-page" (za przeczytane strony przez subskrybentów abonamentu) + prowizja handlowa od sprzedaży detalicznej.',
    bleedRequirementMm: 0,
    hasBleed: false,
    recommendedGutterMm: 15,
    recommendedOuterMarginMm: 12,
    recommendedTopBottomMm: 12,
    supportedFormats: ['ePUB', 'PDF'],
    portalUrl: 'https://www.legimi.pl',
    description:
      'Lider polskiego rynku e-booków w abonamencie. Najszybszą i w 100% darmową drogą do Legimi jest publikacja poprzez agregatora Ridero lub Empik Selfpublishing.',
    accentColor: '#10b981', // emerald
    guideSteps: [
      'Wygeneruj z naszej aplikacji zwalidowany plik ePUB 3.0 z wyjustowanym tekstem i spisem treści (TOC).',
      'Najłatwiejsza bezpłatna dystrybucja do Legimi odbywa się za pośrednictwem bezpłatnego konta w Ridero.pl lub Empik Selfpublishing.',
      'W panelu dystrybucji zaznacz kanał "Legimi (Abonament i sprzedaż)".',
      'System automatycznie dostarcza e-booka do czytelników korzystających z abonamentu.',
    ],
  },
  {
    id: 'amazon-kdp',
    name: 'Amazon KDP (Kindle Direct Publishing)',
    shortName: 'Amazon KDP',
    badge: '0 zł / 0 $ na start • Globalny Zasięg POD + Kindle',
    category: 'hybrid',
    zeroCostStart: true,
    zeroCostDetails:
      'Zerowy koszt początkowy. Brak opłat za wystawienie książki drukowanej ani e-booka. Amazon pobiera prowizję wyłącznie od sprzedanych sztuk.',
    isbnPolicy:
      'Darmowy numer ISBN od Amazon dla wydań drukowanych (Paperback i Hardcover) lub możliwość użycia własnego numeru ISBN.',
    distributionChannels: [
      'Amazon.pl (rynek polski)',
      'Amazon.de, Amazon.co.uk, Amazon.fr, Amazon.it, Amazon.es (rynki europejskie)',
      'Amazon.com (rynek USA i globalny)',
      'Aplikacje i czytniki Amazon Kindle na całym świecie',
    ],
    royaltiesInfo:
      'Do 70% tantiem dla e-booków Kindle; 60% ceny detalicznej minus stały koszt druku dla książek papierowych Paperback POD.',
    bleedRequirementMm: 3.2,
    hasBleed: true,
    recommendedGutterMm: 18,
    recommendedOuterMarginMm: 13,
    recommendedTopBottomMm: 15,
    supportedFormats: ['PDF', 'ePUB', 'DOCX'],
    portalUrl: 'https://kdp.amazon.com',
    description:
      'Największa na świecie platforma druku na żądanie (POD) i e-booków. Umożliwia natychmiastową sprzedaż książki w Polsce, Europie i USA bez magazynowania.',
    accentColor: '#3b82f6', // blue
    guideSteps: [
      'Zaloguj się na kdp.amazon.com swoim kontem Amazon.',
      'Kliknij "+ Create" i wybierz "Paperback" (książka drukowana) lub "Kindle eBook".',
      'Wgraj przygotowany w aplikacji plik PDF DIN A5 ze spadem 3.2 mm (154.4 × 216.4 mm).',
      'Dla e-booka wgraj wygenerowany plik ePUB 3.0 lub DOCX.',
      'Wybierz darmowy ISBN Amazon i ustal rynki dystrybucji (Amazon.pl, Amazon.de, Amazon.com).',
      'Zatwierdź podgląd w KDP Print Previewer i opublikuj tytuł.',
    ],
  },
  {
    id: 'ridero',
    name: 'Ridero (Polska & Europa)',
    shortName: 'Ridero',
    badge: '0 zł na start • Darmowy ISBN • Multi-Dystrybucja',
    category: 'hybrid',
    zeroCostStart: true,
    zeroCostDetails:
      'Bezpłatna rejestracja, darmowy polski numer ISBN i bezpłatna dystrybucja cyfrowa do wszystkich głównych polskich e-księgarni.',
    isbnPolicy:
      'Ridero bezpłatnie przydziela polski numer ISBN zarejestrowany w Bibliotece Narodowej zarówno dla e-booka, jak i wydania drukowanego.',
    distributionChannels: [
      'Legimi, Empik.com, Virtualo, Woblink, Ebookpoint, Gandalf',
      'Amazon, Google Play Książki, Apple Books',
      'Druk na żądanie POD w księgarni Ridero i partnerskich sklepach',
    ],
    royaltiesInfo:
      'Autor samodzielnie ustala własną marżę autorską powyżej bazowego kosztu druku POD oraz marży partnerskich dystrybutorów.',
    bleedRequirementMm: 3.0,
    hasBleed: true,
    recommendedGutterMm: 18,
    recommendedOuterMarginMm: 14,
    recommendedTopBottomMm: 15,
    supportedFormats: ['PDF', 'ePUB', 'DOCX'],
    portalUrl: 'https://ridero.pl',
    description:
      'Niezwykle popularny w Polsce serwis self-publishingowy. Za jednym kliknięciem wprowadza publikację do Legimi, Empiku, Woblinka, Virtualo i Amazona za 0 zł.',
    accentColor: '#8b5cf6', // purple
    guideSteps: [
      'Załóż bezpłatne konto na ridero.pl.',
      'Wgraj wygenerowany plik Word (.docx) lub PDF A5 z naszej aplikacji.',
      'Skorzystaj z bezpłatnego przydziału polskiego numeru ISBN.',
      'Włącz dystrybucję do Legimi, Empik, Virtualo, Ebookpoint i Woblink.',
      'Ustal marżę ze sprzedaży każdego egzemplarza papierowego i elektronicznego.',
    ],
  },
  {
    id: 'draft2digital',
    name: 'Draft2Digital (+ Smashwords)',
    shortName: 'Draft2Digital',
    badge: '0 $ na start • Globalna Sieć Księgarni i Bibliotek',
    category: 'hybrid',
    zeroCostStart: true,
    zeroCostDetails:
      'Zero opłat wstępnych i ukrytych kosztów. D2D pobiera jedynie 10% ceny netto od faktycznie sprzedanych egzemplarzy.',
    isbnPolicy:
      'Bezpłatne numery ISBN od Draft2Digital dla wydań cyfrowych oraz druku na żądanie (D2D Print POD).',
    distributionChannels: [
      'Apple Books, Barnes & Noble, Kobo, Amazon, Tolino, Vivlio',
      'Globalne sieci biblioteczne: OverDrive, Hoopla, BorrowBox, Bibliotheca',
      'Druk na żądanie D2D Print z dystrybucją do Amazon i Ingram',
    ],
    royaltiesInfo:
      'Około 60–70% ceny detalicznej w większości kanałów handlowych; wysokie tantiemy z wypożyczeń bibliotecznych.',
    bleedRequirementMm: 3.2,
    hasBleed: true,
    recommendedGutterMm: 18,
    recommendedOuterMarginMm: 13,
    recommendedTopBottomMm: 15,
    supportedFormats: ['ePUB', 'PDF', 'DOCX'],
    portalUrl: 'https://www.draft2digital.com',
    description:
      'Najwygodniejszy globalny agregator e-booków i druku na żądanie. Trafia do setek księgarni i tysięcy bibliotek publicznych na całym świecie.',
    accentColor: '#ec4899', // pink
    guideSteps: [
      'Zarejestruj konto na draft2digital.com.',
      'Wgraj wygenerowany plik ePUB 3.0 lub Word (.docx) przygotowany w aplikacji.',
      'Wybierz darmowy ISBN i zaznacz kanały sprzedaży (Apple Books, Kobo, biblioteki).',
      'Opcjonalnie uruchom wersję drukowaną D2D Print wgrywając plik PDF A5.',
    ],
  },
  {
    id: 'lulu',
    name: 'Lulu Publishing',
    shortName: 'Lulu',
    badge: '0 $ na start • Profesjonalny Globalny Druk POD',
    category: 'hybrid',
    zeroCostStart: true,
    zeroCostDetails:
      'Bezpłatne utworzenie projektu, bezpłatne wystawienie w księgarni Lulu oraz sieci globalnej dystrybucji bez opłat abonamentowych.',
    isbnPolicy:
      'Darmowy numer ISBN Lulu dla projektów z globalną dystrybucją detaliczną.',
    distributionChannels: [
      'Lulu Bookstore (wysoka marża direct-to-consumer)',
      'Globalna sieć dystrybucji Ingram Content Group',
      'Amazon, Barnes & Noble',
    ],
    royaltiesInfo:
      'Do 80% przy sprzedaży przez księgarnię Lulu; standardowe marże hurtowe w sieci Ingram.',
    bleedRequirementMm: 3.175,
    hasBleed: true,
    recommendedGutterMm: 18,
    recommendedOuterMarginMm: 13,
    recommendedTopBottomMm: 15,
    supportedFormats: ['PDF', 'ePUB'],
    portalUrl: 'https://www.lulu.com',
    description:
      'Doświadczona międzynarodowa drukarnia POD oferująca szeroki wybór opraw (miękka, twarda, spiralowana) oraz dystrybucję do Ingram i Amazon.',
    accentColor: '#06b6d4', // cyan
    guideSteps: [
      'Utwórz darmowy projekt książki na lulu.com.',
      'Wybierz format A5 (148 x 210 mm) i oprawę miękką.',
      'Wgraj plik PDF z wnętrzem publikacji przygotowany w naszej aplikacji.',
      'Skorzystaj z kreatora okładki Lulu lub wgraj własną grafikę.',
      'Zamów egzemplarz próbny (Proof) lub od razu włącz globalną dystrybucję.',
    ],
  },
  {
    id: 'rozpisani',
    name: 'Rozpisani.pl (Grupa Wydawnicza PWN)',
    shortName: 'Rozpisani.pl (PWN)',
    badge: 'Pakiet 0 zł • Renomowany Polski Wydawca',
    category: 'hybrid',
    zeroCostStart: true,
    zeroCostDetails:
      'Darmowy pakiet startowy dla e-booków z dystrybucją do sieci PWN i księgarni partnerskich bez opłat z góry.',
    isbnPolicy:
      'Numery ISBN powiązane z polskim rynkiem wydawniczym i ewidencją PWN.',
    distributionChannels: [
      'Księgarnia Internetowa PWN (pwn.pl)',
      'Ravelo, IBUK, e-Kiosk',
      'Sieci partnerskie i biblioteki akademickie',
    ],
    royaltiesInfo:
      'Przejrzysty model prowizyjny z comiesięcznymi raportami sprzedaży w sieci PWN.',
    bleedRequirementMm: 3.0,
    hasBleed: true,
    recommendedGutterMm: 20,
    recommendedOuterMarginMm: 15,
    recommendedTopBottomMm: 15,
    supportedFormats: ['PDF', 'ePUB', 'DOCX'],
    portalUrl: 'https://rozpisani.pl',
    description:
      'Polska platforma samowydawców prowadzona przez Wydawnictwo Naukowe PWN. Idealna dla publikacji naukowych, poradnikowych, historycznych i beletrystyki.',
    accentColor: '#ef4444', // red
    guideSteps: [
      'Zarejestruj konto na rozpisani.pl.',
      'Wybierz wariant publikacji elektronicznej lub drukowanej na żądanie.',
      'Wgraj sformatowany plik PDF lub Word (.docx) przygotowany w aplikacji.',
      'Zatwierdź metadane i uruchom dystrybucję w sieci PWN.',
    ],
  },
  {
    id: 'universal',
    name: 'Format Uniwersalny (All-in-One POD & eBook)',
    shortName: 'Uniwersalny',
    badge: 'Zgodny z Wszystkimi Platformami',
    category: 'hybrid',
    zeroCostStart: true,
    zeroCostDetails:
      'Uniwersalny profil zgodny z międzynarodowymi standardami DIN A5 (148 × 210 mm) oraz IDPF EPUB 3.0 akceptowany przez dowolną drukarnię cyfrową.',
    isbnPolicy:
      'Możliwość użycia darmowego numeru ISBN z dowolnej platformy lub bezpłatnego własnego numeru ISBN z serwisu e-isbn.pl.',
    distributionChannels: [
      'Empik Selfpublishing & Legimi',
      'Amazon KDP & Ridero',
      'Lokalne drukarnie cyfrowe i self-publishing tradycyjny',
    ],
    royaltiesInfo:
      'Maksymalna elastyczność — jeden komplet plików PDF, ePUB i Word nadający się do wdrożenia u każdego wydawcy.',
    bleedRequirementMm: 3.0,
    hasBleed: true,
    recommendedGutterMm: 18,
    recommendedOuterMarginMm: 13,
    recommendedTopBottomMm: 15,
    supportedFormats: ['PDF', 'ePUB', 'DOCX'],
    portalUrl: '#',
    description:
      'Uniwersalny profil A5 z bezpiecznymi marginesami introligatorskimi (18 mm grzbiet, 13 mm zewnątrz) i spadami 3.0 mm, kompatybilny ze wszystkimi platformami.',
    accentColor: '#6366f1', // indigo
    guideSteps: [
      'Pobierz pliki PDF do druku (A5), pakiet eBook (ePUB 3.0) oraz szablon Word (.docx).',
      'Pliki te spełniają wyśrubowane normy techniczne zarówno polskich (Empik, Ridero, Legimi), jak i zagranicznych (Amazon KDP, Lulu) usługodawców.',
    ],
  },
];

/**
 * Returns all available self-publishing and ebook providers
 */
export function getAllProviders(): SelfPublishingProvider[] {
  return SELF_PUBLISHING_PROVIDERS;
}

/**
 * Returns a specific provider by ID or fallback to universal
 */
export function getProviderById(id: ProviderId): SelfPublishingProvider {
  return (
    SELF_PUBLISHING_PROVIDERS.find((p) => p.id === id) ||
    SELF_PUBLISHING_PROVIDERS[SELF_PUBLISHING_PROVIDERS.length - 1]
  );
}

/**
 * Automatically applies provider-specific presets to PDF, ePUB, and DOCX configs
 */
export function applyProviderPreset(
  provider: SelfPublishingProvider,
  currentKdp: KdpPrintConfig,
  currentEpub: EpubConfig,
  currentDocx: DocxConfig
): {
  newKdp: KdpPrintConfig;
  newEpub: EpubConfig;
  newDocx: DocxConfig;
} {
  const isKdp = provider.id === 'amazon-kdp';
  const bleedOption = provider.hasBleed ? 'kdp-standard' : 'none';
  const bleedMm = provider.bleedRequirementMm || 3.0;

  const newKdp: KdpPrintConfig = {
    ...currentKdp,
    bleed: bleedOption,
    bleedMm: isKdp ? 3.2 : bleedMm,
    gutterMarginMm: provider.recommendedGutterMm,
    outerMarginMm: provider.recommendedOuterMarginMm,
    topMarginMm: provider.recommendedTopBottomMm,
    bottomMarginMm: provider.recommendedTopBottomMm,
  };

  const newEpub: EpubConfig = {
    ...currentEpub,
    hyphenation: true,
    indentParagraphs: true,
    textAlign: 'justify',
  };

  const newDocx: DocxConfig = {
    ...currentDocx,
    gutterMarginMm: provider.recommendedGutterMm,
    outerMarginMm: provider.recommendedOuterMarginMm,
    topMarginMm: provider.recommendedTopBottomMm,
    bottomMarginMm: provider.recommendedTopBottomMm,
    mirrorMargins: true,
  };

  return { newKdp, newEpub, newDocx };
}
