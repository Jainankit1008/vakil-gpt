import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import 'dotenv/config'; // <--- ADD THIS LINE (Loads the .env file)

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- AI SETUP ---
const Groq = require("groq-sdk");

// CHANGE THIS LINE: Use process.env instead of the real key
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY }); 

// ... rest of your code ...

// --- DATABASE SETUP ---
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- THE CHAT ROUTE ---
// --- FIXED CHAT ROUTE ---
app.post('/chat', async (req, res) => {
    const { email, message } = req.body;
    
    // 1. INPUT VALIDATION (Crucial for 400 Errors)
    if (!message || message.trim() === "") {
        console.error("❌ Error: Received empty message from user.");
        return res.status(400).json({ reply: "Please type a question first!" });
    }

    console.log(`📩 User asked: "${message}"`);

    try {
        // 2. ASK GROQ (Using the Latest Stable Model)
        // We use 'llama-3.3-70b-versatile' which is currently the most reliable.
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are Vakil_GPT, an expert Indian Lawyer. Answer queries using Indian Laws (IPC/BNS) in simple English."
                },
                {
                    role: "user",
                    content: message
                }
            ],
            // Switch to this model ID, it is less likely to error out
            model: "llama-3.3-70b-versatile", 
        });

        const aiText = completion.choices[0]?.message?.content || "No answer generated.";
        console.log(`🤖 AI Answered: "${aiText.substring(0, 50)}..."`);

        // 3. SAVE TO DATABASE
        // (We wrap this in a try/catch so DB errors don't crash the AI response)
        try {
    await prisma.customer.upsert({
        where: { email: email },
        update: {
            // Add the new question to existing customer
            questions: { 
                create: { 
                    text: message,
                    aiResponse: aiText 
                } 
            }
        },
        create: {
            email: email,
            name: "New Customer",
            // Create customer AND their first question
            questions: { 
                create: { 
                    text: message,
                    aiResponse: aiText 
                } 
            }
        }
    });
} catch (dbError) {
    console.error("⚠️ Database Error:", dbError.message);
}

        // 4. SEND RESPONSE
        res.json({ reply: aiText });

    } catch (e) {
        // 5. DEEP DEBUGGING LOG
        // This will print the EXACT reason why Groq is rejecting the request
        console.error("❌ Groq API Error:", e.message);
        if (e.error) console.error("Details:", JSON.stringify(e.error, null, 2));
        
        res.status(500).json({ reply: "Error: " + e.message });
    }
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Vakil_GPT (Groq Edition) is LIVE at http://localhost:${PORT}`);
});