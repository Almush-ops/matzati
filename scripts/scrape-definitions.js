/**
 * Scrape crossword definitions from note.co.il
 * Run with: node scripts/scrape-definitions.js
 */

import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yhrriccchchhjwozptzb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocnJpY2NjaGNoaGp3b3pwdHpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1Mjk2MTcsImV4cCI6MjA4NjEwNTYxN30.Zhcm4WCQdpq1stZXJ1_GHCLidyBDbkzvbp1DlY12RRc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const HEBREW_LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'];
const BASE_URL = 'https://www.note.co.il';
const DELAY_MS = 500; // Be nice to the server

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8'
      }
    });
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    return null;
  }
}

async function getDefinitionUrls(letter) {
  const urls = [];
  let page = 1;

  while (true) {
    const encodedLetter = encodeURIComponent(letter);
    const url = page === 1
      ? `${BASE_URL}/abc/${encodedLetter}/`
      : `${BASE_URL}/abc/${encodedLetter}/page/${page}/`;

    console.log(`  Fetching letter ${letter} page ${page}...`);
    const html = await fetchPage(url);
    if (!html) break;

    const $ = cheerio.load(html);
    const links = $('article h3 a');

    if (links.length === 0) break;

    links.each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('/solution/')) {
        urls.push(href);
      }
    });

    // Check if there's a next page
    const hasNextPage = $(`a[href*="/page/${page + 1}/"]`).length > 0;
    if (!hasNextPage) break;

    page++;
    await sleep(DELAY_MS);
  }

  return urls;
}

function parseSolutions(text) {
  const solutions = [];

  // Pattern: "פתרון של X אותיות: word1, word2 (note), word3"
  const regex = /פתרון של (\d+) אותיות[^:]*:\s*([^\n]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const length = parseInt(match[1]);
    let solutionsText = match[2];

    // Remove ALL parenthetical notes first (before splitting)
    solutionsText = solutionsText.replace(/\([^)]*\)/g, '');

    // Split by comma and clean up
    const words = solutionsText.split(',').map(w => w.trim()).filter(w => w.length > 0);

    for (const word of words) {
      solutions.push({ solution: word, solution_length: length });
    }
  }

  // Also handle "פתרון של X מילים" (multi-word solutions)
  const multiWordRegex = /פתרון של (\d+) מילים[^:]*:\s*([^\n]+)/g;
  while ((match = multiWordRegex.exec(text)) !== null) {
    const solutionsText = match[2];
    const words = solutionsText.split(',').map(w => {
      return w.replace(/\([^)]*\)/g, '').trim();
    }).filter(w => w.length > 0);

    for (const word of words) {
      // Count Hebrew letters only for length
      const hebrewLength = word.replace(/[^א-ת]/g, '').length;
      solutions.push({ solution: word, solution_length: hebrewLength });
    }
  }

  return solutions;
}

async function scrapeDefinition(url) {
  const html = await fetchPage(url);
  if (!html) return null;

  const $ = cheerio.load(html);

  // Get definition from h2
  const definition = $('article h2').last().text().trim();
  if (!definition) return null;

  // Get category
  const category = $('article ul li a').first().text().trim() || null;

  // Get solutions text
  const solutionsContainer = $('article .solutions, article p').text();
  const solutions = parseSolutions(solutionsContainer);

  if (solutions.length === 0) return null;

  return {
    definition,
    category,
    solutions
  };
}

async function insertDefinitions(definitions) {
  if (definitions.length === 0) return;

  // Prepare records for insertion
  const records = [];
  for (const def of definitions) {
    for (const sol of def.solutions) {
      records.push({
        definition: def.definition,
        solution: sol.solution,
        solution_length: sol.solution_length,
        source: 'note.co.il'
      });
    }
  }

  // Insert in batches
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase
      .from('matzati_definitions')
      .upsert(batch, {
        onConflict: 'definition,solution',
        ignoreDuplicates: true
      });

    if (error) {
      console.error('Insert error:', error.message);
    }
  }

  console.log(`  Inserted ${records.length} definition-solution pairs`);
}

async function main() {
  console.log('=== Starting Note.co.il Scraper ===\n');

  let totalDefinitions = 0;
  let totalSolutions = 0;

  for (const letter of HEBREW_LETTERS) {
    console.log(`\n[${letter}] Processing letter...`);

    // Get all definition URLs for this letter
    const urls = await getDefinitionUrls(letter);
    console.log(`  Found ${urls.length} definitions`);

    // Scrape each definition
    const definitions = [];
    for (let i = 0; i < urls.length; i++) {
      if (i % 10 === 0) {
        console.log(`  Scraping ${i + 1}/${urls.length}...`);
      }

      const data = await scrapeDefinition(urls[i]);
      if (data) {
        definitions.push(data);
        totalSolutions += data.solutions.length;
      }

      await sleep(DELAY_MS);
    }

    totalDefinitions += definitions.length;

    // Insert to database
    await insertDefinitions(definitions);

    console.log(`  Letter ${letter} complete: ${definitions.length} definitions`);
  }

  console.log('\n=== Scraping Complete ===');
  console.log(`Total definitions: ${totalDefinitions}`);
  console.log(`Total solutions: ${totalSolutions}`);
}

main().catch(console.error);
