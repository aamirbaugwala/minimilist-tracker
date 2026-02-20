import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ message: "API Key missing" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Use the most stable, standard model name
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const { profile, logs, weightLogs } = await req.json();

    // --- ENHANCED PROMPT ---
    const prompt = `
      Act as an elite nutrition coach analyzing a client's food logs and weight data.
      
      CLIENT PROFILE:
      - Goal: ${profile?.goal || 'General Health'}
      - Weight: ${profile?.weight || 'Unknown'}kg
      
      RECENT FOOD LOGS (Chronological):
      ${JSON.stringify(logs.slice(0, 30))} 

      RECENT WEIGHT LOGS (Chronological):
      ${JSON.stringify(weightLogs || [])}

      TASK:
      Analyze these logs for patterns and trends. Don't just summarize numbers; find the behavioral cause.
      
      OUTPUT FORMAT (Keep it short, max 200 words, use emojis):
      
      📉 1. TREND ANALYSIS
      (Identify patterns: e.g., "You consistently crash on weekends", "Your protein drops in the evening", "You eat well but portions are too small").
      
      🛑 2. THE BIGGEST BLOCKER
      (Identify the ONE single thing stopping them from reaching their goal of ${profile?.goal}).
      
      ✅ 3. THE ACTION PLAN
      (Give specific, simple food swaps or habits to fix the blocker starting tomorrow).
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ message: text });

  } catch (error) {
    console.error("AI Error:", error);
    return NextResponse.json({ 
      message: "I can't connect to the AI right now. Please check your API key permissions." 
    }, { status: 500 });
  }
}