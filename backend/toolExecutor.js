const { ToolNode } = require("@langchain/langgraph/prebuilt");
const { tool } = require("@langchain/core/tools");
const { TavilySearch } = require("@langchain/tavily");
const { AnswerQuestion, ReviseAnswer } = require("./schemas");
require("dotenv").config({ path: __dirname + '/.env' });

const tavilyTool = new TavilySearch({ maxResults: 5 });

async function runQueries(input) {
  const searchQueries = input.search_queries;
  
  if (!searchQueries || searchQueries.length === 0) {
    return "No search queries provided.";
  }

  // Run all queries in parallel using Promise.all
  const results = await Promise.all(
    searchQueries.map(query => tavilyTool.invoke(query))
  );
  
  return JSON.stringify(results);
}

// In LangGraph, when the LLM outputs a tool call (like AnswerQuestion), 
// it expects a ToolNode with a matching tool name to execute it.
const answerQuestionTool = tool(runQueries, {
  name: AnswerQuestion.name,
  description: AnswerQuestion.description,
  schema: AnswerQuestion.schema
});

const reviseAnswerTool = tool(runQueries, {
  name: ReviseAnswer.name,
  description: ReviseAnswer.description,
  schema: ReviseAnswer.schema
});

const executeTools = new ToolNode([answerQuestionTool, reviseAnswerTool]);

module.exports = { executeTools };
