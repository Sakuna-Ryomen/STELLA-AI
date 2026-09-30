/* =========================================================
   STELLA AI CONVERSATION PANEL — Real-Time Stream & Python Bridge
========================================================= */

import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

export default function ChatPanel({
  messages,
  setMessages,
  state,
  setState,
  sendTextMessage,
  isLiveKitConnected,
}) {
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const messagesEndRef = useRef(null);
  const seenMessageIds = useRef(new Set());

  // Helper to format exact local real-time
  const getNowTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  // Auto-scroll to latest message
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "nearest",
    });
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, state]);

  // Track initial message IDs
  useEffect(() => {
    messages.forEach((m) => {
      if (m.id) seenMessageIds.current.add(m.id);
    });
  }, []);

  /* -------------------------------------------------------
     Python AI Assistant Bridge:
     1. Polls /api/chat for any incoming Python assistant messages
     2. Listens to window events ("stella:message")
     3. Listens to Electron IPC if present
     4. Exposes window.stellaChat global
  ------------------------------------------------------- */
  useEffect(() => {
    let isCancelled = false;

    // A. Polling /api/chat endpoint (Vite dev server middleware)
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/chat");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data) && !isCancelled) {
          const newIncoming = data.filter(
            (msg) => msg?.id && !seenMessageIds.current.has(msg.id)
          );
          if (newIncoming.length > 0) {
            newIncoming.forEach((msg) => seenMessageIds.current.add(msg.id));
            if (setMessages) {
              setMessages((prev) => {
                const next = [...prev, ...newIncoming];
                return next.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
              });
            }
            const hasStella = newIncoming.some((m) => m.role === "stella");
            if (hasStella && setState) {
              setState("speaking");
              setTimeout(() => setState("idle"), 2800);
            }
          }
        }
      } catch {
        // Local server not running or network idle
      }
    }, 1500);

    // B. Custom window event listener for Python / script injection
    const handleCustomEvent = (e) => {
      const detail = e.detail;
      if (!detail || !detail.text) return;
      const now = Date.now();
      const newMsg = {
        id: "ext-" + now,
        role: detail.role || "stella",
        text: detail.text,
        time: detail.time || getNowTime(),
        timestamp: detail.timestamp || now,
      };
      seenMessageIds.current.add(newMsg.id);
      if (setMessages) {
        setMessages((prev) => {
          const next = [...prev, newMsg];
          return next.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        });
      }
      if (setState) {
        setState("speaking");
        setTimeout(() => setState("idle"), 2800);
      }
    };
    window.addEventListener("stella:message", handleCustomEvent);

    // C. Electron IPC listener if available
    let removeIpc = null;
    if (window.electronAPI?.onChatMessage) {
      removeIpc = window.electronAPI.onChatMessage((msg) => {
        if (!msg || !msg.text) return;
        const now = Date.now();
        const newMsg = {
          id: msg.id || "ipc-" + now,
          role: msg.role || "stella",
          text: msg.text,
          time: msg.time || getNowTime(),
          timestamp: msg.timestamp || now,
        };
        seenMessageIds.current.add(newMsg.id);
        if (setMessages) {
          setMessages((prev) => {
            const next = [...prev, newMsg];
            return next.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          });
        }
        if (setState) {
          setState("speaking");
          setTimeout(() => setState("idle"), 2800);
        }
      });
    }

    // D. Global console / automation bridge
    window.stellaChat = {
      addMessage: (text, role = "stella") => {
        const now = Date.now();
        const newMsg = {
          id: "brg-" + now,
          role,
          text,
          time: getNowTime(),
          timestamp: now,
        };
        seenMessageIds.current.add(newMsg.id);
        if (setMessages) {
          setMessages((prev) => {
            const next = [...prev, newMsg];
            return next.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
          });
        }
      },
      clear: () => {
        if (setMessages) setMessages([]);
      },
    };

    return () => {
      isCancelled = true;
      clearInterval(pollInterval);
      window.removeEventListener("stella:message", handleCustomEvent);
      if (removeIpc) removeIpc();
    };
  }, [setMessages, setState]);

  /* -------------------------------------------------------
     Sending Messages:
  ------------------------------------------------------- */
  const handleSend = async (textToSend) => {
    if (isSendingRef.current) return;
    const text = (typeof textToSend === "string" ? textToSend : inputText).trim();
    if (!text) return;

    isSendingRef.current = true;
    setIsSending(true);

    const now = Date.now();
    const userMsg = {
      id: "usr-" + now + "-" + Math.random().toString(36).substring(2, 6),
      role: "user",
      text,
      time: getNowTime(),
      timestamp: now,
    };

    seenMessageIds.current.add(userMsg.id);
    if (setMessages) {
      setMessages((prev) => {
        const next = [...prev, userMsg];
        return next.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      });
    }
    setInputText("");

    if (setState) setState("thinking");

    // If LiveKit is connected, send text directly through LiveKit data channel
    if (isLiveKitConnected && sendTextMessage) {
      sendTextMessage(text);
      isSendingRef.current = false;
      setIsSending(false);
      return;
    }

    // Post to /api/chat so connected Python server can pick it up
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userMsg),
      });
      if (res.ok) {
        const respData = await res.json();
        if (respData?.message?.id) {
          seenMessageIds.current.add(respData.message.id);
        }
      }
    } catch {
      // Backend not yet running; simulation fallback handled below
    }

    // Simulated response if no external Python script answers immediately
    setTimeout(() => {
      let replyText = "";
      const lower = text.toLowerCase();

      if (lower.includes("diagnostic") || lower.includes("status")) {
        replyText = "Diagnostic complete: Quantum core synchronized, latency nominal, AES-256 secure channel active.";
      } else if (lower.includes("telemetry") || lower.includes("cpu") || lower.includes("ram")) {
        replyText = "Telemetry feed active: CPU load nominal, memory allocation stable, hardware link verified.";
      } else if (lower.includes("hello") || lower.includes("hi") || lower.includes("stella")) {
        replyText = "Greetings. Neural stream connected and ready for your commands or Python assistant execution.";
      } else {
        replyText = `Understood: "${text}". Neural channel processed and standing by for Python assistant hookup.`;
      }

      const replyTime = Date.now();
      const stellaMsg = {
        id: "stl-" + replyTime + "-" + Math.random().toString(36).substring(2, 6),
        role: "stella",
        text: replyText,
        time: getNowTime(),
        timestamp: replyTime,
      };

      seenMessageIds.current.add(stellaMsg.id);
      if (setMessages) {
        setMessages((prev) => {
          const next = [...prev, stellaMsg];
          return next.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        });
      }
      isSendingRef.current = false;
      setIsSending(false);

      if (setState) {
        setState("speaking");
        setTimeout(() => setState("idle"), 2400);
      }
    }, 1100);
  };

  const handleClear = () => {
    if (setMessages) setMessages([]);
  };

  // Ensure messages are strictly sorted by timestamp: question ALWAYS before answer
  const sortedMessages = [...messages].sort(
    (a, b) => (a.timestamp || 0) - (b.timestamp || 0)
  );

  return (
    <section className="panel chat-panel">
      {/* Header */}
      <div className="panel-header chat-header">
        <div>
          <div className="eyebrow">
            <span className="status-dot online" />
            COMMUNICATION
          </div>
          <h2>Conversation</h2>
        </div>

        <div className="chat-header-actions">
          <div className="live-pill" title="Real-time encrypted neural channel active">
            <span className="pulse-dot" />
            LIVE
          </div>

          <button
            type="button"
            className="chat-clear-btn"
            onClick={handleClear}
            title="Clear conversation history"
            aria-label="Clear conversation history"
          >
            <span className="clear-icon" aria-hidden="true">✕</span>
          </button>
        </div>
      </div>

      {/* Conversation Stream */}
      <div className="conversation">
        {/* Session Banner */}
        <div className="chat-session-badge">
          <span>SECURE REAL-TIME NEURAL STREAM</span>
        </div>

        {sortedMessages.length === 0 && (
          <div className="chat-empty-state">
            <span className="empty-spark">✧</span>
            <p>Channel open. Speak or type below to interact with STELLA.</p>
            <small>Python assistant messages will stream here automatically.</small>
          </div>
        )}

        {sortedMessages.map((message, index) => {
          const isStella = message.role === "stella";
          return (
            <article
              className={`message ${isStella ? "stella" : "user"}`}
              key={message.id || `${message.time}-${index}`}
            >
              <div className="message-mark" title={isStella ? "STELLA AI Core" : "Operator"}>
                {isStella ? "S" : "YOU"}
              </div>

              <div className="message-body">
                <div className="message-meta-header">
                  <span className="message-author">{isStella ? "STELLA AI" : "OPERATOR"}</span>
                  <span className="message-badge">{isStella ? "CORE" : "LOCAL"}</span>
                  <time className="message-time">{message.time}</time>
                </div>

                <div className="message-bubble">
                  <p>{message.text}</p>
                </div>
              </div>
            </article>
          );
        })}

        {/* State Indicators */}
        {state === "thinking" && (
          <div className="thinking-card">
            <div className="thinking-dots">
              <span />
              <span />
              <span />
            </div>
            <em>STELLA is synthesizing neural response...</em>
          </div>
        )}

        {state === "listening" && (
          <div className="state-note listening-note">
            <span className="state-pulse-ring" />
            <Icon name="mic" />
            <span>Listening for voice input...</span>
          </div>
        )}

        {state === "speaking" && (
          <div className="state-note speaking-note">
            <span className="audio-wave-bars">
              <i /><i /><i /><i />
            </span>
            <Icon name="sound" />
            <span>Transmitting audio response...</span>
          </div>
        )}

        <div ref={messagesEndRef} className="messages-anchor" />
      </div>

      {/* Quick Suggestion Chips */}
      <div className="chat-quick-chips">
        <button
          type="button"
          className="chip-btn"
          disabled={isSending}
          onClick={() => handleSend("System status report")}
        >
          Status Report
        </button>
        <button
          type="button"
          className="chip-btn"
          disabled={isSending}
          onClick={() => handleSend("Run hardware diagnostics")}
        >
          Diagnostics
        </button>
        <button
          type="button"
          className="chip-btn"
          disabled={isSending}
          onClick={() => handleSend("Check telemetry latency")}
        >
          Telemetry
        </button>
      </div>

      {/* Interactive Input Dock */}
      <form
        className="chat-input-bar"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <div className="input-wrap">
          <input
            type="text"
            className="chat-text-field"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type message or Python prompt..."
            aria-label="Type message to STELLA"
          />

          <button
            type="submit"
            className={`chat-send-btn ${inputText.trim() ? "can-send" : ""}`}
            disabled={!inputText.trim() || isSending}
            title="Send message (Enter)"
            aria-label="Send message"
          >
            <svg viewBox="0 0 16 16" className="send-svg" fill="currentColor">
              <path d="M1.5 1.5l13 6.5-13 6.5v-5l9-1.5-9-1.5v-5z" />
            </svg>
          </button>
        </div>
      </form>
    </section>
  );
}
