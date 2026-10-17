
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
      return new Response(
        JSON.stringify({ error: "Gemini API key is not configured in Netlify." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const body = await req.json();
    const { image, mimeType } = body;

    if (
      !image ||
      !["image/png", "image/jpeg", "image/webp"].includes(mimeType)
    ) {
      return new Response(
        JSON.stringify({ error: "Please upload a PNG, JPEG or WebP chart image." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    if (image.length > 12000000) {
      return new Response(
        JSON.stringify({ error: "Image is too large. Please use a smaller screenshot." }),
        {
          status: 413,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const prompt = `
Analyse this trading chart screenshot for educational purposes.
Describe:
1. The visible market structure and trend, if identifiable.
2. Important visible support and resistance levels, without inventing exact prices.
3. Possible bullish and bearish scenarios.
4. What additional confirmation a trader might wait for.
5. What cannot be determined from this screenshot.

Do not guarantee a direction, profit, or outcome. If the symbol or timeframe is not visible, say so. Do not invent live prices or economic news. This is educational information, not financial advice.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: image
                  }
                }
              ]
            }
          ]
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: result.error?.message || "Gemini could not analyse the image."
        }),
        {
          status: response.status === 429 ? 429 : 502,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const analysis =
      result.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("\n")
        .trim();

    if (!analysis) {
      throw new Error("The AI returned no analysis. Please try again.");
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
