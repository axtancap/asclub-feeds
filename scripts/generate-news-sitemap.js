import fs from "fs";
import { XMLParser } from "fast-xml-parser";

const FEED_URL = process.env.FEED_URL;
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
  if (!FEED_URL) throw new Error("FEED_URL em falta.");

  console.log(`A buscar RSS de: ${FEED_URL}`);
  
  const res = await fetch(FEED_URL, { 
    headers: { "User-Agent": "asclub-sitemap-bot/1.0" } 
  });
  
  if (!res.ok) throw new Error(`Falha a buscar feed: ${res.status}`);

  const feedText = await res.text();
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

  // Atom (alternativa)
  const atomEntries = data?.feed?.entry;
  if (atomEntries) {
    items = toArray(atomEntries).map(e => ({
      title: e.title?.["#text"] ?? e.title,
      url: (toArray(e.link).find(l => l["@_rel"] === "alternate")?.["@_href"]) || toArray(e.link)[0]?.["@_href"],
      date: e.published || e.updated
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
