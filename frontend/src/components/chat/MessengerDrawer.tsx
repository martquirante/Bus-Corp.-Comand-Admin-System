"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Send, Search, Users, BusFront, Ticket, User, MessageSquare } from "lucide-react";
import type { ChatConversation, ChatMessage, EmployeeRecord } from "@pos-bus/shared";
import { api } from "@/services/api";
import { useApiResource } from "@/hooks/useApiResource";
import { formatNumber, formatPeso } from "@/utils/format";

interface MessengerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MessengerDrawer({ isOpen, onClose }: MessengerDrawerProps) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConversation, setActiveConversation] = useState<ChatConversation | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const employeesResource = useApiResource(() => api.employees());

  // Load conversations
  const loadConversations = async () => {
    try {
      const res = await api.chatConversations();
      // Inject default groups if they don't exist in DB
      const defaultGroups: ChatConversation[] = [
        { id: "group-all", title: "All Employees", targetType: "employee", targetId: "all", lastMessage: "Welcome to Global Chat", lastMessageAt: Date.now() },
        { id: "group-driver", title: "Drivers Only", targetType: "employee", targetId: "driver", lastMessage: "Welcome Drivers", lastMessageAt: Date.now() },
        { id: "group-conductor", title: "Conductors Only", targetType: "employee", targetId: "conductor", lastMessage: "Welcome Conductors", lastMessageAt: Date.now() }
      ];
      
      const dbConvos = res.data || [];
      const merged = [...defaultGroups];
      
      dbConvos.forEach(db => {
        const existingIdx = merged.findIndex(m => m.id === db.id);
        if (existingIdx >= 0) {
          merged[existingIdx] = db;
        } else {
          merged.push(db);
        }
      });
      
      // Sort by lastMessageAt descending
      merged.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
      setConversations(merged);
    } catch (error) {
      console.error("Failed to load conversations", error);
    }
  };

  // Poll for messages in active conversation
  useEffect(() => {
    if (!activeConversation || !isOpen) return;
    
    let isMounted = true;
    
    const loadMessages = async () => {
      try {
        const res = await api.chatMessages(activeConversation.id);
        if (isMounted) {
          setMessages(res.data?.sort((a, b) => a.timestamp - b.timestamp) || []);
        }
      } catch (error) {
        console.error("Failed to load messages", error);
      }
    };

    void loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeConversation, isOpen]);

  // Poll for conversations
  useEffect(() => {
    if (!isOpen) return;
    void loadConversations();
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !activeConversation) return;

    const payload = {
      body: messageInput.trim(),
      senderId: "admin", // Replace with real admin ID if available from session
      senderName: "Command Center Admin"
    };

    setMessageInput("");
    
    // Optimistic update
    const tempMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversation.id,
      timestamp: Date.now(),
      ...payload
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      await api.sendChatMessage(activeConversation.id, payload);
      await loadConversations();
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  const startDirectMessage = (emp: EmployeeRecord) => {
    const convoId = `dm-${emp.id}`;
    let convo = conversations.find(c => c.id === convoId);
    
    if (!convo) {
      convo = {
        id: convoId,
        title: emp.fullName,
        targetType: "employee",
        targetId: emp.id,
        lastMessage: "Start of conversation",
        lastMessageAt: Date.now()
      };
      setConversations(prev => [convo!, ...prev]);
    }
    
    setActiveConversation(convo);
    setSearchQuery("");
  };

  const getGroupIcon = (id: string) => {
    if (id === "group-all") return <Users size={18} />;
    if (id === "group-driver") return <BusFront size={18} />;
    if (id === "group-conductor") return <Ticket size={18} />;
    return <User size={18} />;
  };

  if (!isOpen) return null;

  const employees = employeesResource.data || [];
  const filteredEmployees = employees.filter(emp => 
    emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    emp.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <div className="messenger-backdrop" onClick={onClose} />
      <div className="messenger-drawer">
        <div className="messenger-sidebar">
          <div className="messenger-header">
            <h2>Messenger</h2>
          </div>
          
          <div className="messenger-search">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search employees or groups..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="messenger-list">
            {searchQuery ? (
              <>
                <div className="messenger-list-title">Search Results</div>
                {filteredEmployees.map(emp => (
                  <div key={emp.id} className="messenger-list-item" onClick={() => startDirectMessage(emp)}>
                    <div className="avatar"><User size={16} /></div>
                    <div className="info">
                      <strong>{emp.fullName}</strong>
                      <span>{emp.role}</span>
                    </div>
                  </div>
                ))}
                {filteredEmployees.length === 0 && <div className="messenger-empty">No employees found</div>}
              </>
            ) : (
              <>
                <div className="messenger-list-title">Conversations</div>
                {conversations.map(convo => (
                  <div 
                    key={convo.id} 
                    className={`messenger-list-item ${activeConversation?.id === convo.id ? 'active' : ''}`}
                    onClick={() => setActiveConversation(convo)}
                  >
                    <div className={`avatar ${convo.id.startsWith("group") ? "group" : ""}`}>
                      {getGroupIcon(convo.id)}
                    </div>
                    <div className="info">
                      <strong>{convo.title}</strong>
                      <span>{convo.lastMessage || "No messages yet"}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="messenger-main">
          {activeConversation ? (
            <>
              <div className="messenger-chat-header">
                <div className="title-area">
                  {getGroupIcon(activeConversation.id)}
                  <h3>{activeConversation.title}</h3>
                </div>
                <button type="button" className="close-btn" onClick={onClose}>
                  <X size={20} />
                </button>
              </div>
              
              <div className="messenger-messages">
                {messages.length === 0 ? (
                  <div className="messenger-empty-state">
                    <MessageSquare size={48} />
                    <p>No messages yet. Send a message to start the conversation.</p>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`message-bubble ${msg.senderId === "admin" ? "sent" : "received"}`}>
                      {msg.senderId !== "admin" && <div className="sender-name">{msg.senderName}</div>}
                      <div className="text">{msg.body}</div>
                      <div className="time">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="messenger-input" onSubmit={handleSendMessage}>
                <input 
                  type="text" 
                  placeholder="Type a message..." 
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                />
                <button type="submit" disabled={!messageInput.trim()}>
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            <div className="messenger-welcome">
              <MessageSquare size={64} />
              <h2>Command Center Messenger</h2>
              <p>Select a conversation or search for an employee to start messaging.</p>
              <button type="button" className="soft-button" onClick={onClose} style={{ marginTop: '1rem' }}>
                Close Messenger
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
