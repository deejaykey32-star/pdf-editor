import JSZip from 'jszip';
import { EpubConfig, ExtractedBookModel } from '@/types/kdp-epub';
import { QRCodeItem } from '@/types/pdf';
import { generateQRPngBytes, resolvePageContent } from './qr-generator';

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
 * with 12pt base typography, full text justification, navigation TOC,
 * and aesthetic reader styling for Amazon KDP eBooks and e-readers.
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

  // 3. OEBPS/styles/stylesheet.css
  const stylesheetCss = `/* Standard EPUB 3 Stylesheet - 12pt Justified Layout for Amazon KDP */
@charset "UTF-8";

body {
  font-family: "Georgia", "Times New Roman", "Cambria", serif;
  font-size: ${config.fontSizePt || 12}pt;
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

h1.book-title {
  text-align: center;
  font-size: 2.2em;
  font-weight: bold;
  margin-top: 25%;
  margin-bottom: 0.3em;
  line-height: 1.2;
  page-break-before: always;
}

p.book-author {
  text-align: center;
  font-size: 1.2em;
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
  font-size: 1.6em;
  font-weight: bold;
  text-align: left;
  margin-top: 2em;
  margin-bottom: 1em;
  line-height: 1.3;
  page-break-before: always;
  color: #111;
  border-bottom: 2px solid #2563eb;
  padding-bottom: 0.3em;
}

h2 {
  font-size: 1.25em;
  margin-top: 1.5em;
  margin-bottom: 0.8em;
  text-align: left;
}

p {
  text-align: justify;
  text-justify: inter-word;
  text-indent: ${config.indentParagraphs !== false ? '1.25em' : '0'};
  margin-top: 0;
  margin-bottom: 0.4em;
  line-height: 1.5;
}

p.first, h1 + p, h2 + p {
  text-indent: 0;
}

.qr-section {
  text-align: center;
  margin: 2.5em auto;
  padding: 1.2em;
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
  font-size: 0.9em;
  font-weight: bold;
  color: #333;
  margin-bottom: 0.4em;
}

.qr-link {
  font-size: 0.8em;
  color: #2563eb;
  word-break: break-all;
  text-decoration: underline;
}

nav#toc ol {
  list-style-type: decimal;
  padding-left: 1.5em;
}

nav#toc li {
  margin-bottom: 0.6em;
}

nav#toc a {
  text-decoration: none;
  color: #2563eb;
}
`;
  zip.file('OEBPS/styles/stylesheet.css', stylesheetCss);

  const bookTitle = config.title || bookModel.title || 'Dokument A5';
  const author = config.author || bookModel.author || 'Autor';
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
    <p class="book-author">${escapeXml(author)}</p>
    <hr class="title-separator" />
    <p style="text-align: center; font-size: 0.85em; color: #777;">Wydanie cyfrowe ePUB (Gotowe dla Amazon KDP eBook)</p>
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

  // 6. Generate Chapters
  const chapterFiles: { id: string; title: string; filename: string }[] = [];

  for (let idx = 0; idx < bookModel.chapters.length; idx++) {
    const chapter = bookModel.chapters[idx];
    const filename = `chapter_${String(idx + 1).padStart(3, '0')}.xhtml`;
    const chapterId = `ch_${idx + 1}`;
    chapterFiles.push({ id: chapterId, title: chapter.title, filename });

    let paragraphsHtml = '';
    for (let pIdx = 0; pIdx < chapter.paragraphs.length; pIdx++) {
      const p = chapter.paragraphs[pIdx];
      if (pIdx === 0 && p.isHeading && p.text === chapter.title) {
        continue;
      }
      const pClass = pIdx === 0 ? 'class="first"' : '';
      if (p.isHeading) {
        paragraphsHtml += `    <h2>${escapeXml(p.text)}</h2>\n`;
      } else {
        paragraphsHtml += `    <p ${pClass}>${escapeXml(p.text)}</p>\n`;
      }
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
  <title>${escapeXml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="../styles/stylesheet.css" />
</head>
<body epub:type="bodymatter chapter">
  <section>
    <h1 class="chapter-title">${escapeXml(chapter.title)}</h1>
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
