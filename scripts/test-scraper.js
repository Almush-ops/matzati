import * as cheerio from 'cheerio';

const url = 'https://www.note.co.il/solution/%d7%90%d7%91%d7%9f-%d7%99%d7%a7%d7%a8%d7%94/';

async function test() {
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);

  // Get definition
  const definition = $('article h2').last().text().trim();
  console.log('Definition:', definition);

  // Get solutions text
  const text = $('article').text();
  const regex = /פתרון של (\d+) אותיות[^:]*:\s*([^\n]+)/g;
  let match;
  const solutions = [];

  while ((match = regex.exec(text)) !== null) {
    const length = parseInt(match[1]);
    const words = match[2].split(',').map(w => w.replace(/\([^)]*\)/g, '').trim()).filter(w => w);
    console.log(`Length ${length}:`, words.join(', '));
    solutions.push(...words.map(w => ({ solution: w, length })));
  }

  console.log('\nTotal solutions found:', solutions.length);
}

test().catch(console.error);
