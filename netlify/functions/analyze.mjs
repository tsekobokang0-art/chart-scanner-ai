
export default async (req) => {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Use POST to analyse a chart." }),
      {
        status: 405,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is missing from Netlify environment variables."
      );
    }

    const { image, mimeType } = await req.json();

    if (!image || !mimeType) {
      throw new Error("Please upload a chart screenshot.");
    }

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp"
    ];

    if (!allowedTypes.includes(mimeType)) {
      throw new Error(
        "Please use a PNG, JPEG, or WebP chart image."
      );
    }

    const prompt = `
You are a disciplined technical-analysis assistant
specialising in XAUUSD (Gold) and NAS100 (Nasdaq).

Analyse the supplied trading chart and provide a clear,
structured trading plan instead of only describing the image.

Use this exact format:

DIRECTION: BUY / SELL / NO TRADE

SYMBOL:
TIMEFRAME:
MARKET STRUCTURE:

ENTRY:
STOP LOSS:
TAKE PROFIT 1:
TAKE PROFIT 2:
RISK-TO-REWARD:

CONFIDENCE: LOW / MEDIUM / HIGH

REASONS:
INVALIDATION:
FINAL DECISION:

INSTRUCTIONS:

1. Choose BUY, SELL, or NO TRADE based on the visible
   technical evidence. Do not remain vague when the chart
   provides sufficient evidence for a possible setup.

2. Give a specific entry, stop loss, and take-profit price
   only if the price scale and chart are clear enough to
   estimate them responsibly.

3. If exact prices cannot be read or estimated reliably,
   write "UNAVAILABLE — price scale unclear" instead of
   inventing prices.

4. Prefer setups supported by market structure, support
   and resistance, breakouts, retests, or visible liquidity
   sweeps. Explain the evidence briefly.

5. The stop loss must be beyond the technical invalidation
   level where reasonably identifiable.

6. TP1 and TP2 must be realistic technical targets visible
   or reasonably inferable from the chart.

7. Calculate risk-to-reward only when entry, stop loss,
   and target prices are available.

8. If there is insufficient confirmation, conflicting
   evidence, or an unreadable chart, choose NO TRADE.

9. Never claim to know live prices, economic news, or
   indicator values that are not supplied in the image.

10. Do not guarantee profit or describe any setup as certain.
    This is technical analysis for educational purposes,
    not financial advice.

Keep the final decision concise and easy to read.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          model: "gemini-3.6-flash",
          store: false,
          input: [
            {
              type: "image",
              data: image,
              mime_type: mimeType
            },
            {
              type: "text",
              text: prompt
            }
          ]
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error:
            result.error?.message ||
            "Gemini API request failed."
        }),
        {
          status: response.status,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    let analysis = result.output_text || "";

    if (!analysis && Array.isArray(result.steps)) {
      analysis = result.steps
        .filter(step => step.type === "model_output")
        .flatMap(step => step.content || [])
        .filter(item => item.type === "text")
        .map(item => item.text || "")
        .join("\n")
        .trim();
    }

    if (!analysis) {
      throw new Error(
        "Gemini returned no analysis. Please try again."
      );
    }

    return new Response(
      JSON.stringify({ analysis }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error.message ||
          "Unexpected backend error."
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
};
