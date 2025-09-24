export default {
  async fetch(req: Request): Promise<Response> {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");
    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: "Missing 'url' query parameter." }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Basic validation to prevent SSRF
    try {
      const parsed = new URL(targetUrl);
      // Optionally: block internal/private IPs, localhost, etc.
      // For demo: allow all public http/https
      if (!/^https?:$/.test(parsed.protocol)) {
        throw new Error("Only http(s) protocols are supported.");
      }
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL provided." }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }

    // Realistic browser-like headers (Chrome example)
    const browserHeaders = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      // Add more headers if needed for realism
    };

    try {
      const resp = await fetch(targetUrl, {
        method: "GET",
        headers: browserHeaders,
      });

      // Optionally, you can filter/modify the response here

      // Forward the status and headers, and allow CORS
      const proxiedHeaders = new Headers(resp.headers);
      proxiedHeaders.set("Access-Control-Allow-Origin", "*");
      proxiedHeaders.set("Content-Type", "text/html; charset=UTF-8");

      return new Response(resp.body, {
        status: resp.status,
        headers: proxiedHeaders,
      });
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch target: " + (e.message || e) }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
    }
  },
};
