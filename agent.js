import { StateGraph, Annotation } from "@langchain/langgraph";

// This defines the data moving between our agents
const GraphState = Annotation.Root({
  userQuery: Annotation(),
  legalContext: Annotation(), // Laws found by Researcher
  draftResponse: Annotation(), // Answer written by Drafter
  isApproved: Annotation(), // Boolean set by Auditor
  finalResponse: Annotation()
});
import { ChatGroq } from "@langchain/groq";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import 'dotenv/config';

// 1. Initialize the LLM (Using your existing Groq key setup)
// We set temperature to 0.2 because legal answers should be factual, not "creative".
const llm = new ChatGroq({
    model: "llama-3.3-70b-versatile",
    temperature: 0.2, 
    apiKey: process.env.GROQ_API_KEY
});

// ==========================================
// 🕵️ NODE 1: THE RESEARCHER AGENT
// ==========================================
export async function runResearcher(state) {
    console.log("🔍 [Researcher] Finding relevant IPC/BNS sections...");
    
    // INTERVIEW FLEX: In a production YC app, this agent wouldn't just ask the LLM. 
    // It would take the userQuery, convert it to a vector embedding, and search 
    // a PostgreSQL (pgvector) database of actual PDF law books (RAG). 
    // For now, we use the LLM's internal knowledge to simulate this retrieval.
    
    const prompt = `
        You are a legal researcher. Identify the relevant Indian Penal Code (IPC) 
        or Bharatiya Nyaya Sanhita (BNS) sections for this query: "${state.userQuery}". 
        Provide only the law sections and a 1-sentence summary of what they mean.
    `;
    
    const response = await llm.invoke([new HumanMessage(prompt)]);
    
    // We return an object that updates the "legalContext" variable in our GraphState
    return { legalContext: response.content }; 
}

// ==========================================
// ✍️ NODE 2: THE DRAFTER AGENT
// ==========================================
export async function runDrafter(state) {
    console.log("✍️ [Drafter] Writing the legal advice based on research...");
    
    const systemPrompt = `
        You are Vakil_GPT, an expert Indian lawyer. 
        Draft professional, simple-English legal advice based STRICTLY on the "Relevant Laws" provided.
        Do not invent or hallucinate any laws outside of the provided context.
    `;
    
    const humanPrompt = `
        User Query: ${state.userQuery}
        Relevant Laws: ${state.legalContext}
        
        Draft the response:
    `;

    const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(humanPrompt)
    ]);

    // Updates the "draftResponse" variable in our GraphState
    return { draftResponse: response.content };
}

// ==========================================
// 🧐 NODE 3: THE AUDITOR AGENT (Human-in-the-Loop Sim)
// ==========================================
export async function runAuditor(state) {
    console.log("🧐 [Auditor] Reviewing the draft for hallucinations...");
    
    const prompt = `
        You are a strict Senior Legal Auditor. Review this draft advice. 
        Does it directly answer the user's query? Does it strictly follow the context laws?
        
        User Query: ${state.userQuery}
        Context Laws: ${state.legalContext}
        Draft: ${state.draftResponse}
        
        Reply strictly with "APPROVED" if it is safe and accurate.
        If it contains errors or hallucinations, reply with "REJECTED: [Explanation of what to fix]".
    `;

    const response = await llm.invoke([new HumanMessage(prompt)]);
    const evaluation = response.content;

    // Logic to determine what the graph should do next
    if (evaluation.includes("APPROVED")) {
        console.log("✅ [Auditor] Draft Approved!");
        // We set isApproved to true, and lock in the final response.
        return { 
            isApproved: true, 
            finalResponse: state.draftResponse 
        };
    } else {
        console.log("❌ [Auditor] Draft Rejected. Sending feedback to Drafter:", evaluation);
        // We set isApproved to false. 
        // We append the Auditor's feedback to the context so the Drafter knows what to fix!
        return { 
            isApproved: false, 
            legalContext: state.legalContext + `\n\nFix this in the next draft: ${evaluation}` 
        }; 
    }
}
const workflow = new StateGraph(GraphState)
  .addNode("researcher", runResearcher)
  .addNode("drafter", runDrafter)
  .addNode("auditor", runAuditor)
  
  .addEdge("__start__", "researcher") // Start with Researcher
  .addEdge("researcher", "drafter")   // Pass to Drafter
  .addEdge("drafter", "auditor")      // Pass to Auditor
  
  // Conditional Edge: If Auditor rejects, go back to Drafter. If approves, finish.
  .addConditionalEdges("auditor", (state) => {
      return state.isApproved ? "END" : "drafter";
  });

const app = workflow.compile();
export { app };