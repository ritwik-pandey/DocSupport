const { StateGraph, START, END, MemorySaver, messagesStateReducer } = require("@langchain/langgraph");
const { ChatGroq } = require("@langchain/groq");
const { tool } = require("@langchain/core/tools");
const { ToolNode } = require("@langchain/langgraph/prebuilt");
const { TavilySearch } = require("@langchain/tavily");
const { z } = require("zod");
require("dotenv").config({ path: __dirname + '/.env' });

const rawSearchTool = new TavilySearch({ 
    maxResults: 2,
    includeDomains: ["developers.google.com"] // Restrict search to official Google Docs!
});
const searchTool = tool(
    async (input) => {
        return await rawSearchTool.invoke(input.query);
    },
    {
        name: "tavily_search",
        description: "Search the web for Google Apps Script documentation.",
        schema: z.object({
            query: z.string().describe("The search query to look up.")
        })
    }
);

const submitActionsTool = tool(
    async (input) => {
        // This tool doesn't actually "do" anything in Node.js. 
        // It just serves as a way for the LLM to submit the final JSON to us!
        return "Actions submitted successfully.";
    },
    {
        name: "submit_actions",
        description: "Call this tool when you have figured out the exact Google Apps Script methods to use.",
        schema: z.object({
            actions: z.array(
                z.object({
                    targetIndices: z.array(z.number()).describe("The exact index numbers of the paragraphs to target. Reference the index property in the provided document structure."),
                    methodsToCall: z.array(
                        z.object({
                            methodName: z.string(),
                            args: z.array(z.any())
                        })
                    )
                })
            )
        })
    }
);



const llm = new ChatGroq({
    model: "llama-3.3-70b-versatile",
    temperature: 0
});

const tools = [searchTool, submitActionsTool];
const toolNode = new ToolNode(tools);

const llmWithTools = llm.bindTools(tools);

const agentState = {
    userPrompt: { value: (left, right) => right },
    documentStructure: { value: (left, right) => right },
    messages: { value: messagesStateReducer, default: () => [] }
};

async function agentNode(state) {
    // 1. Count how many times the AI has used the search tool in this conversation
    const searchCount = state.messages.filter(
        m => m.tool_calls && m.tool_calls.some(tc => tc.name === "tavily_search")
    ).length;

    let availableTools = tools; // [searchTool, submitActionsTool]
    let extraPrompt = "";

    // 2. If it searched 2 times, take the search tool away!
    if (searchCount >= 2) {
        availableTools = [submitActionsTool]; // Only allow it to submit!
        extraPrompt = "\nCRITICAL: You have used up your maximum search limit. You MUST use the submit_actions tool immediately. If you still don't know the method, submit an empty actions array [] to admit defeat.";
        console.log("Search limit reached. Forcing LLM to submit.");
    }

    // 3. Dynamically bind the available tools to the LLM
    const boundLlm = llm.bindTools(availableTools);

    const systemPrompt = `You are a Google Apps Script DocumentApp formatting assistant. 
    Current document structure: ${JSON.stringify(state.documentStructure, null, 2)}
    
    CRITICAL RULES:
    1. You can write methods for Google Apps Script 'Paragraph', 'ListItem', 'Table' elements, OR their underlying 'Text' elements (e.g. setFontSize).
    2. If a method requires an Enum (like DocumentApp.HorizontalAlignment.CENTER), pass it exactly like that as a STRING in the args array (e.g. args: ["DocumentApp.HorizontalAlignment.CENTER"]). The executor will parse it.
    3. You must use the 'index' property of elements in the provided document structure to populate 'targetIndices'. This allows you to surgically target specific paragraphs, lists, or tables.
    4. If you are not 100% sure of the exact method name, YOU MUST USE THE SEARCH TOOL to look up the Google Apps Script DocumentApp documentation.
    5. If the user tells you that your previous attempt failed with an error, YOU MUST USE THE SEARCH TOOL to figure out why it failed before trying again. DO NOT GUESS.
    6. When you have the correct methods, use the submit_actions tool.
    ${extraPrompt}`;

    // 4. Call the LLM
    const result = await boundLlm.invoke([
        { role: "system", content: systemPrompt },
        { role: "user", content: state.userPrompt },
        ...state.messages
    ]);

    return { messages: [result] };
}

// 5. The Routing Logic (Conditional Edge)
function shouldContinue(state) {
    const lastMessage = state.messages[state.messages.length - 1];

    // If the LLM called a tool, we go to the Tool Node
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
        const calledTool = lastMessage.tool_calls[0].name;

        // If it called submit_actions, we are done!
        if (calledTool === "submit_actions") {
            return END;
        }
        // Otherwise, it called search, so run the tool node!
        return "tools";
    }
    return END;
}
// 6. Build the Graph
const workflow = new StateGraph({ channels: agentState })
    .addNode("agent", agentNode)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent"); // Loop back to the agent after searching!
const checkpointer = new MemorySaver();
const appGraph = workflow.compile({ checkpointer });
module.exports = { appGraph };
