import { GoogleGenerativeAI } from "@google/generative-ai";

// ⚠️ PASTE YOUR KEY HERE
const API_KEY = "PASTE_YOUR_KEY_HERE";

async function checkModels() {
  try {
    console.log("🔍 Contacting Google to list available models...");
    
    // Direct call to Google's API to see what is allowed for your key
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
    );
    
    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("\n✅ AVAILABLE MODELS FOR YOU:");
    
    // Filter for chat models
    const chatModels = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
    
    chatModels.forEach(m => {
        // We print the clean name you need to copy
        console.log(`👉 ${m.name.replace("models/", "")}`);
    });
    
    console.log("\nACTION: Copy one of the names above exactly into your index.js!");

  } catch (error) {
    console.error("❌ Diagnosis Failed:", error.message);
  }
}

checkModels();