/**
 * Takes the JSON array of actions from the backend and applies them to the document.
 */
function applyActions(actions) {
  const doc = DocumentApp.getActiveDocument();
  const paragraphs = doc.getBody().getParagraphs();

  actions.forEach(action => {
    paragraphs.forEach(p => {
      // Find the matching paragraphs
      if (p.getHeading().name() === action.targetElement) {

        // Loop through all the methods the AI decided to call on this paragraph!
        action.methodsToCall.forEach(func => {
          
          // Parse arguments to handle Google Apps Script Enums (like DocumentApp.HorizontalAlignment.CENTER)
          let parsedArgs = func.args.map(arg => {
            if (typeof arg === 'string' && arg.startsWith('DocumentApp.')) {
              // We use eval here to turn the string "DocumentApp.HorizontalAlignment.CENTER" into the actual Enum object!
              return eval(arg); 
            }
            return arg;
          });

          // Check if the method belongs to the Paragraph itself (like setAlignment)
          if (typeof p[func.methodName] === 'function') {
            p[func.methodName](...parsedArgs);
          } 
          // Otherwise, it belongs to the Text element (like setFontSize)
          else if (typeof p.editAsText()[func.methodName] === 'function') {
            p.editAsText()[func.methodName](...parsedArgs);
          }
          else {
            throw new Error(`Method ${func.methodName} does not exist on Paragraph or Text!`);
          }
          
        });

      }
    });
  });
}

