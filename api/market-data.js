// Vercel serverless function: live market quotes from Twelve Data.
//
// Returns a JSON array of:
//   { symbol, name, price, change, changePct, positive }
//
// Twelve Data's free tier allows only ~8 API credits per minute, and a batch
// /quote request costs 1 credit per symbol. Fetching all 18 at once (18
// credits) is rejected with HTTP 429. So instead we fetch a small rotating
// chunk on each call and accumulate the results in a module-level cache that
// survives across warm invocations — over a few cycles every symbol fills in
// and then stays refreshed. If a fetch is rate-limited we serve the cached
// data rather than failing, so the ticker never goes dark.
//
// The API key is read from process.env.TWELVE_DATA_API_KEY and never exposed.

// Twelve Data's free tier doesn't include index data (S&P 500, NASDAQ, etc.)
// or some commodity/forex pairs, so for those we fetch a US-listed ETF proxy
// that IS covered. `symbol` is the actual ticker requested from Twelve Data;
// `name` is the label shown in the ticker (it notes the proxy ticker so the
// price level, e.g. SPY ~600 vs the S&P index ~5,500, isn't misleading).
const SYMBOLS = [
  { symbol: "SPY", name: "S&P 500 (SPY)" },
  { symbol: "QQQ", name: "NASDAQ 100 (QQQ)" },
  { symbol: "DIA", name: "Dow Jones (DIA)" },
  { symbol: "EWU", name: "FTSE / UK (EWU)" },
  { symbol: "EWG", name: "DAX / Germany (EWG)" },
  { symbol: "EWJ", name: "Nikkei / Japan (EWJ)" },
  { symbol: "VIXY", name: "VIX (VIXY)" },
  { symbol: "XAU/USD", name: "Gold" },
  { symbol: "SLV", name: "Silver (SLV)" },
  { symbol: "USO", name: "Crude Oil (USO)" },
  { symbol: "BTC/USD", name: "Bitcoin" },
  { symbol: "ETH/USD", name: "Ethereum" },
  { symbol: "AAPL", name: "Apple (AAPL)" },
  { symbol: "MSFT", name: "Microsoft (MSFT)" },
  { symbol: "NVDA", name: "NVIDIA (NVDA)" },
  { symbol: "AMZN", name: "Amazon (AMZN)" },
  { symbol: "TSLA", name: "Tesla (TSLA)" },
  { symbol: "META", name: "Meta (META)" },
];

// 6 symbols/call keeps us comfortably under the 8-credit/min free-tier cap and
// cycles through all 18 in three calls (~3 minutes at the client's 60s poll).
const CHUNK_SIZE = 6;
const NUM_CHUNKS = Math.ceil(SYMBOLS.length / CHUNK_SIZE);

// These persist across warm invocations of the same serverless instance.
const cache = Object.create(null); // symbol -> result object
let rotation = 0;

function quoteFor(payload, symbol) {
  if (payload && Object.prototype.hasOwnProperty.call(payload, symbol)) {
    return payload[symbol];
  }
  if (payload && payload.symbol === symbol) return payload;
  return null;
}

function cachedArray() {
  return SYMBOLS.map((s) => cache[s.symbol]).filter(Boolean);
}

module.exports = async function handler(req, res) {
  // allow the static frontend (any origin) to call this endpoint
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  // brief edge cache to dedupe bursts without starving the rotation
  res.setHeader("Cache-Control", "s-maxage=20, stale-while-revalidate=40");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server is missing TWELVE_DATA_API_KEY." });
    }

    // pick the next rotating chunk of symbols to refresh
    const idx = rotation % NUM_CHUNKS;
    rotation += 1;
    const chunk = SYMBOLS.slice(idx * CHUNK_SIZE, idx * CHUNK_SIZE + CHUNK_SIZE);

    const symbolList = chunk.map((s) => s.symbol).join(",");
    const url =
      "https://api.twelvedata.com/quote?symbol=" +
      encodeURIComponent(symbolList) +
      "&apikey=" +
      encodeURIComponent(apiKey);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Twelve Data request failed with status " + response.status);
    }

    const payload = await response.json();

    // A whole-request failure comes back as { code, message, status: "error" }.
    if (payload && payload.status === "error") {
      throw new Error(payload.message || "Twelve Data returned an error.");
    }

    // merge this chunk's quotes into the cache
    chunk.forEach(({ symbol, name }) => {
      const q = quoteFor(payload, symbol);
      if (!q || q.status === "error" || q.code) return; // skip unresolved symbols

      const price = parseFloat(q.close != null ? q.close : q.price);
      const change = parseFloat(q.change);
      const changePct = parseFloat(q.percent_change);
      if (!isFinite(price)) return;

      const safeChangePct = isFinite(changePct) ? changePct : 0;
      cache[symbol] = {
        symbol,
        name,
        price,
        change: isFinite(change) ? change : 0,
        changePct: safeChangePct,
        positive: safeChangePct >= 0,
      };
    });

    const data = cachedArray();
    if (data.length === 0) {
      return res.status(500).json({ error: "No market data is available yet." });
    }
    return res.status(200).json(data);
  } catch (err) {
    // On rate-limit or any failure, serve whatever we've cached so far so the
    // ticker keeps showing data instead of falling back to placeholders.
    const data = cachedArray();
    if (data.length > 0) {
      return res.status(200).json(data);
    }
    return res
      .status(500)
      .json({ error: err && err.message ? err.message : "Failed to fetch market data." });
  }
};
