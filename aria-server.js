/**
 * ARIA Sandbox Server
 * 
 * A lightweight Node.js/Express backend that gives ARIA
 * safe, controlled access to the filesystem and terminal.
 * 
 * Start with: node aria-server.js
 * Runs on:    http://localhost:3001
 * 
 * Security model:
 *  - All file ops are restricted to the ARIA_WORKSPACE directory
 *  - Commands are run in a sandboxed shell with a 10s timeout
 *  - Dangerous commands (rm -rf, format, etc.) are blocked
 */

const express  = require('express');
const cors     = require('cors');
const { exec } = require('child_process');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const Validator = require('./validator');

const app  = express();
const PORT = 3001;
const validator = new Validator();

// Web Search imports (dynamic because they might be ESM)
let ddg;
let ddgImages;
(async () => {
  ddg = await import('duck-duck-scrape');
  ddgImages = require('duckduckgo-images-api');
})();

// ── Workspace Observer (F-18) ────────────────────────────────────────────────
fs.watch(__dirname, { recursive: true }, (eventType, filename) => {
  if (filename && !filename.includes('node_modules') && !filename.includes('.git') && !filename.includes('aria_workspace')) {
    // We don't have direct access to the DB here easily without more setup, 
    // so we'll just log to console for now or we could emit to a socket if we had one.
    // Actually, we can just print it and the agent can read the server logs if needed.
    console.log(`[OBSERVER] ${eventType}: ${filename}`);
  }
});

// ── Sandbox workspace ─────────────────────────────────────────────────────────
const WORKSPACE = path.join(__dirname, 'aria_workspace');
if (!fs.existsSync(WORKSPACE)) fs.mkdirSync(WORKSPACE, { recursive: true });

// ── Safety blocklist ──────────────────────────────────────────────────────────
const BLOCKED = [
  /rm\s+-rf/i, /rmdir\s+\/s/i, /format\s+c/i,
  /del\s+\/f/i, /shutdown/i, /reboot/i, /mkfs/i,
  /drop\s+database/i, /truncate/i,
  /:(){:|:&};:/,  // fork bomb
];

function isSafe(cmd) {
  return !BLOCKED.some(p => p.test(cmd));
}

function resolveSafe(filePath) {
  const resolved = path.resolve(WORKSPACE, filePath);
  if (!resolved.startsWith(WORKSPACE)) throw new Error('Path traversal blocked');
  return resolved;
}

app.use(cors());
app.use(express.json());

// ── GET /health ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ ok: true, workspace: WORKSPACE });
});

// ── POST /write ───────────────────────────────────────────────────────────────
app.post('/write', (req, res) => {
  try {
    const { filePath, content } = req.body;
    if (!filePath) return res.status(400).json({ error: 'filePath required' });
    const safe = resolveSafe(filePath);
    fs.mkdirSync(path.dirname(safe), { recursive: true });
    fs.writeFileSync(safe, content || '', 'utf8');
    res.json({ ok: true, path: safe });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /read ────────────────────────────────────────────────────────────────
app.post('/read', (req, res) => {
  try {
    const { filePath } = req.body;
    const safe = resolveSafe(filePath);
    const content = fs.readFileSync(safe, 'utf8');
    res.json({ ok: true, content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /list ────────────────────────────────────────────────────────────────
app.post('/list', (req, res) => {
  try {
    const { dir } = req.body;
    const safe = dir ? resolveSafe(dir) : WORKSPACE;
    const files = fs.readdirSync(safe).map(name => {
      const full = path.join(safe, name);
      const stat = fs.statSync(full);
      return { name, isDir: stat.isDirectory(), size: stat.size };
    });
    res.json({ ok: true, files });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /delete ──────────────────────────────────────────────────────────────
app.post('/delete', (req, res) => {
  try {
    const { filePath } = req.body;
    const safe = resolveSafe(filePath);
    fs.rmSync(safe, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /run ─────────────────────────────────────────────────────────────────
// Execute a shell command inside the workspace with timeout
app.post('/run', (req, res) => {
  const { command, cwd } = req.body;
  if (!command) return res.status(400).json({ error: 'command required' });
  if (!isSafe(command)) return res.status(403).json({ error: 'Command blocked by safety policy' });

  const safeCwd = cwd ? resolveSafe(cwd) : WORKSPACE;

  exec(command, {
    cwd: safeCwd,
    timeout: 15000,
    maxBuffer: 2 * 1024 * 1024,
    shell: process.platform === 'win32' ? 'powershell.exe' : '/bin/bash',
  }, (err, stdout, stderr) => {
    res.json({
      ok:       !err,
      stdout:   stdout || '',
      stderr:   stderr || '',
      exitCode: err?.code || 0,
      error:    err?.message || null,
    });
  });
});

// ── POST /validate ───────────────────────────────────────────────────────────
app.post('/validate', (req, res) => {
  const { code, filename } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });
  const result = validator.validate(code, filename);
  res.json(result);
});

// ── POST /test ────────────────────────────────────────────────────────────────
// Write + run in one step (the "sandbox test" step)
app.post('/test', async (req, res) => {
  const { testCode, language, skipValidation } = req.body;
  if (!testCode) return res.status(400).json({ error: 'testCode required' });

  // Optional pre-validation
  if (!skipValidation) {
    const v = validator.validate(testCode);
    if (!v.valid && v.recommendation === 'reject') {
      return res.status(403).json({ error: 'Validation failed: Unsafe code patterns detected', details: v });
    }
  }

  const ext = language === 'python' ? '.py' : '.js';
  const testFile = `sandbox_test_${Date.now()}${ext}`;
  const safePath = resolveSafe(testFile);

  try {
    fs.writeFileSync(safePath, testCode, 'utf8');
    const runner = language === 'python' ? 'python' : 'node';
    const result = await new Promise((resolve) => {
      exec(`${runner} "${safePath}"`, { cwd: WORKSPACE, timeout: 10000, maxBuffer: 512 * 1024 },
        (err, stdout, stderr) => resolve({ ok: !err, stdout, stderr, error: err?.message })
      );
    });
    // Clean up test file
    try { fs.unlinkSync(safePath); } catch {}
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /ollama-generate ─────────────────────────────────────────────────────
// Proxy for Ollama (avoids CORS if needed)
app.post('/ollama-generate', async (req, res) => {
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /git/snapshot ───────────────────────────────────────────────────────
app.post('/git/snapshot', (req, res) => {
  const { message } = req.body;
  const msg = message ? `AI_SNAPSHOT: ${message}` : `AI_SNAPSHOT: session_${Date.now()}`;
  
  exec('git add -A && git commit -m "' + msg + '"', { cwd: __dirname }, (err, stdout, stderr) => {
    if (err && !stdout.includes('nothing to commit')) {
      return res.status(500).json({ error: err.message, stderr });
    }
    res.json({ ok: true, message: msg, output: stdout });
  });
});

// ── POST /git/rollback ───────────────────────────────────────────────────────
app.post('/git/rollback', (req, res) => {
  exec('git reset --hard HEAD~1', { cwd: __dirname }, (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: err.message, stderr });
    res.json({ ok: true, output: stdout });
  });
});

// ── POST /search ─────────────────────────────────────────────────────────────
app.post('/search', (req, res) => {
  const { query, dir } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });
  
  const searchDir = dir ? resolveSafe(dir) : __dirname;
  const results = [];
  const q = query.toLowerCase();

  const walk = (d) => {
    const files = fs.readdirSync(d);
    for (const f of files) {
      const p = path.join(d, f);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        if (['node_modules', '.git', 'aria_workspace', 'dist'].includes(f)) continue;
        walk(p);
      } else {
        const content = fs.readFileSync(p, 'utf8');
        if (content.toLowerCase().includes(q)) {
          const lines = content.split('\n');
          lines.forEach((line, i) => {
            if (line.toLowerCase().includes(q)) {
              results.push(`${path.relative(__dirname, p)}:${i + 1}: ${line.trim()}`);
            }
          });
        }
      }
      if (results.length > 100) break;
    }
  };

  try {
    walk(searchDir);
    res.json({ results: results.slice(0, 50), count: results.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const axios = require('axios');
const cheerio = require('cheerio');

// ── WEB SEARCH (Improved Logic from MY_AI) ────────────────────────────────────

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json, text/html, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

  // ── Web Search functions ──────────────────────────────────────────────────────
const scrapeDDGWeb = async (query) => {
  try {
    const res = await axios.get(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        ...BROWSER_HEADERS,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      timeout: 10000
    });
    const $ = cheerio.load(res.data);
    const results = [];
    $('.result').each((i, el) => {
      if (i >= 15) return;
      const title = $(el).find('.result__a').text().trim();
      const url = $(el).find('.result__a').attr('href');
      const snippet = $(el).find('.result__snippet').text().trim();
      
      if (title && url) {
        // DDG HTML URLs are often proxied: /l/?kh=-1&uddg=https://example.com
        let finalUrl = url;
        if (url.includes('uddg=')) {
          const parts = url.split('uddg=');
          finalUrl = decodeURIComponent(parts[1].split('&')[0]);
        }
        
        results.push({
          title,
          url: finalUrl,
          description: snippet || 'No description available.',
          hostname: new URL(finalUrl).hostname.replace('www.', '')
        });
      }
    });
    return results;
  } catch (e) {
    console.error('[DDG WEB SCRAPE FAIL]', e.message);
    return [];
  }
};

app.post('/api/web/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });
    
    console.log(`[WEB SEARCH] Query: ${query}`);
    
    let results = [];

    // 1. DuckDuckGo Scraper (Primary for diverse results)
    try {
      const ddgResults = await scrapeDDGWeb(query);
      results = [...ddgResults];
    } catch (e) { console.warn('[DDG SEARCH FAIL]', e.message); }

    // 2. Wikipedia Results (Contextual)
    try {
      const wikiRes = await axios.get("https://en.wikipedia.org/w/api.php", {
        params: { action: "opensearch", search: query, limit: 3, format: "json" },
        headers: { ...BROWSER_HEADERS, "Api-User-Agent": "ARIA/1.0" },
        timeout: 5000,
      });
      const [, titles, descriptions, urls] = wikiRes.data;
      titles.forEach((t, i) => {
        results.push({
          title: t,
          description: descriptions[i] || `Detailed information about ${t} on Wikipedia.`,
          url: urls[i],
          hostname: 'wikipedia.org'
        });
      });
    } catch (e) { console.warn('[WIKI SEARCH FAIL]', e.message); }

    // Deduplicate
    const seen = new Set();
    const finalResults = results.filter(r => {
      if (!r.url || seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });

    res.json(finalResults);
  } catch (e) {
    console.error('[WEB SEARCH ERROR]', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Image Search Functions (Adapted from MY_AI) ────────────────────────────────
const getWikipediaImages = async (query, count) => {
  try {
    const searchRes = await axios.get("https://en.wikipedia.org/w/api.php", {
      params: { action: "opensearch", search: query, limit: 1, format: "json" },
      headers: { ...BROWSER_HEADERS, 'User-Agent': 'ARIA-Assistant-Bot/1.0 (https://aria-ai.io; contact@aria-ai.io)' },
      timeout: 8000,
    });
    const titles = searchRes.data?.[1] || [];
    if (!titles.length) return [];
    const title = titles[0];

    const imgListRes = await axios.get("https://en.wikipedia.org/w/api.php", {
      params: { action: "query", titles: title, prop: "images", imlimit: 30, format: "json", redirects: 1 },
      headers: { ...BROWSER_HEADERS, 'User-Agent': 'ARIA-Assistant-Bot/1.0 (https://aria-ai.io; contact@aria-ai.io)' },
      timeout: 8000,
    });
    const pages = imgListRes.data?.query?.pages || {};
    const page = Object.values(pages)[0];
    const imgList = page?.images || [];

    const filtered = imgList
      .map((i) => i.title)
      .filter((t) => t.match(/\.(jpg|jpeg|png|gif|webp)$/i) && !t.match(/icon|logo|flag|seal|banner|symbol|coat|emblem|map|blank/i))
      .slice(0, count);

    if (!filtered.length) return [];

    const infoRes = await axios.get("https://en.wikipedia.org/w/api.php", {
      params: { action: "query", titles: filtered.join("|"), prop: "imageinfo", iiprop: "url|thumburl", iiurlwidth: 400, format: "json" },
      headers: { ...BROWSER_HEADERS, 'User-Agent': 'ARIA-Assistant-Bot/1.0 (https://aria-ai.io; contact@aria-ai.io)' },
      timeout: 8000,
    });
    const imagePages = infoRes.data?.query?.pages || {};
    return Object.values(imagePages)
      .filter((p) => p.imageinfo?.[0]?.url)
      .map((p) => ({
        image: p.imageinfo[0].url,
        thumbnail: p.imageinfo[0].thumburl || p.imageinfo[0].url,
        title: p.title.replace("File:", ""),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      }));
  } catch (err) {
    console.error("Wikipedia images error:", err.message);
    return [];
  }
};

const scrapeBingImages = async (query, count = 30, offset = 0) => {
  try {
    const first = offset + 1; // Bing pagination is 1-indexed for the first result
    const res = await axios.get(`https://www.bing.com/images/search?q=${encodeURIComponent(query)}&safeSearch=off&first=${first}`, {
      headers: {
        ...BROWSER_HEADERS,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      timeout: 10000
    });
    const $ = cheerio.load(res.data);
    const results = [];
    $('.iusc').each((i, el) => {
      if (i >= count) return;
      try {
        const m = JSON.parse($(el).attr('m'));
        if (m && m.murl) {
          results.push({
            image: m.murl,
            thumbnail: m.turl || m.murl,
            title: m.t || query,
            url: m.purl || '#'
          });
        }
      } catch (e) {}
    });
    return results;
  } catch (e) {
    console.error('[BING IMAGE SCRAPE FAIL]', e.message);
    return [];
  }
};

app.post('/api/web/images', async (req, res) => {
  try {
    const { query, iterations = 1 } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });
    
    console.log(`[IMAGE SEARCH] Query: ${query}, Iterations: ${iterations}`);
    
    let results = [];
    const offset = (iterations - 1) * 30;

    // 1. Wikipedia Page Images (Only on first iteration to avoid repeats)
    if (iterations === 1) {
      try {
        const wikiImgs = await getWikipediaImages(query, 15);
        results = [...wikiImgs];
      } catch (e) {}
    }

    // 2. Bing Images Scraper (Highly resilient with pagination)
    const bingImgs = await scrapeBingImages(query, 30, offset);
    results = [...results, ...bingImgs];

    // 3. Wikimedia Commons Search
    if (results.length < 10) {
      try {
        const commonsRes = await axios.get("https://commons.wikimedia.org/w/api.php", {
          params: {
            action: "query",
            generator: "search",
            gsrnamespace: 6,
            gsrsearch: query,
            gsrlimit: 30,
            gsroffset: offset,
            prop: "imageinfo",
            iiprop: "url|thumburl",
            iiurlwidth: 400,
            format: "json",
          },
          headers: BROWSER_HEADERS,
          timeout: 8000,
        });

        const pages = commonsRes.data?.query?.pages || {};
        Object.values(pages).forEach(p => {
          const info = p.imageinfo?.[0];
          if (info && info.url && info.url.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
            results.push({
              image: info.url,
              thumbnail: info.thumburl || info.url,
              title: p.title.replace("File:", "").split('.')[0],
              url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`
            });
          }
        });
      } catch (e) { console.warn('[COMMONS IMAGE FAIL]', e.message); }
    }

    // 4. Fallback: DDG Images
    if (results.length < 5 && ddg) {
      try {
        const ddgRes = await ddg.searchImages(query, {
          safeSearch: ddg.SafeSearchType.OFF,
          iterations: iterations
        });
        if (ddgRes && ddgRes.length > 0) {
          ddgRes.forEach(img => {
            results.push({
              image: img.image,
              thumbnail: img.thumbnail || img.image,
              title: img.title,
              url: img.url
            });
          });
        }
      } catch (e) { console.warn('[DDG LIB IMAGE FAIL]', e.message); }
    }

    // Deduplicate
    const seen = new Set();
    const finalResults = results.filter(img => {
      if (!img.image || seen.has(img.image)) return false;
      seen.add(img.image);
      return true;
    });

    res.json(finalResults);
  } catch (e) {
    console.error('[IMAGE SEARCH ERROR]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/web/wiki', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });
    
    console.log(`[WIKI SEARCH] Query: ${query}`);
    
    const ua = 'ARIA-Assistant/1.0 (contact@aria-ai.io)';

    // 1. Search for title
    const searchRes = await axios.get(`https://en.wikipedia.org/w/api.php`, {
      params: { action: 'query', list: 'search', srsearch: query, format: 'json' },
      headers: { 'User-Agent': ua }
    });
    
    const searchResults = searchRes.data.query?.search;
    if (!searchResults || searchResults.length === 0) {
      return res.status(404).json({ error: 'Wikipedia article not found' });
    }

    const bestTitle = searchResults[0].title;

    // 2. Get detailed summary, extract and thumbnail
    const summaryRes = await axios.get(`https://en.wikipedia.org/w/api.php`, {
      params: { 
        action: 'query', 
        prop: 'extracts|pageimages', 
        exintro: false, // Get more than just intro
        explaintext: true, 
        titles: bestTitle, 
        pithumbsize: 800,
        exsentences: 15, // More sentences for "more text contents"
        format: 'json',
        redirects: 1
      },
      headers: { 'User-Agent': ua }
    });
    
    const pages = summaryRes.data?.query?.pages || {};
    const page = Object.values(pages)[0];
    
    if (!page || page.missing) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Map to a cleaner format for frontend
    const result = {
      title: page.title,
      extract: page.extract,
      thumbnail: page.thumbnail ? { source: page.thumbnail.source } : null,
      content_urls: {
        desktop: { page: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}` }
      }
    };
    
    res.json(result);
  } catch (e) {
    console.error('[WIKI SEARCH ERROR]', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/web/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('URL required');
    
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': BROWSER_HEADERS['User-Agent'],
        'Referer': ''
      },
      timeout: 10000
    });
    
    res.set('Content-Type', response.headers['content-type']);
    res.send(response.data);
  } catch (e) {
    res.status(500).send('Proxy error');
  }
});

// ── AI Search Summary ─────────────────────────────────────────────────────────
app.post('/api/web/ai-summary', async (req, res) => {
  try {
    const { query, results } = req.body;
    if (!query || !results) return res.status(400).json({ error: 'Query and results required' });

    const context = results.slice(0, 5).map(r => `Title: ${r.title}\nDescription: ${r.description}\nURL: ${r.url}`).join('\n\n');
    
    const prompt = `You are ARIA's search synthesizer. Provide a concise, professional summary of the top search results for "${query}". 
Highlight key facts and data points. Format with Markdown. Keep it under 150 words.

SEARCH RESULTS:
${context}

SUMMARY:`;

    const ollamaRes = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3.2', // Or whatever default is used
      prompt: prompt,
      stream: false
    });

    res.json({ summary: ollamaRes.data.response });
  } catch (e) {
    console.error('[AI SUMMARY ERROR]', e.message);
    res.status(500).json({ error: 'Failed to generate AI summary' });
  }
});

app.listen(PORT, () => {
  console.log(`\n🔮 ARIA Sandbox Server running on http://localhost:${PORT}`);
  console.log(`📁 Workspace: ${WORKSPACE}`);
  console.log(`🛡  Safety: ${BLOCKED.length} command patterns blocked\n`);
});
