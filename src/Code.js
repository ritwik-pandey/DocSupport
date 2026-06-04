/**
 * A custom menu is created when the document is opened.
 * @param {Event} e The onOpen event.
 */
function onOpen(e) {
  DocumentApp.getUi()
    .createMenu('DocPilot')
    .addItem('Get Document Data', 'getDocumentData')
    .addItem('Log Document Structure', 'getDocumentStructure')
    .addItem('Send to Backend', 'sendToBackend')
    .addToUi();
}


function getDocumentData() {
  const doc = DocumentApp.getActiveDocument();

  if (!doc) {
    DocumentApp.getUi().alert('No active document found.');
    return;
  }

  const body = doc.getBody();
  const text = body.getText();

  Logger.log("Extracted Text: " + text);

  // Show a popup with a snippet of the data
  const snippet = text.length > 200 ? text.substring(0, 200) + "..." : text;
  DocumentApp.getUi().alert('Document Data Successfully Extracted!\n\nSnippet:\n' + snippet);
}

/**
 * Example of fetching the structure (paragraphs, headings)
 */
function getDocumentStructure() {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) return;

  const body = doc.getBody();
  const paragraphs = body.getParagraphs();

  let structure = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    const text = p.getText();
    if (text.trim() === '') continue; // Skip empty paragraphs

    structure.push({
      text: text,
      heading: p.getHeading().name() // e.g., 'NORMAL', 'HEADING1', etc.
    });
  }

  Logger.log(JSON.stringify(structure, null, 2));
  DocumentApp.getUi().alert('Structure logged! Check the Apps Script Executions log.');
}

/**
 * Sends the document text to your Node.js backend.
 */
function sendToBackend() {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) {
    DocumentApp.getUi().alert('No active document found.');
    return;
  }

  const ui = DocumentApp.getUi();
  const promptResponse = ui.prompt('DocPilot AI', 'What would you like me to do with this document?', ui.ButtonSet.OK_CANCEL);

  if (promptResponse.getSelectedButton() !== ui.Button.OK) {
    return; // User clicked Cancel
  }

  const userPrompt = promptResponse.getResponseText();
  if (userPrompt.trim() === '') {
    ui.alert('Command cannot be empty.');
    return;
  }

  DocumentApp.getUi().alert('Sending data to backend...');


  const payload = {
    userPrompt: userPrompt,
    documentContent: doc.getBody().getText(),
    documentStructure: getFullStructure(),
    source: 'Google Docs',
    thread_id: "doc-thread-" + new Date().getTime()
  };
  // 2. Start the conversation loop
  communicateWithAI(payload);
}

function communicateWithAI(payload, retryCount = 0) {
  // IMPORTANT: Make sure this is your actual active Cloudflare/Localtunnel URL!
  const backendUrl = 'https://apartments-fireplace-cho-abroad.trycloudflare.com/api/process';
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: { "Bypass-Tunnel-Reminder": "true" },
    muteHttpExceptions: true
  };
  try {
    const response = UrlFetchApp.fetch(backendUrl, options);
    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
      if (result.actions && result.actions.length > 0) {

        // --- THE REFLECTION LOOP ---
        try {
          // Try to execute the AI's actions
          applyActions(result.actions);
          DocumentApp.getUi().alert('Magic complete! I successfully applied the changes.');

        } catch (executionError) {
          if (retryCount >= 2) {
            DocumentApp.getUi().alert('AI failed 3 times in a row. Giving up! Last error: ' + executionError.toString());
            return; // Stop the loop
          }
          // IF IT FAILS, we catch the error!
          DocumentApp.getUi().alert('AI made a mistake! Sending error back for reflection:\n' + executionError.toString());

          // Add the error to the payload
          payload.error = executionError.toString();

          // Call this exact function again to try again!
          communicateWithAI(payload, retryCount + 1);
        }

      } else {
        DocumentApp.getUi().alert('Backend returned successfully, but gave no actions to perform.');
      }
    } else {
      DocumentApp.getUi().alert('Error from backend: ' + response.getContentText());
    }
  } catch (error) {
    DocumentApp.getUi().alert('Connection failed: ' + error.toString());
  }
}