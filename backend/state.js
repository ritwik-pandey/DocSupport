const { StateGraph, START, END } = require("@langchain/langgraph");

// 1. Define the State
const agentState = {
    userPrompt: { value: (left, right) => right }, // The prompt from Google Docs
    documentStructure: { value: (left, right) => right }, // The JSON structure
    actions: { value: (left, right) => right } // The final instructions to send back
};

// 2. Define the Dummy Node
// For now, it ignores the prompt and just returns a hardcoded formatting instruction
function formatNode(state) {
    console.log("Graph is processing prompt:", state.userPrompt);

    // Dummy action: "Change all NORMAL paragraphs to size 25"
    return {
        actions: [
            {
                operation: "CHANGE_FONT_SIZE",
                targetElement: "NORMAL",
                value: 25
            }
        ]
    };
}

// 3. Build the Graph
const workflow = new StateGraph({ channels: agentState })
    .addNode("formatter", formatNode)
    .addEdge(START, "formatter")
    .addEdge("formatter", END);

// Compile it into an app we can run
const appGraph = workflow.compile();

module.exports = { appGraph };
