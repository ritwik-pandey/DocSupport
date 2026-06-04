const { StateGraph, START, END, MemorySaver, messagesStateReducer } = require("@langchain/langgraph");
const { ChatGroq } = require("@langchain/groq");
const { tool } = require("@langchain/core/tools");
const { ToolNode } = require("@langchain/langgraph/prebuilt");
const { TavilySearch } = require("@langchain/tavily");
const { z } = require("zod");
require("dotenv").config({ path: __dirname + '/.env' });
const { writerGraph } = require("./writerGraph");

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

const draftContentTool = tool(
    async (input) => {
        console.log("Invoking writerGraph for topic:", input.topic);
        const res = await writerGraph.invoke({
            messages: [{ role: "user", content: input.topic }]
        });
        const lastMessage = res.messages[res.messages.length - 1];
        if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
            const finalAnswer = lastMessage.tool_calls[0].args.answer;
            console.log("writerGraph finished successfully!");
            return finalAnswer;
        }
        console.log("writerGraph failed to generate tool calls!");
        return "Failed to generate content.";
    },
    {
        name: "research_and_draft_content",
        description: "Call this tool when the user asks you to write, draft, or generate content about a specific topic. It will research the topic and return a polished essay/response.",
        schema: z.object({
            topic: z.string().describe("The topic to research and draft content for.")
        })
    }
);

const tools = [searchTool, submitActionsTool, draftContentTool];
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
        availableTools = [submitActionsTool, draftContentTool]; // Remove search tool!
        extraPrompt = "\nCRITICAL: You have used up your maximum search limit. You MUST use the submit_actions tool immediately. If you still don't know the method, submit an empty actions array [] to admit defeat.";
        console.log("Search limit reached. Forcing LLM to submit.");
    }

    // 3. Dynamically bind the available tools to the LLM
    const boundLlm = llm.bindTools(availableTools);

    const systemPrompt = `You are a Google Apps Script DocumentApp formatting assistant. 
    Current document structure: ${JSON.stringify(state.documentStructure, null, 2)}
    
    CRITICAL RULES:
    1. You can write methods for Google Apps Script 'Paragraph', 'ListItem', 'Table' elements, OR their underlying 'Text' elements (e.g. setFontSize).
    2. If a method requires an Enum (like DocumentApp.HorizontalAlignment.CENTER), pass it exactly like that as a STRING in the args array. The executor will parse it.
    3. You must use the 'index' property of elements in the provided document structure to populate 'targetIndices'.
    4. If the user asks you to write or generate content about a topic, YOU MUST use the 'research_and_draft_content' tool first to write it.
    5. To inject newly generated content into the document, use targetIndices: [-1] and call 'appendParagraph' with the generated text as the argument. (e.g. methodName: "appendParagraph", args: ["The text"])
    6. To format specific parts of generated text (like a title), you MUST split the generated text and append it as multiple separate paragraphs using multiple actions.
    7. To change text color, use 'setForegroundColor' with a Hex string (e.g. args: ["#0000FF"]).
    8. To align text, use 'setAlignment' with the Enum string (e.g. args: ["DocumentApp.HorizontalAlignment.CENTER"]).
    9. If you are not 100% sure of an exact method name, YOU MUST USE THE SEARCH TOOL to look up the Google Apps Script DocumentApp documentation.
    10. If the user tells you that your previous attempt failed with an error, YOU MUST USE THE SEARCH TOOL to figure out why it failed before trying again. DO NOT GUESS.
    11. When you have the correct methods, use the submit_actions tool. Double check your JSON bracket syntax.
    ${extraPrompt}`;

    // 4. Call the LLM (with retry logic for Groq JSON tool_use_failed errors)
    let retries = 3;
    let localMessages = [...state.messages];
    
    while (retries > 0) {
        try {
            const result = await boundLlm.invoke([
                { role: "system", content: systemPrompt },
                { role: "user", content: state.userPrompt },
                ...localMessages
            ]);
            // If there were retries, we might want to return the localMessages we added so they are persisted?
            // Actually, we can just return the final result. LangGraph will append it.
            return { messages: [result] };
        } catch (e) {
            const errorStr = e.toString();
            if (errorStr.includes("tool_use_failed") && retries > 1) {
                console.log("Groq LLM JSON Syntax Error. Appending feedback and retrying...");
                localMessages.push({ 
                    role: "user", 
                    content: "CRITICAL SYSTEM ERROR: Your previous tool call failed with 'tool_use_failed' because you output malformed JSON. Specifically, you are adding an extra closing bracket ']]' at the end of the args array (e.g. args: ['#0000FF']]). DO NOT do this. Check your brackets carefully and retry." 
                });
                retries--;
                continue;
            }
            throw e;
        }
    }
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
