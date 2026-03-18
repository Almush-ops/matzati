import type { APIRoute } from 'astro';
import { supabase } from '../lib/supabase';

export const prerender = true;

export const GET: APIRoute = async () => {
  const site = 'https://matzati.co.il';

  // Fetch definitions WITH solutions only (inner join) - to match actual built pages
  const { data: definitions } = await supabase
    .from('crossword_definitions')
    .select('slug, updated_at, crossword_solutions!inner(id)');

  // Fetch all words by length (2-15 letters)
  const wordLengths = Array.from({ length: 14 }, (_, i) => i + 2);

  // Fetch synonyms
  const { data: synonymWords } = await supabase
    .from('synonyms')
    .select('word')
    .limit(100);
  const uniqueSynonymWords = [...new Set(synonymWords?.map(s => s.word) || [])];

  // Fetch rhymes
  const { data: rhymeWords } = await supabase
    .from('rhymes')
    .select('word')
    .limit(100);
  const uniqueRhymeWords = [...new Set(rhymeWords?.map(r => r.word) || [])];

  // Build sitemap XML
  const urls: string[] = [];

  // Static pages
  const staticPages = [
    { loc: '/', priority: '1.0', changefreq: 'daily' },
    { loc: '/solver', priority: '0.9', changefreq: 'weekly' },
    { loc: '/synonyms', priority: '0.8', changefreq: 'weekly' },
    { loc: '/rhymes', priority: '0.8', changefreq: 'weekly' },
    { loc: '/words', priority: '0.8', changefreq: 'weekly' },
  ];

  staticPages.forEach(page => {
    urls.push(`
    <url>
      <loc>${site}${page.loc}</loc>
      <changefreq>${page.changefreq}</changefreq>
      <priority>${page.priority}</priority>
    </url>`);
  });

  // Definition pages
  definitions?.forEach(def => {
    urls.push(`
    <url>
      <loc>${site}/definition/${encodeURIComponent(def.slug)}</loc>
      <lastmod>${def.updated_at ? new Date(def.updated_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod>
      <changefreq>monthly</changefreq>
      <priority>0.7</priority>
    </url>`);
  });

  // Words by length pages
  wordLengths.forEach(len => {
    urls.push(`
    <url>
      <loc>${site}/words/${len}-letters</loc>
      <changefreq>weekly</changefreq>
      <priority>0.6</priority>
    </url>`);
  });

  // Synonym pages
  uniqueSynonymWords.forEach(word => {
    urls.push(`
    <url>
      <loc>${site}/synonyms/${encodeURIComponent(word)}</loc>
      <changefreq>monthly</changefreq>
      <priority>0.6</priority>
    </url>`);
  });

  // Rhyme pages
  uniqueRhymeWords.forEach(word => {
    urls.push(`
    <url>
      <loc>${site}/rhymes/${encodeURIComponent(word)}</loc>
      <changefreq>monthly</changefreq>
      <priority>0.6</priority>
    </url>`);
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
