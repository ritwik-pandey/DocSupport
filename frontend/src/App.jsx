import { useState, useRef, useEffect } from 'react'
import './App.css'

function App() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hi! I am DocPilot, your AI Copilot. How can I transform this document for you today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const sendMessage = (textToSend) => {
    if (!textToSend.trim()) return;
    
    // Use functional state update to ensure we have the absolute latest messages array
    setMessages(prev => {
      const newMessages = [...prev, { role: 'user', text: textToSend }];
      
      // Call Google Apps Script backend
      if (typeof google !== 'undefined' && google.script) {
        google.script.run
          .withSuccessHandler((responseString) => {
             try {
               const response = JSON.parse(responseString);
               if (response.type === 'diff') {
                 setMessages([...newMessages, { role: 'ai', type: 'diff', actions: response.actions, originalPrompt: textToSend }]);
               } else {
                 setMessages([...newMessages, { role: 'ai', text: response.text }]);
               }
             } catch (e) {
               setMessages([...newMessages, { role: 'ai', text: responseString }]);
             }
             setIsLoading(false);
          })
          .withFailureHandler((err) => {
             setMessages([...newMessages, { role: 'ai', text: "Error: " + err.message }]);
             setIsLoading(false);
          })
          .processUserPrompt(textToSend);
      } else {
        setTimeout(() => {
          setMessages([...newMessages, { 
            role: 'ai', 
            type: 'diff',
            actions: [
              { targetIndices: [2], methodsToCall: [{ methodName: 'setBold', args: [true] }] }
            ]
          }]);
          setIsLoading(false);
        }, 1500);
      }
      return newMessages;
    });
    
    setInput('');
    setIsLoading(true);
  };

  const handleApprove = (message, messageIndex) => {
    setIsLoading(true);
    
    if (typeof google !== 'undefined' && google.script) {
      google.script.run
        .withSuccessHandler((responseString) => {
           try {
             const response = JSON.parse(responseString);
             setMessages(prev => {
               const updated = [...prev];
               updated[messageIndex] = { role: 'ai', text: "✅ " + response.text };
               return updated;
             });
           } catch(e) {
             setMessages(prev => {
               const updated = [...prev];
               updated[messageIndex] = { role: 'ai', text: "✅ Changes applied!" };
               return updated;
             });
           }
           setIsLoading(false);
        })
        .withFailureHandler((err) => {
           setMessages(prev => {
             const updated = [...prev];
             updated[messageIndex] = { role: 'ai', text: "❌ Execution failed! DocPilot is searching the docs for a fix..." };
             return updated;
           });
           
           // Silently send the error back to the AI so it can self-heal without creating a fake user message!
           if (typeof google !== 'undefined' && google.script) {
             google.script.run
               .withSuccessHandler((responseString) => {
                  try {
                    const response = JSON.parse(responseString);
                    if (response.type === 'diff') {
                      setMessages(prev => [...prev, { role: 'ai', type: 'diff', actions: response.actions, originalPrompt: message.originalPrompt }]);
                    } else {
                      setMessages(prev => [...prev, { role: 'ai', text: response.text }]);
                    }
                  } catch (e) {
                    setMessages(prev => [...prev, { role: 'ai', text: responseString }]);
                  }
                  setIsLoading(false);
               })
               .withFailureHandler((reflectErr) => {
                  setMessages(prev => [...prev, { role: 'ai', text: "❌ Final error: " + reflectErr.message }]);
                  setIsLoading(false);
               })
               .reflectOnError(message.originalPrompt, err.message);
           }
        })
        .applyApprovedActions(JSON.stringify(message.actions));
    }
  };

  const handleReject = (messageIndex) => {
    setMessages(prev => {
      const updated = [...prev];
      updated[messageIndex] = { role: 'ai', text: "❌ Actions rejected. What would you like me to do differently?" };
      return updated;
    });
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="header">
        <div className="header-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
        <h1 className="header-title">DocPilot</h1>
      </div>

      {/* Messages Area */}
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`message-wrapper ${m.role}-wrapper`}>
            {m.role === 'ai' && <div className="ai-name">DocPilot AI</div>}
            
            {m.type === 'diff' ? (
              <div className="diff-box">
                <div className="diff-header">Proposed Actions</div>
                <div className="diff-content">
                  {m.actions.map((action, actionIdx) => (
                    <div key={actionIdx} className="diff-action">
                      <div className="diff-target">Target Index: {action.targetIndices.join(', ')}</div>
                      <ul className="diff-methods">
                        {action.methodsToCall.map((method, methodIdx) => (
                          <li key={methodIdx}>
                            <span className="method-name">{method.methodName}</span>
                            {method.args.length > 0 && (
                              <span className="method-args">({method.args.map(a => typeof a === 'string' && a.length > 30 ? `"${a.substring(0, 30)}..."` : JSON.stringify(a)).join(', ')})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="diff-actions">
                  <button className="btn-approve" onClick={() => handleApprove(m, i)} disabled={isLoading}>Approve</button>
                  <button className="btn-reject" onClick={() => handleReject(i)} disabled={isLoading}>Reject</button>
                </div>
              </div>
            ) : (
              <div className={`message`}>
                {m.text}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="message-wrapper ai-wrapper">
            <div className="ai-name">DocPilot AI</div>
            <div className="message">
              <div className="typing-indicator">
                <div className="dot"></div>
                <div className="dot"></div>
                <div className="dot"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="input-container">
        <div className="input-box">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Ask me to format or write..." 
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
          />
          <button onClick={handleSend} disabled={!input.trim() || isLoading}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
