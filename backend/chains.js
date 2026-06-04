const { ChatPromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");
const { ChatGroq } = require("@langchain/groq");
require("dotenv").config({ path: __dirname + '/.env' });

const { AnswerQuestion, ReviseAnswer } = require("./schemas");


const llm = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: "llama-3.3-70b-versatile",
    temperature: 0.0,
});

// In Javascript, it's easier to use a function to inject the dynamic time
const getActorPromptTemplate = (firstInstruction) => {
    return ChatPromptTemplate.fromMessages([
        [
            "system",
            `You are expert researcher.
Current time: ${new Date().toISOString()}

1. ${firstInstruction}
2. Reflect and critique your answer. Be severe to maximize improvement.
3. Recommend search queries to research information and improve your answer.`
        ],
        new MessagesPlaceholder("messages"),
        ["system", "Answer the user's question above using the required format."],
    ]);
};

// 1. First Responder Chain
const firstResponderPromptTemplate = getActorPromptTemplate("Provide a detailed ~250 word answer.");

const firstResponder = firstResponderPromptTemplate.pipe(
    // We bind the tool and force the LLM to use it
    llm.bindTools([AnswerQuestion], { tool_choice: "AnswerQuestion" })
);

// 2. Revisor Chain
const reviseInstructions = `Revise your previous answer using the new information.
    - You should use the previous critique to add important information to your answer.
        - You MUST include numerical citations in your revised answer to ensure it can be verified.
        - Add a "References" section to the bottom of your answer (which does not count towards the word limit). In form of:
            - [1] https://example.com
            - [2] https://example.com
    - You should use the previous critique to remove superfluous information from your answer and make SURE it is not more than 250 words.`;

const revisorPromptTemplate = getActorPromptTemplate(reviseInstructions);

const revisor = revisorPromptTemplate.pipe(
    llm.bindTools([ReviseAnswer], { tool_choice: "ReviseAnswer" })
);

module.exports = { firstResponder, revisor };
