"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { ChatConversation, ChatMessage } from "@pos-bus/shared";
import { Maximize2, MessageCircle, Minimize2, Send, X } from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/utils/format";

const defaultConversation: ChatConversation = {
  id: "operations",
  title: "Operations group",
  targetType: "employee",
  unreadCount: 0
};

export function ChatWidget() {
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState(defaultConversation.id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const activeConversation = conversations.find((item) => item.id === activeId) || defaultConversation;

  const loadConversations = useCallback(async () => {
    try {
      const result = await api.chatConversations();
      setConversations(result.data.length ? result.data : [defaultConversation]);
    } catch {
      setConversations([defaultConversation]);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const result = await api.chatMessages(activeId);
      setMessages(result.data);
    } catch {
      setMessages([]);
    }
  }, [activeId]);

  useEffect(() => {
    if (!session || !isOpen) return;
    void loadConversations();
  }, [isOpen, loadConversations, session]);

  useEffect(() => {
    if (!session || !isOpen) return;
    void loadMessages();
    const timer = window.setInterval(loadMessages, 5000);
    return () => window.clearInterval(timer);
  }, [activeId, isOpen, loadMessages, session]);

  if (!session) return null;

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setDraft("");
    const result = await api.sendChatMessage(activeId, {
      body,
      senderId: session.user.id,
      senderName: session.user.fullName
    });
    setMessages((current) => [...current, result.data]);
    await loadConversations();
  };

  return (
    <div className={`chat-widget ${isOpen ? "is-open" : ""} ${isExpanded ? "is-expanded" : ""}`}>
      {!isOpen ? (
        <button type="button" className="chat-fab" aria-label="Open messages" onClick={() => setIsOpen(true)}>
          <MessageCircle size={22} />
        </button>
      ) : (
        <section className="chat-panel" aria-label="Command messages">
          <header className="chat-header">
            <div>
              <span>Messages</span>
              <strong>{activeConversation.title}</strong>
            </div>
            <div className="inline-actions">
              <button type="button" className="icon-button" aria-label={isExpanded ? "Minimize chat" : "Expand chat"} onClick={() => setIsExpanded((value) => !value)}>
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button type="button" className="icon-button" aria-label="Close messages" onClick={() => setIsOpen(false)}>
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="chat-body">
            <aside className="chat-targets">
              {[defaultConversation, ...conversations.filter((item) => item.id !== defaultConversation.id)].map((conversation) => (
                <button
                  type="button"
                  key={conversation.id}
                  className={conversation.id === activeId ? "active" : ""}
                  onClick={() => setActiveId(conversation.id)}
                >
                  <strong>{conversation.title}</strong>
                  <span>{conversation.targetType}</span>
                </button>
              ))}
            </aside>
            <div className="chat-thread">
              <div className="chat-messages">
                {messages.length ? (
                  messages.slice(-30).map((message) => (
                    <article key={message.id} className={message.senderId === session.user.id ? "own" : ""}>
                      <strong>{message.senderName}</strong>
                      <p>{message.body}</p>
                      <span>{formatDateTime(message.timestamp)}</span>
                    </article>
                  ))
                ) : (
                  <p className="empty-note">No messages yet. Start an operations note.</p>
                )}
              </div>
              <form className="chat-compose" onSubmit={sendMessage}>
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Message employee or admin" />
                <button type="submit" className="primary-action" aria-label="Send message">
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
