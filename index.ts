const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36";

const ALLOWED_DOMAINS: string[] = []; // Populate to restrict scraping

function validateUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    // Optionally restrict domains:
    // if (ALLOWED_DOMAINS.length && !ALLOWED_DOMAINS.includes(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin",
};

export default async function (context: any) {
  const { req, res, log, error } = context;

  if (req.method === "OPTIONS") {
    res.send("", 204, corsHeaders);
    return;
  }

  if (req.method !== "POST") {
    res.send("Use POST with JSON { url: string }", 405, {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
    });
    return;
  }

  let url = "";
  try {
    const body = await req.json();
    url = String(body?.url ?? "");
  } catch {
    res.send("Bad JSON", 400, {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
    });
    return;
  }

  if (!validateUrl(url)) {
    res.send("Invalid URL", 400, {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
    });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000); // 15s timeout

  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": DEFAULT_UA,
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        // Accept-Encoding is automatically negotiated; you can omit it.
        "Connection": "close",
      },
      redirect: "follow",
      method: "GET",
    });

    const contentType = upstream.headers.get("content-type") ?? "text/html";
    // Appwrite res.send expects a string or Uint8Array; we can't stream, so buffer.
    const body = new Uint8Array(await upstream.arrayBuffer());

    res.send(body, upstream.status, {
      ...corsHeaders,
      "Content-Type": contentType,
      "x-proxy-source": "appwrite-function",
    });
  } catch (e) {
    error?.(e);
    res.send("Failed to fetch page", 502, {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
    });
  } finally {
    clearTimeout(timeout);
  }
}
