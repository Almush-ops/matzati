/**
 * Scrape synonyms and rhymes from milog.co.il
 * Uses words from matzati_definitions solutions as seeds
 * Run with: node scripts/scrape-milog.js
 */

import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://yhrriccchchhjwozptzb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlocnJpY2NjaGNoaGp3b3pwdHpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1Mjk2MTcsImV4cCI6MjA4NjEwNTYxN30.Zhcm4WCQdpq1stZXJ1_GHCLidyBDbkzvbp1DlY12RRc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE_URL = 'https://milog.co.il';
const DELAY_MS = 800; // Be nice to the server

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

async function getSynonyms(word) {
  const encodedWord = encodeURIComponent(word);
  const url = `${BASE_URL}/${encodedWord}/s/%D7%A0%D7%A8%D7%93%D7%A4%D7%95%D7%AA`;

  const html = await fetchPage(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const synonyms = [];

  // Find synonym groups - they're in specific divs with comma-separated words
  $('div').each((_, el) => {
    const text = $(el).text();
    // Look for text that contains Hebrew words separated by commas
    // Skip if it contains "הפכים" (antonyms marker)
    if (text.includes('הפכים')) return;

    // Match patterns like "אוֹר, אוֹרָה, אֹשֶׁר"
    const hebrewWordsPattern = /^[\u0590-\u05FF\s,]+$/;
    if (hebrewWordsPattern.test(text.trim()) && text.includes(',')) {
      const words = text.split(',').map(w => w.trim()).filter(w => w.length > 0 && w.length < 20);
      if (words.length >= 2) {
        synonyms.push(...words);
      }
    }
  });

  // Deduplicate
  return [...new Set(synonyms)];
}

async function getRhymes(word) {
  const encodedWord = encodeURIComponent(word);
  const url = `${BASE_URL}/${encodedWord}/s/%D7%97%D7%A8%D7%95%D7%96%D7%99%D7%9D`;

  const html = await fetchPage(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const rhymes = [];

  // Find rhyme groups - similar structure to synonyms
  $('div').each((_, el) => {
    const text = $(el).text();
    const hebrewWordsPattern = /^[\u0590-\u05FF\s,״׳"']+$/;
    if (hebrewWordsPattern.test(text.trim()) && text.includes(',')) {
      const words = text.split(',').map(w => w.trim()).filter(w => w.length > 0 && w.length < 25);
      if (words.length >= 2) {
        rhymes.push(...words);
      }
    }
  });

  return [...new Set(rhymes)];
}

async function getWordsFromDB() {
  // Get unique solutions from definitions
  const { data, error } = await supabase
    .from('matzati_definitions')
    .select('solution')
    .order('solution');

  if (error) {
    console.error('Error fetching words:', error);
    return [];
  }

  // Get unique single words (no spaces)
  const words = [...new Set(data.map(d => d.solution).filter(w => !w.includes(' ')))];
  return words;
}

async function insertSynonyms(word, synonyms) {
  if (synonyms.length === 0) return;

  const records = synonyms.map(syn => ({
    word,
    synonym: syn,
    source: 'milog.co.il'
  }));

  const { error } = await supabase
    .from('matzati_synonyms')
    .upsert(records, {
      onConflict: 'word,synonym',
      ignoreDuplicates: true
    });

  if (error && !error.message.includes('duplicate')) {
    console.error('Synonym insert error:', error.message);
  }
}

async function insertRhymes(word, rhymes) {
  if (rhymes.length === 0) return;

  const records = rhymes.map(rhyme => ({
    word,
    rhyme,
    source: 'milog.co.il'
  }));

  const { error } = await supabase
    .from('rhymes')
    .upsert(records, {
      onConflict: 'word,rhyme',
      ignoreDuplicates: true
    });

  if (error && !error.message.includes('duplicate')) {
    console.error('Rhyme insert error:', error.message);
  }
}

async function main() {
  console.log('=== Starting Milog.co.il Scraper ===\n');

  // Wait a bit for the definitions scraper to collect some words
  console.log('Fetching words from database...');
  let words = await getWordsFromDB();

  if (words.length < 50) {
    console.log('Waiting 60s for more words from definitions scraper...');
    await sleep(60000);
    words = await getWordsFromDB();
  }

  console.log(`Found ${words.length} unique words to process\n`);

  let totalSynonyms = 0;
  let totalRhymes = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (i % 20 === 0) {
      console.log(`Processing word ${i + 1}/${words.length}: ${word}`);
    }

    // Get synonyms
    const synonyms = await getSynonyms(word);
    if (synonyms.length > 0) {
      await insertSynonyms(word, synonyms);
      totalSynonyms += synonyms.length;
    }
    await sleep(DELAY_MS);

    // Get rhymes
    const rhymes = await getRhymes(word);
    if (rhymes.length > 0) {
      await insertRhymes(word, rhymes);
      totalRhymes += rhymes.length;
    }
    await sleep(DELAY_MS);
  }

  console.log('\n=== Scraping Complete ===');
  console.log(`Total synonyms: ${totalSynonyms}`);
  console.log(`Total rhymes: ${totalRhymes}`);
}

main().catch(console.error);
