const express = require('express');
const cors = require('cors');
const { appGraph } = require('./state.js');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.get('/', (req, res) => {
    res.send('DocPilot Node.js Backend is running!');
});

app.post('/api/process', async (req, res) => {

    console.log('Received prompt from user:', req.body.userPrompt);

    const incomingMessages = req.body.error
        ? [{ role: "user", content: `My previous attempt failed with this error: ${req.body.error}. Please fix your JSON actions and try again.` }]
        : [];
    const initialState = {
        userPrompt: req.body.userPrompt,
        documentStructure: req.body.documentStructure,
        messages: incomingMessages
    };

    const config = {
        configurable: { thread_id: req.body.thread_id || "test_doc" }
    };

    // Run the graph!
    const finalState = await appGraph.invoke(initialState, config);

    const lastMessage = finalState.messages[finalState.messages.length - 1];
    const submitCall = lastMessage.tool_calls.find(t => t.name === "submit_actions");
    const actions = submitCall ? submitCall.args.actions : [];

    // Send the final actions back to Google Docs
    res.json({
        status: 'success',
        actions: actions
    });

});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running locally on http://localhost:${PORT}`);
});
