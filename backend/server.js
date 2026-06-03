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

    // Pass the incoming Google Docs data into our LangGraph
    const initialState = {
        userPrompt: req.body.userPrompt,
        documentStructure: req.body.documentStructure
    };

    // Run the graph!
    const finalState = await appGraph.invoke(initialState);

    // Send the final actions back to Google Docs
    res.json({
        status: 'success',
        actions: finalState.actions
    });

});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running locally on http://localhost:${PORT}`);
});
