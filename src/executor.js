/**
 * Takes the JSON array of actions from the backend and applies them to the document.
 */
function applyActions(actions) {
  const doc = DocumentApp.getActiveDocument();
  const body = doc.getBody();

  actions.forEach(action => {
    action.targetIndices.forEach(index => {
      let p;
      if (index === -1) {
        p = body; // Target the Document Body itself to append content
      } else {
        const child = body.getChild(index);
        if (!child) return;
        
        const type = child.getType();
        if (type === DocumentApp.ElementType.PARAGRAPH) p = child.asParagraph();
        else if (type === DocumentApp.ElementType.LIST_ITEM) p = child.asListItem();
        else if (type === DocumentApp.ElementType.TABLE) p = child.asTable();
        else p = child;
      }

      if (p) {
        // Loop through all the methods the AI decided to call on this element!
        action.methodsToCall.forEach(func => {
          
          // Parse arguments to handle Google Apps Script Enums (like DocumentApp.HorizontalAlignment.CENTER)
          let parsedArgs = func.args.map(arg => {
            if (typeof arg === 'string' && arg.startsWith('DocumentApp.')) {
              // We use eval here to turn the string "DocumentApp.HorizontalAlignment.CENTER" into the actual Enum object!
              return eval(arg); 
            }
            return arg;
          });

          // Check if the method belongs to the element itself (like setAlignment)
          if (typeof p[func.methodName] === 'function') {
            const result = p[func.methodName](...parsedArgs);
            
            // Critical fix: If the method appended a new element, we must update the 'p' pointer 
            // so that subsequent methods (like setAlignment) apply to the NEW paragraph, not the Body!
            if (func.methodName.startsWith('append') || func.methodName.startsWith('insert')) {
              p = result;
            }
          } 
          // Otherwise, it belongs to the Text element (like setFontSize)
          else if (typeof p.editAsText === 'function' && typeof p.editAsText()[func.methodName] === 'function') {
            p.editAsText()[func.methodName](...parsedArgs);
          }
          else {
            throw new Error(`Method ${func.methodName} does not exist on this element or its Text!`);
          }
          
        });

      }
    });
  });
}

