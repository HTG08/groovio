
const https = require("https");

const SEARCH_LIMIT = 10;
const CACHE_DURATION = 5 * 60 * 1000;
const MIN_SEARCH_INTERVAL = 3000;

const cache = new Map();
const lastSearch = new Map();

function fetchYouTube(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { timeout: 10000 }, (response) => {
        let body = "";

        response.on("data", (chunk) => {
          body += chunk;

          if (body.length > 1024 * 1024) {
            response.destroy();
            reject(new Error("YouTube response too large"));
          }
        });

        response.on("end", () => {
          try {
            resolve({
              status: response.statusCode,
              data: JSON.parse(body)
            });
          } catch {
            reject(new Error("Invalid YouTube response"));
          }
        });

        response.on("error", reject);
      })
      .on("error", reject)
      .on("timeout", function () {
        this.destroy(new Error("YouTube request timed out"));
      });
  });
}

async function searchYouTube(req, res) {
  const query = String(req.query.q || "").trim();

  if (query.length < 2 || query.length > 100) {
    return res.status(400).json({
      success: false,
      message: "Search must contain 2 to 100 characters."
    });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    return res.status(503).json({
      success: false,
      message: "YouTube API key is not configured."
    });
  }

  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.time < CACHE_DURATION) {
    return res.json({
      success: true,
      results: cached.results,
      cached: true
    });
  }

  const clientIp = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const previous = lastSearch.get(clientIp) || 0;

  if (now - previous < MIN_SEARCH_INTERVAL) {
    return res.status(429).json({
      success: false,
      message: "Please wait a few seconds before searching again."
    });
  }

  lastSearch.set(clientIp, now);

  try {
    const url = new URL(
      "https://www.googleapis.com/youtube/v3/search"
    );

    url.searchParams.set("part", "snippet");
    url.searchParams.set("q", query);
    url.searchParams.set("type", "video");
    url.searchParams.set("videoEmbeddable", "true");
    url.searchParams.set("maxResults", String(SEARCH_LIMIT));
    url.searchParams.set("key", apiKey);

    const response = await fetchYouTube(url);

    if (response.status !== 200) {
      console.error(
        "YouTube API error:",
        response.status,
        response.data?.error?.message
      );

      return res.status(502).json({
        success: false,
        message:
          response.status === 403
            ? "YouTube API access denied or quota exceeded."
            : "YouTube search is temporarily unavailable."
      });
    }

    const results = (response.data.items || [])
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        artist: item.snippet.channelTitle,
        thumbnail:
          item.snippet.thumbnails?.medium?.url || "",
        source: "youtube",
        youtubeId: item.id.videoId
      }));

    cache.set(cacheKey, {
      time: Date.now(),
      results
    });

    // Remove expired cache entries periodically.
    if (cache.size > 200) {
      for (const [key, value] of cache) {
        if (Date.now() - value.time > CACHE_DURATION) {
          cache.delete(key);
        }
      }
    }

    return res.json({
      success: true,
      results,
      cached: false
    });
  } catch (error) {
    console.error("YouTube search failed:", error.message);

    return res.status(502).json({
      success: false,
      message: "Could not connect to YouTube."
    });
  }
}

module.exports = { searchYouTube };
