/**
 * Displays the React Sidebar UI
 */
function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('sidebar')
      .setTitle('DocPilot AI Copilot')
      .setWidth(300);
  DocumentApp.getUi().showSidebar(html);
}

/**
 * Called by the React Sidebar when the user sends a message.
 * Extracts document context, sends it to the backend, and applies the actions.
 * @param {string} userPrompt The user's chat message
 * @returns {string} Success message to show in the UI
 */
function processUserPrompt(userPrompt) {
  const doc = DocumentApp.getActiveDocument();
  if (!doc) {
    throw new Error('No active document found.');
  }

  const payload = {
    userPrompt: userPrompt,
    documentContent: doc.getBody().getText(),
    documentStructure: getFullStructure(),
    source: 'Google Docs',
    thread_id: "doc-thread-" + new Date().getTime()
  };

  return communicateWithAI(payload);
}

/**
 * Called by React when an approved action fails.
 * Sends the error to the backend for self-healing without creating a fake user message.
 */
function reflectOnError(userPrompt, errorMessage) {
  const doc = DocumentApp.getActiveDocument();
  const payload = {
    userPrompt: userPrompt || "Format the document.",
    documentContent: doc.getBody().getText(),
    documentStructure: getFullStructure(),
    source: 'Google Docs',
    thread_id: "doc-thread-" + new Date().getTime(),
    error: errorMessage
  };

  return communicateWithAI(payload);
}

function communicateWithAI(payload, retryCount = 0) {
  const backendUrl = 'https://apartments-fireplace-cho-abroad.trycloudflare.com/api/process';
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: { "Bypass-Tunnel-Reminder": "true" },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(backendUrl, options);
  
  if (response.getResponseCode() === 200) {
    const result = JSON.parse(response.getContentText());
    if (result.actions && result.actions.length > 0) {

      // Return the diff to the React UI instead of executing immediately!
      return JSON.stringify({
        type: "diff",
        actions: result.actions
      });

    } else {
      return JSON.stringify({ type: "success", text: 'I processed your request but decided no formatting changes were necessary.' });
    }
  } else {
    throw new Error('Backend Error: ' + response.getContentText());
  }
}

/**
 * Called by React when the user clicks "Approve".
 * Executes the actions that were returned in the Diff view.
 */
function applyApprovedActions(actionsString) {
  try {
    const actions = JSON.parse(actionsString);
    applyActions(actions);
    return JSON.stringify({ type: "success", text: "Changes applied successfully!" });
  } catch (executionError) {
    throw new Error("Execution failed: " + executionError.toString());
  }
}
