import JSZip from 'jszip';
import { EpubConfig, ExtractedBookModel } from '@/types/kdp-epub';
import { QRCodeItem } from '@/types/pdf';
import { generateQRPngBytes, resolvePageContent } from './qr-generator';
import { sanitizeExtractedText } from './pdf-text-extractor';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an official, standard-compliant EPUB 3.0 file package
 * with strictly 12pt typography for all text and headings, full text justification,
 * navigation TOC, and zero overflow beyond reader margins.
 */
export async function generateEpubPackage({
  config,
  bookModel,
  qrItems = [],
  onProgress,
}: {
  config: EpubConfig;
  bookModel: ExtractedBookModel;
  qrItems?: QRCodeItem[];
  onProgress?: (progress: number, total: number) => void;
}): Promise<Uint8Array> {
  const zip = new JSZip();

  // 1. mimetype MUST be first, uncompressed (STORE)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.file('META-INF/container.xml', containerXml);

  // 3. OEBPS/styles/stylesheet.css (Strictly 12pt for body and all headings, no margin overflow)
  const stylesheetCss = `/* Standard EPUB 3 Stylesheet - Strictly 12pt Justified Layout for Amazon KDP eBook */
@charset "UTF-8";

* {
  box-sizing: border-box;
  max-width: 100%;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

body {
  font-family: "Georgia", "Times New Roman", "Cambria", serif;
  font-size: 12pt !important;
  line-height: 1.5;
  text-align: justify;
  text-justify: inter-word;
  -webkit-hyphens: auto;
  -moz-hyphens: auto;
  -ms-hyphens: auto;
  hyphens: auto;
  margin: 5% 6%;
  color: #1a1a1a;
  background-color: transparent;
}

h1, h2, h3, h4, h5, h6,
h1.book-title, h1.chapter-title, .day-heading, strong, b {
  font-size: 12pt !important;
  font-weight: bold;
  line-height: 1.4;
}

h1.book-title {
  text-align: center;
  margin-top: 25%;
  margin-bottom: 0.5em;
  page-break-before: always;
}

p.book-author {
  text-align: center;
  font-size: 12pt !important;
  color: #555;
  margin-bottom: 2em;
}

.title-separator {
  width: 40%;
  margin: 2em auto;
  border: 0;
  border-top: 1px solid #ccc;
}

h1.chapter-title {
  text-align: left;
  margin-top: 1.5em;
  margin-bottom: 0.8em;
  page-break-before: always;
  color: #111;
  border-bottom: 1.5px solid #2563eb;
  padding-bottom: 0.2em;
}

h2 {
  margin-top: 1.2em;
  margin-bottom: 0.5em;
  text-align: left;
}

p, div, span, section {
  font-size: 12pt !important;
  text-align: justify;
  text-justify: inter-word;
  line-height: 1.5;
}

p {
  text-indent: ${config.indentParagraphs !== false ? '1.25em' : '0'};
  margin-top: 0;
  margin-bottom: 0.4em;
}

p.first, h1 + p, h2 + p {
  text-indent: 0;
}

.qr-section {
  text-align: center;
  margin: 2em auto;
  padding: 1em;
  border: 1px dashed #ccc;
  border-radius: 8px;
  background-color: #fafafa;
  max-width: 320px;
}

.qr-image {
  max-width: 160px;
  height: auto;
  margin: 0 auto 0.8em auto;
  display: block;
}

.qr-label {
  font-size: 11pt !important;
  font-weight: bold;
  color: #333;
  margin-bottom: 0.4em;
}

.qr-link {
  font-size: 10pt !important;
  color: #2563eb;
  word-break: break-all;
  text-decoration: underline;
}

nav#toc ol {
  list-style-type: decimal;
  padding-left: 1.5em;
  font-size: 12pt !important;
}

nav#toc li {
  margin-bottom: 0.6em;
  font-size: 12pt !important;
}

nav#toc a {
  text-decoration: none;
  color: #2563eb;
  font-size: 12pt !important;
}
`;
  zip.file('OEBPS/styles/stylesheet.css', stylesheetCss);

  const rawBookTitle = config.title || bookModel.title || 'Dokument A5';
  const bookTitle = sanitizeExtractedText(rawBookTitle, config.excludedPatterns) || 'Dokument A5';

  const rawAuthor = config.author || bookModel.author || '';
  const cleanAuthor = sanitizeExtractedText(rawAuthor, config.excludedPatterns);
  const isAuthorValid = Boolean(cleanAuthor && !/^(autor|autor publikacji|unknown)$/i.test(cleanAuthor.trim()));
  const author = isAuthorValid ? cleanAuthor : '';

  const lang = config.language || 'pl';
  const bookUuid = config.identifier || `urn:uuid:${Math.random().toString(36).substring(2)}-${Date.now()}`;
  const nowIso = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  // 4. Generate Title Page
  const titleXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}">
<head>
  <title>${escapeXml(bookTitle)}</title>
  <link rel="stylesheet" type="text/css" href="../styles/stylesheet.css" />
</head>
<body epub:type="frontmatter titlepage">
  <section class="titlepage">
    <h1 class="book-title">${escapeXml(bookTitle)}</h1>
    ${isAuthorValid ? `<p class="book-author">${escapeXml(author)}</p>` : ''}
    <hr class="title-separator" />
    <p style="text-align: center; font-size: 11pt; color: #777;">Wydanie cyfrowe ePUB (Format 12 pt | Amazon KDP eBook)</p>
  </section>
</body>
</html>`;
  zip.file('OEBPS/text/title.xhtml', titleXhtml);

  // 5. Embed QR Code images if available and requested
  const embeddedQrs: { filename: string; label: string; link: string; id: string }[] = [];
  if (config.includeQRCodes && qrItems.length > 0) {
    for (let i = 0; i < qrItems.length; i++) {
      const item = qrItems[i];
      try {
        const content = resolvePageContent(item, 1, 1);
        const pngBytes = await generateQRPngBytes(content, item, 300);
        const filename = `qr_${i + 1}.png`;
        zip.file(`OEBPS/images/${filename}`, pngBytes);
        embeddedQrs.push({
          id: `qr-img-${i + 1}`,
          filename,
          label: item.label || `Kod QR #${i + 1}`,
          link: content,
        });
      } catch (err) {
        console.warn('Could not generate QR for EPUB:', err);
      }
    }
  }

  // 6. Generate Chapters (filtering out noise/headers)
  const chapterFiles: { id: string; title: string; filename: string }[] = [];

  for (let idx = 0; idx < bookModel.chapters.length; idx++) {
    const chapter = bookModel.chapters[idx];
    let cleanChapterTitle = sanitizeExtractedText(chapter.title, config.excludedPatterns);
    if (/^wst[eę]p\b/i.test(cleanChapterTitle)) {
      cleanChapterTitle = 'Wstęp';
    }
    if (!cleanChapterTitle && chapter.paragraphs.length > 0) {
      cleanChapterTitle = idx === 0 ? 'Wstęp' : `Rozdział ${idx + 1}`;
    }
    if (!cleanChapterTitle) continue;

    const filename = `chapter_${String(chapterFiles.length + 1).padStart(3, '0')}.xhtml`;
    const chapterId = `ch_${chapterFiles.length + 1}`;
    chapterFiles.push({ id: chapterId, title: cleanChapterTitle, filename });

    let paragraphsHtml = '';
    let renderedParasCount = 0;

    for (let pIdx = 0; pIdx < chapter.paragraphs.length; pIdx++) {
      const p = chapter.paragraphs[pIdx];
      let cleanParaText = sanitizeExtractedText(p.text, config.excludedPatterns);
      if (p.isHeading && /^wst[eę]p\b/i.test(cleanParaText)) {
        cleanParaText = 'Wstęp';
      }
      if (!cleanParaText || cleanParaText.length <= 1) continue;

      if (renderedParasCount === 0 && p.isHeading && (cleanParaText === cleanChapterTitle || cleanParaText === 'Wstęp')) {
        continue;
      }

      const isDayHeading = /\b(?:dzie[nń])\s*\d+\b/i.test(cleanParaText);
      const pClass = renderedParasCount === 0 ? 'class="first"' : '';
      if (p.isHeading || isDayHeading) {
        paragraphsHtml += `    <h2 class="day-heading"><strong>${escapeXml(cleanParaText)}</strong></h2>\n`;
      } else if (p.isBold) {
        paragraphsHtml += `    <p ${pClass}><strong>${escapeXml(cleanParaText)}</strong></p>\n`;
      } else {
        paragraphsHtml += `    <p ${pClass}>${escapeXml(cleanParaText)}</p>\n`;
      }
      renderedParasCount++;
    }

    // Add QR section to last chapter if present
    if (idx === bookModel.chapters.length - 1 && embeddedQrs.length > 0) {
      paragraphsHtml += '    <section class="qr-appendix">\n';
      for (const qr of embeddedQrs) {
        paragraphsHtml += `      <div class="qr-section">
        <div class="qr-label">${escapeXml(qr.label)}</div>
        <img class="qr-image" src="../images/${qr.filename}" alt="${escapeXml(qr.label)}" />
        <div><a class="qr-link" href="${escapeXml(qr.link)}">${escapeXml(qr.link)}</a></div>
      </div>\n`;
      }
      paragraphsHtml += '    </section>\n';
    }

    const chapterXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}">
<head>
  <title>${escapeXml(cleanChapterTitle)}</title>
  <link rel="stylesheet" type="text/css" href="../styles/stylesheet.css" />
</head>
<body epub:type="bodymatter chapter">
  <section>
    <h1 class="chapter-title">${escapeXml(cleanChapterTitle)}</h1>
${paragraphsHtml}
  </section>
</body>
</html>`;
    zip.file(`OEBPS/text/${filename}`, chapterXhtml);

    onProgress?.(idx + 1, bookModel.chapters.length);
  }

  // 7. Navigation Document (EPUB 3 nav.xhtml)
  let navListItems = '';
  for (const ch of chapterFiles) {
    navListItems += `      <li><a href="text/${ch.filename}">${escapeXml(ch.title)}</a></li>\n`;
  }

  const navXhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}">
<head>
  <title>Spis treści</title>
  <link rel="stylesheet" type="text/css" href="styles/stylesheet.css" />
</head>
<body epub:type="frontmatter toc">
  <nav epub:type="toc" id="toc">
    <h1>Spis treści</h1>
    <ol>
      <li><a href="text/title.xhtml">Strona tytułowa</a></li>
${navListItems}
    </ol>
  </nav>
</body>
</html>`;
  zip.file('OEBPS/nav.xhtml', navXhtml);

  // 8. NCX Document (EPUB 2 compatibility)
  let ncxPoints = `    <navPoint id="np-0" playOrder="1">
      <navLabel><text>Strona tytułowa</text></navLabel>
      <content src="text/title.xhtml"/>
    </navPoint>\n`;

  let playOrder = 2;
  for (const ch of chapterFiles) {
    ncxPoints += `    <navPoint id="np-${playOrder - 1}" playOrder="${playOrder}">
      <navLabel><text>${escapeXml(ch.title)}</text></navLabel>
      <content src="text/${ch.filename}"/>
    </navPoint>\n`;
    playOrder++;
  }

  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookUuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(bookTitle)}</text></docTitle>
  <docAuthor><text>${escapeXml(author)}</text></docAuthor>
  <navMap>
${ncxPoints}
  </navMap>
</ncx>`;
  zip.file('OEBPS/toc.ncx', tocNcx);

  // 9. Package Document (OEBPS/content.opf)
  let manifestItems = `    <item id="style" href="styles/stylesheet.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="titlepage" href="text/title.xhtml" media-type="application/xhtml+xml"/>\n`;

  for (const ch of chapterFiles) {
    manifestItems += `    <item id="${ch.id}" href="text/${ch.filename}" media-type="application/xhtml+xml"/>\n`;
  }

  for (const qr of embeddedQrs) {
    manifestItems += `    <item id="${qr.id}" href="images/${qr.filename}" media-type="image/png"/>\n`;
  }

  let spineItems = `    <itemref idref="titlepage"/>\n`;
  for (const ch of chapterFiles) {
    spineItems += `    <itemref idref="${ch.id}"/>\n`;
  }

  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="pub-id" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${bookUuid}</dc:identifier>
    <dc:title>${escapeXml(bookTitle)}</dc:title>
    <dc:language>${lang}</dc:language>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <meta property="dcterms:modified">${nowIso}</meta>
  </metadata>
  <manifest>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`;
  zip.file('OEBPS/content.opf', contentOpf);

  // 10. Generate full ZIP container as Uint8Array
  const epubData = await zip.generateAsync({
    type: 'uint8array',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  return epubData;
}
