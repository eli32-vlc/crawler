// Import the serve function from the Deno standard library
import { serve } from "https://deno.land/std@0.201.0/http/server.ts";

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

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Use POST with JSON { url: string }", {
      status: 405
    });
  }
  let url = "";
  try {
    const { url: u } = await req.json();
    url = u;
  } catch {
    return new Response("Bad JSON", {
      status: 400
    });
  }
  if (!validateUrl(url)) {
    return new Response("Invalid URL", {
      status: 400
    });
  }
  // Optionally: rate limit by IP, log, etc.
  return await fetchPage(url);
});
