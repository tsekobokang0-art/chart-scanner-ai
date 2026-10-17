
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
      throw new Error("GEMINI_API_KEY is missing from Netlify.");
    }

    const { image, mimeType } = await req.json();

    if (!image || !mimeType) {
      throw new Error("Please upload a chart image first.");
    }

    const prompt = `
Analyse this trading chart for educational purposes.

1. Identify the visible trend and market structure.
2. Describe visible support and resistance.
3. Explain possible bullish and bearish scenarios.
4. Identify potential entry confirmations.
5. Explain what cannot be confirmed from this image.

Do not invent prices, indicators, or news.
Do not guarantee a trade direction or profit.
If the symbol or timeframe is unclear, say so.
This is educational information, not financial advice.
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
          model: "gemini-3.8-flash",
          store: false,
          input: [
            {
              type: "image",
              mime_type: mimeType,
              data: image
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
      throw new Error(
        result.error?.message || "Gemini API request failed."
      );
    }

    let analysis = result.output_text || "";

    if (!analysis && Array.isArray(result.steps)) {
      analysis = result.steps
        .filter(step => step.type === "model_output")
        .flatMap(step => step.content || [])
        .filter(item => item.type === "text")
        .map(item => item.text || "")
        .join("\n");
    }

    if (!analysis) {
      throw new Error("Gemini returned no analysis.");
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
        error: error.message || "Unexpected server error."
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
};
