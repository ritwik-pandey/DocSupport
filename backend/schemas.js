const { z } = require("zod");

const Reflection = z.object({
  missing: z.string().describe("Critique of what is missing."),
  superfluous: z.string().describe("Critique of what is superfluous")
});

const AnswerQuestion = {
  name: "AnswerQuestion",
  description: "Answer the question.",
  schema: z.object({
    answer: z.string().describe("~250 word detailed answer to the question."),
    reflection: Reflection.describe("Your reflection on the initial answer."),
    search_queries: z.array(z.string()).describe(
      "1-3 search queries for researching improvements to address the critique of your current answer."
    )
  })
};

const ReviseAnswer = {
  name: "ReviseAnswer",
  description: "Revise your original answer to your question.",
  schema: z.object({
    // We duplicate the fields from AnswerQuestion (since JS doesn't have class inheritance for schemas)
    answer: z.string().describe("~250 word detailed answer to the question."),
    reflection: Reflection.describe("Your reflection on the initial answer."),
    search_queries: z.array(z.string()).describe(
      "1-3 search queries for researching improvements to address the critique of your current answer."
    ),
    references: z.array(z.string()).describe("Citations motivating your updated answer.")
  })
};

module.exports = { AnswerQuestion, ReviseAnswer };
