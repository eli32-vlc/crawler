// JavaScript conversion of the Deno HTTP server script
const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36";
const ALLOWED_DOMAINS = []; // Populate if you want to restrict scraping

function validateUrl(url) {
  try {
    const u = new URL(url);
    if (![
      "http:",
      "https:"
    ].includes(u.protocol)) return false;
    // Optionally restrict domains:
    // if (ALLOWED_DOMAINS.length && !ALLOWED_DOMAINS.includes(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": DEFAULT_UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "close"
      },
      redirect: "follow",
      method: "GET"
    });
    // Only forward the minimal necessary headers
    const headers = new Headers();
    headers.set("content-type", resp.headers.get("content-type") ?? "text/html");
    headers.set("x-proxy-source", "supabase-edge");
    // Stream the response if possible (to save memory)
    return new Response(resp.body, {
      status: resp.status,
      headers
    });
  } catch (e) {
    return new Response("Failed to fetch page", {
      status: 502
    });
  } finally {
    clearTimeout(timeout);
  }
}

// Using Express or Node.js HTTP server instead of Deno's serve
const http = require('http');

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405);
    res.end("Use POST with JSON { url: string }");
    return;
  }

  let url = "";
  let body = [];
  
  req.on('data', (chunk) => {
    body.push(chunk);
  });

  req.on('end', async () => {
    try {
      body = Buffer.concat(body).toString();
      const { url: u } = JSON.parse(body);
      url = u;
      
      if (!validateUrl(url)) {
        res.writeHead(400);
        res.end("Invalid URL");
        return;
      }

      // Optionally: rate limit by IP, log, etc.
      const response = await fetchPage(url);
      
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      
      // Stream the response body
      const reader = response.body.getReader();
      const pipe = async () => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(value);
        await pipe();
      };
      
      await pipe();
      
    } catch (e) {
      res.writeHead(400);
      res.end("Bad JSON");
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
