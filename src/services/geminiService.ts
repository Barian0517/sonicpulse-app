import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const generateBackgroundImage = async (prompt: string): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key is missing. Cannot generate image.");
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `Generate a high quality, artistic abstract background image suitable for a music visualizer. 
                   Style description: ${prompt}. 
                   Ensure it is dark enough to see bright visualizer elements overlaying it. 
                   Do not include any text.`
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K" // "1K" is standard for flash-image
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image data found in response");

  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    throw error;
  }
};
