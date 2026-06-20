// Vercel serverless function: live market quotes from Twelve Data.
//
// Returns a JSON array of:
//   { symbol, name, price, change, changePct, positive }
//
// All symbols are fetched in a single batch /quote request to minimise API
// credit usage. The API key is read from process.env.TWELVE_DATA_API_KEY and
// is never exposed to the client.

const SYMBOLS = [
  { symbol: "SPX", name: "S&P 500" },
  { symbol: "IXIC", name: "NASDAQ" },
  { symbol: "DJI", name: "DOW JONES" },
  { symbol: "FTSE", name: "FTSE 100" },
  { symbol: "DAX", name: "DAX" },
  { symbol: "N225", name: "NIKKEI 225" },
  { symbol: "VIX", name: "VIX" },
  { symbol: "XAU/USD", name: "Gold" },
  { symbol: "XAG/USD", name: "Silver" },
  { symbol: "WTI/USD", name: "Crude Oil (WTI)" },
  { symbol: "BTC/USD", name: "Bitcoin" },
  { symbol: "ETH/USD", name: "Ethereum" },
  { symbol: "AAPL", name: "Apple (AAPL)" },
  { symbol: "MSFT", name: "Microsoft (MSFT)" },
  { symbol: "NVDA", name: "NVIDIA (NVDA)" },
  { symbol: "AMZN", name: "Amazon (AMZN)" },
  { symbol: "TSLA", name: "Tesla (TSLA)" },
  { symbol: "META", name: "Meta (META)" },
];

module.exports = async function handler(req, res) {
  // allow the static frontend (any origin) to call this endpoint
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  // let Vercel's edge cache a response briefly to ease Twelve Data rate limits
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Server is missing TWELVE_DATA_API_KEY." });
    }

    const symbolList = SYMBOLS.map((s) => s.symbol).join(",");
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

    // A batch request is keyed by symbol; a single symbol returns the quote
    // object directly.
    const quoteFor = (symbol) => {
      if (payload && Object.prototype.hasOwnProperty.call(payload, symbol)) {
        return payload[symbol];
      }
      if (payload && payload.symbol === symbol) return payload;
      return null;
    };

    const data = SYMBOLS.map(({ symbol, name }) => {
      const q = quoteFor(symbol);
      // skip symbols the API couldn't resolve so the rest still render
      if (!q || q.status === "error" || q.code) return null;

      const price = parseFloat(q.close != null ? q.close : q.price);
      const change = parseFloat(q.change);
      const changePct = parseFloat(q.percent_change);
      if (!isFinite(price)) return null;

      const safeChangePct = isFinite(changePct) ? changePct : 0;
      return {
        symbol,
        name,
        price,
        change: isFinite(change) ? change : 0,
        changePct: safeChangePct,
        positive: safeChangePct >= 0,
      };
    }).filter(Boolean);

    if (data.length === 0) {
      return res.status(500).json({ error: "No market data was returned." });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res
      .status(500)
      .json({ error: err && err.message ? err.message : "Failed to fetch market data." });
  }
};
