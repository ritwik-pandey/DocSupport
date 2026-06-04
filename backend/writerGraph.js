const { StateGraph, START, END, messagesStateReducer } = require("@langchain/langgraph");

const { revisor, firstResponder } = require("./chains");
const { executeTools } = require("./toolExecutor");

const MAX_ITERATIONS = 2;

// This mimics the MessagesState from Python LangGraph
const MessagesState = {
  messages: {
    value: messagesStateReducer,
    default: () => [],
  },
};

async function draftNode(state) {
  // Using invoke on the chain (which we will define later)
  const response = await firstResponder.invoke({ messages: state.messages });
  return { messages: [response] };
}

async function reviseNode(state) {
  const response = await revisor.invoke({ messages: state.messages });
  return { messages: [response] };
}

function eventLoop(state) {
  // Count how many ToolMessages exist in the history
  const countToolVisits = state.messages.filter(
    (msg) => msg._getType() === "tool" || msg.name === "tool"
  ).length;

  if (countToolVisits > MAX_ITERATIONS) {
    return END;
  }
  return "execute_tools";
}

// Build the graph using exact same edges as your Python code
const builder = new StateGraph({ channels: MessagesState })
  .addNode("draft", draftNode)
  .addNode("execute_tools", executeTools)
  .addNode("revise", reviseNode)
  .addEdge(START, "draft")
  .addEdge("draft", "execute_tools")
  .addEdge("execute_tools", "revise")
  .addConditionalEdges("revise", eventLoop, {
    "execute_tools": "execute_tools",
    [END]: END
  });

const writerGraph = builder.compile();

module.exports = { writerGraph };

// Add this to the very bottom of backend/writerGraph.js to test it:
if (require.main === module) {
  (async () => {
    console.log("Starting Writer Agent...");
    const res = await writerGraph.invoke({
      messages: [{ role: "user", content: "Write about AI-Powered SOC / autonomous soc problem domain, list startups that do that and raised capital." }]
    });

    const lastMessage = res.messages[res.messages.length - 1];
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      console.log("\nFINAL ANSWER:\n", lastMessage.tool_calls[0].args.answer);
    }
  })();
}

