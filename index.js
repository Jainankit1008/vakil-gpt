import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import 'dotenv/config'; // Loads the .env file

// --- NEW MULTI-AGENT SETUP ---
// We import the compiled LangGraph workflow from our agent.js file
import { app as agenticWorkflow } from './agent.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- DATABASE SETUP ---
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// ==========================================
// 💬 THE CORE CHAT ROUTE
// ==========================================
app.post('/chat', async (req, res) => {
    const { email, message } = req.body;
    
    // 1. INPUT VALIDATION (Crucial for 400 Errors)
    if (!message || message.trim() === "") {
        console.error("❌ Error: Received empty message from user.");
        return res.status(400).json({ reply: "Please type a question first!" });
    }

    console.log(`📩 User asked: "${message}"`);

    try {
        // 2. TRIGGER THE LANGGRAPH MULTI-AGENT WORKFLOW
        // Instead of calling Groq directly, we pass the query to our StateGraph
        console.log("🚀 Starting Agentic Workflow...");
        
        const finalState = await agenticWorkflow.invoke({
            userQuery: message,
            isApproved: false // Initializing the state
        });

        // Extract the final approved answer from the graph's state
        const aiText = finalState.finalResponse || "No answer generated.";
        console.log(`🤖 AI Answered: "${aiText.substring(0, 50)}..."`);

        // 3. SAVE TO DATABASE
        // (We wrap this in a try/catch so DB errors don't crash the AI response)
        try {
            await prisma.customer.upsert({
                where: { email: email },
                update: {
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

        // 4. SEND RESPONSE TO FRONTEND
        res.json({ reply: aiText });

    } catch (e) {
        // 5. DEEP DEBUGGING LOG
        console.error("❌ Workflow Error:", e.message);
        if (e.error) console.error("Details:", JSON.stringify(e.error, null, 2));
        
        res.status(500).json({ reply: "Error processing the workflow: " + e.message });
    }
});

const PORT = 3000;

// ==========================================
// 🔒 ADMIN ROUTE (View All Data)
// ==========================================
app.get('/admin', async (req, res) => {
    // User must visit /admin?password=secret123 to see data
    const password = req.query.password;
    if (password !== "secret123") { 
        return res.send("<h1>⛔ Access Denied</h1><p>You are not the admin.</p>");
    }    
    
    try {
        // 1. Fetch all questions from DB, newest first
        const history = await prisma.question.findMany({
            orderBy: { timestamp: 'desc' },
            include: { customer: true } // Get the user's email too
        });

        // 2. Generate simple HTML Table
        let html = `
            <html>
            <head>
                <title>Admin Dashboard</title>
                <style>
                    body { font-family: sans-serif; padding: 2rem; background: #f3f4f6; }
                    table { width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                    th, td { padding: 12px; border-bottom: 1px solid #ddd; text-align: left; }
                    th { background: #1e3a8a; color: white; }
                    tr:hover { background: #f9fafb; }
                    h1 { color: #1e3a8a; }
                </style>
            </head>
            <body>
                <h1>📊 Vakil_GPT Live Records</h1>
                <table>
                    <tr>
                        <th>Time</th>
                        <th>User (Email)</th>
                        <th>Question</th>
                        <th>AI Response</th>
                    </tr>
                    ${history.map(item => `
                        <tr>
                            <td>${new Date(item.timestamp).toLocaleString()}</td>
                            <td>${item.customer.email}</td>
                            <td>${item.text}</td>
                            <td>${item.aiResponse ? item.aiResponse.substring(0, 50) + '...' : 'No Answer'}</td>
                        </tr>
                    `).join('')}
                </table>
            </body>
            </html>
        `;

        res.send(html);

    } catch (e) {
        res.status(500).send("Error loading admin panel: " + e.message);
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Vakil_GPT (Agentic Edition) is LIVE at http://localhost:${PORT}`);
});