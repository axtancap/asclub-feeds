import fs from "fs";
import { XMLParser } from "fast-xml-parser";

const PUBLICATION_NAME = "AS CLUB";
const LANGUAGE = "pt";

function escapeXml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function toArray(x) {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

async function main() {
  // Ler o RSS LOCAL (que acabou de ser gerado)
  const rssPath = "rss.xml";
  
  if (!fs.existsSync(rssPath)) {
    throw new Error("rss.xml não encontrado! Certifica-te que o script Python correu primeiro.");
  }

  console.log(`A ler RSS local: ${rssPath}`);
  
  const feedText = fs.readFileSync(rssPath, "utf8");
  const parser = new XMLParser({ ignoreAttributes: false });
  const data = parser.parse(feedText);

  let items = [];
  
  // RSS 2.0
  const rssItems = data?.rss?.channel?.item;
  if (rssItems) {
    items = toArray(rssItems).map(i => ({
      title: i.title,
      url: i.link,
      date: i.pubDate || i.date
    }));
  }

  // Filtrar últimas 48h
  const now = new Date();
  const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const filtered = items
    .map(i => ({
      title: (i.title || "").toString().trim(),
      url: (i.url || "").toString().trim(),
      date: new Date(i.date)
    }))
    .filter(i => i.title && i.url && !Number.isNaN(i.date.getTime()) && i.date >= cutoff)
    .slice(0, 1000);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
`;

  for (const i of filtered) {
    xml += `
  <url>
    <loc>${escapeXml(i.url)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(PUBLICATION_NAME)}</news:name>
        <news:language>${escapeXml(LANGUAGE)}</news:language>
      </news:publication>
      <news:publication_date>${i.date.toISOString()}</news:publication_date>
      <news:title>${escapeXml(i.title)}</news:title>
    </news:news>
  </url>`;
  }

  xml += `
</urlset>`;

  fs.writeFileSync("news-sitemap.xml", xml, "utf8");
  console.log(`✓ Gerado news-sitemap.xml com ${filtered.length} URLs (últimas 48h).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
