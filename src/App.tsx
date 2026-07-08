/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, BookOpen, BarChart2, Settings as SettingsIcon, 
  Sparkles, UserCheck, Shield, Wifi, WifiOff, RefreshCw, 
  Layers, ChevronRight, Inbox, HelpCircle, LogOut, Trash2 
} from 'lucide-react';

import ChatWindow from './components/ChatWindow';
import KBManager from './components/KBManager';
import AnalyticsView from './components/AnalyticsView';
import SettingsView from './components/SettingsView';
import CustomerWidgetSimulator from './components/CustomerWidgetSimulator';
import AuthScreen from './components/AuthScreen';

import { Conversation, Message, Customer, User as AgentType } from './types';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState<AgentType | null>(null);
  const [isVerifying, setIsVerifying] = useState(!!token);

  const [activeTab, setActiveTab] = useState<'chat' | 'kb' | 'analytics' | 'settings'>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Agent / Roleplay state
  const [allAgents, setAllAgents] = useState<AgentType[]>([]);
  const [activeAgent, setActiveAgent] = useState<AgentType | null>(null);
  
  // Customer data state
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);

  // Real-time communication states
  const [isConnected, setIsConnected] = useState(false);
  const [typingState, setTypingState] = useState<{ isTyping: boolean; senderType: string } | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<{ text: string; logId: string; isThinking: boolean } | null>(null);

  // Widget simulator toggle
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'online'>('all');
  const [confirmClearOffline, setConfirmClearOffline] = useState(false);
  const [dbType, setDbType] = useState<string>('Local');

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetch('/api/db-status')
      .then(res => res.json())
      .then(data => setDbType(data.type))
      .catch(() => setDbType('Local'));
  }, []);

  // Session verification on mount or when token changes
  useEffect(() => {
    if (token) {
      verifyCurrentSession();
    } else {
      setIsVerifying(false);
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [token]);

  const verifyCurrentSession = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        setActiveAgent(data.user);
        
        // Fetch workspace data using the verified token
        await fetchInitialData(token, data.user);
        connectAgentWebSocket(data.user.id, token);
      } else {
        handleLogout();
      }
    } catch (err) {
      console.error('Session verification failed:', err);
      handleLogout();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleAuthSuccess = (newToken: string, user: AgentType) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setCurrentUser(user);
    setActiveAgent(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setCurrentUser(null);
    setActiveAgent(null);
    setConversations([]);
    setSelectedConversation(null);
    setMessages([]);
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
  };

  const fetchInitialData = async (authToken: string, agentProfile: AgentType) => {
    try {
      // 1. Fetch support agents
      const agentRes = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (agentRes.ok) {
        const agents: AgentType[] = await agentRes.json();
        setAllAgents(agents);
        
        // Match the current active agent to the logged-in user or first active
        const matched = agents.find(a => a.id === agentProfile.id) || agents[0];
        setActiveAgent(matched || agentProfile);
      } else {
        setAllAgents([agentProfile]);
        setActiveAgent(agentProfile);
      }

      // 2. Fetch customers
      const custRes = await fetch('/api/customers', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (custRes.ok) {
        const custs: Customer[] = await custRes.json();
        setAllCustomers(custs);
      }

      // 3. Fetch conversations
      const convRes = await fetch('/api/conversations', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (convRes.ok) {
        const convs: Conversation[] = await convRes.json();
        setConversations(convs);
        // Select first open conversation by default
        const firstOpen = convs.find(c => c.status === 'open');
        if (firstOpen) {
          handleSelectConversation(firstOpen, authToken);
        }
      }
    } catch (err) {
      console.error('Failed to load initial workspace data:', err);
    }
  };

  const connectAgentWebSocket = (userId: string, authToken: string) => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?role=agent&userId=${userId}&token=${authToken}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
      console.log('Agent WebSocket connection active');
    };

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      const { type } = payload;

      if (type === 'message:new') {
        const { message } = payload;
        
        // If this message belongs to the active conversation, append it
        setSelectedConversation(current => {
          if (current && current.id === message.conversationId) {
            setMessages(prev => {
              if (prev.some(m => m.id === message.id)) return prev;
              return [...prev, message];
            });
          }
          return current;
        });

        // Update lastMessageAt for conversation in list
        setConversations(prev => {
          return prev.map(c => {
            if (c.id === message.conversationId) {
              return { ...c, lastMessageAt: message.createdAt };
            }
            return c;
          });
        });
      } else if (type === 'copilot:thinking') {
        const { conversationId } = payload;
        setSelectedConversation(current => {
          if (current && current.id === conversationId) {
            setAiSuggestion({ text: '', logId: '', isThinking: true });
          }
          return current;
        });
      } else if (type === 'copilot:suggestion') {
        const { conversationId, suggestion, logId } = payload;
        setSelectedConversation(current => {
          if (current && current.id === conversationId) {
            setAiSuggestion({ text: suggestion, logId, isThinking: false });
          }
          return current;
        });
      } else if (type === 'typing:start') {
        const { conversationId, senderType } = payload;
        setSelectedConversation(current => {
          if (current && current.id === conversationId) {
            setTypingState({ isTyping: true, senderType });
          }
          return current;
        });
      } else if (type === 'typing:stop') {
        const { conversationId, senderType } = payload;
        setSelectedConversation(current => {
          if (current && current.id === conversationId) {
            setTypingState(null);
          }
          return current;
        });
      } else if (type === 'conversation:new') {
        const { conversation } = payload;
        setConversations(prev => {
          if (prev.some(c => c.id === conversation.id)) return prev;
          return [conversation, ...prev];
        });
      } else if (type === 'conversation:updated') {
        const { conversation } = payload;
        setConversations(prev => prev.map(c => c.id === conversation.id ? conversation : c));
        setSelectedConversation(current => {
          if (current && current.id === conversation.id) {
            return conversation;
          }
          return current;
        });
      } else if (type === 'conversation:deleted') {
        const { id } = payload;
        setConversations(prev => prev.filter(c => c.id !== id));
        setSelectedConversation(current => {
          if (current && current.id === id) {
            return null;
          }
          return current;
        });
      } else if (type === 'customer:status_change') {
        const { customerId, isOnline } = payload;
        setAllCustomers(prev => prev.map(c => c.id === customerId ? { ...c, isOnline } : c));
        setConversations(prev => prev.map(c => c.customerId === customerId ? { ...c, isCustomerOnline: isOnline } : c));
        setSelectedConversation(current => {
          if (current && current.customerId === customerId) {
            return { ...current, isCustomerOnline: isOnline };
          }
          return current;
        });
      } else if (type === 'conversations:cleared_offline') {
        const { ids } = payload;
        setConversations(prev => prev.filter(c => !ids.includes(c.id)));
        setSelectedConversation(current => {
          if (current && ids.includes(current.id)) {
            return null;
          }
          return current;
        });
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      console.log('Agent WebSocket closed, attempting reconnect in 5s...');
      setTimeout(connectAgentWebSocket, 5000);
    };

    socketRef.current = ws;
  };

  const handleSelectConversation = async (conv: Conversation, authToken: string = token || '') => {
    setSelectedConversation(conv);
    setMessages([]);
    setAiSuggestion(null);
    setTypingState(null);

    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
      setMessages([]);
    }
  };

  const handleSendMessage = (content: string) => {
    if (!selectedConversation || !socketRef.current || !activeAgent) return;

    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      conversationId: selectedConversation.id,
      senderType: 'agent',
      senderId: activeAgent.id,
      senderName: activeAgent.name,
      content,
      readAt: null,
      createdAt: new Date().toISOString()
    };

    socketRef.current.send(JSON.stringify({
      type: 'message:send',
      message: newMsg
    }));
  };

  const handleUpdateConversation = async (id: string, updates: Partial<Conversation>) => {
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const updated: Conversation = await res.json();
        
        // Sync inside agent list
        setConversations(prev => prev.map(c => c.id === id ? updated : c));
        if (selectedConversation?.id === id) {
          setSelectedConversation(updated);
        }
      }
    } catch (err) {
      console.error('Failed to patch conversation:', err);
    }
  };

  // Helper to fetch customer profiles for active conversation items
  const getCustomerForConv = (customerId: string): Customer | null => {
    return allCustomers.find(c => c.id === customerId) || null;
  };

  const handleUpdateCustomer = (updatedCust: Customer) => {
    setAllCustomers(prev => prev.map(c => c.id === updatedCust.id ? updatedCust : c));
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      // Auto cancel after 4 seconds if not clicked again
      setTimeout(() => {
        setConfirmDeleteId(current => current === id ? null : current);
      }, 4000);
      return;
    }

    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (selectedConversation?.id === id) {
          setSelectedConversation(null);
        }
        setConfirmDeleteId(null);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleClearOfflineConversations = async () => {
    if (!confirmClearOffline) {
      setConfirmClearOffline(true);
      setTimeout(() => {
        setConfirmClearOffline(false);
      }, 4000);
      return;
    }

    try {
      const res = await fetch('/api/conversations/clear-offline', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const deletedIds = data.ids || [];
        setConversations(prev => prev.filter(c => !deletedIds.includes(c.id)));
        setSelectedConversation(current => {
          if (current && deletedIds.includes(current.id)) {
            return null;
          }
          return current;
        });
        setConfirmClearOffline(false);
      }
    } catch (err) {
      console.error('Failed to clear offline conversations:', err);
    }
  };

  // Sort queue by status, date and real-time filter mode
  const filteredConversations = conversations.filter(c => {
    if (activeTab !== 'chat') return false;
    if (filterMode === 'online') {
      return c.isCustomerOnline === true;
    }
    return true;
  }).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  if (isVerifying) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 font-sans text-zinc-400">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 mb-4 animate-pulse">
            <Shield className="w-6 h-6" />
          </div>
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold font-mono">Initializing Encrypted Session...</p>
        </div>
      </div>
    );
  }

  if (!token || !currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="flex h-screen w-screen bg-zinc-50 font-sans select-none overflow-hidden text-zinc-800">
      
      {/* 1. Left-most Thin Sidebar (App Header & View Selectors) */}
      <div className="w-16 bg-zinc-900 border-r border-zinc-800 flex flex-col justify-between items-center py-5 shrink-0">
        <div className="flex flex-col items-center space-y-6 w-full">
          {/* Logo */}
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/10">
            <Layers className="w-5 h-5" />
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col items-center space-y-3 w-full px-2">
            {[
              { id: 'chat', label: 'Queues', icon: MessageSquare },
              { id: 'kb', label: 'Helpdesk KB', icon: BookOpen },
              { id: 'analytics', label: 'Analytics', icon: BarChart2 },
              { id: 'settings', label: 'Settings', icon: SettingsIcon }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                    activeTab === tab.id
                      ? 'bg-zinc-800 text-indigo-400 border-l-2 border-indigo-500'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                  title={tab.label}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Server Status Monitor & active Agent Roleplay switch & Logout */}
        <div className="flex flex-col items-center space-y-4 w-full px-2">
          {/* Connection badge */}
          <div className={`p-1.5 rounded-full ${isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`} title={isConnected ? 'WS Link Active' : 'WS Link Off'}>
            {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4 animate-pulse" />}
          </div>

          {/* Database Badge */}
          <div 
            className={`w-7 h-7 rounded-full flex items-center justify-center border ${dbType === 'PostgreSQL' ? 'bg-indigo-950 border-indigo-800 text-indigo-400' : 'bg-zinc-800 border-zinc-700 text-amber-500'}`} 
            title={`Database: ${dbType}`}
          >
            <span className="text-[8px] font-extrabold font-mono tracking-tighter">
              {dbType === 'PostgreSQL' ? 'PG' : 'JSON'}
            </span>
          </div>

          {/* Agent Roleplay Dropdown Trigger */}
          {activeAgent && (
            <div className="relative group">
              <img
                src={activeAgent.avatarUrl}
                alt={activeAgent.name}
                className="w-8 h-8 rounded-full border border-zinc-700 object-cover cursor-pointer hover:border-zinc-500 transition-colors"
                title={`Logged in as ${activeAgent.name} (${activeAgent.role})`}
              />
              
              {/* Tooltip Hover Switcher */}
              <div className="absolute left-12 bottom-0 bg-zinc-950 text-white rounded-xl shadow-xl border border-zinc-800 p-2 text-[10px] w-48 hidden group-hover:block z-50">
                <span className="font-semibold text-zinc-400 uppercase tracking-wider mb-1 block px-2">Roleplay Selector</span>
                {allAgents.map(ag => (
                  <button
                    key={ag.id}
                    onClick={() => setActiveAgent(ag)}
                    className={`w-full flex items-center space-x-2 p-1.5 rounded-lg text-left hover:bg-zinc-800 transition-colors ${activeAgent.id === ag.id ? 'bg-zinc-800 text-indigo-400 font-semibold' : 'text-zinc-300'}`}
                  >
                    <img src={ag.avatarUrl} alt={ag.name} className="w-5 h-5 rounded-full object-cover" />
                    <span className="truncate">{ag.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Logout Trigger */}
          <button
            onClick={handleLogout}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
            title="Secure Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Chat Conversation list (Visible only when tab is 'chat') */}
      {activeTab === 'chat' && (
        <div className="w-[350px] border-r border-zinc-200 bg-white flex flex-col min-h-0 shrink-0">
          <div className="p-4 border-b border-zinc-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-display font-semibold text-zinc-950 text-sm">Customer Support Queue</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Manage active real-time conversations</p>
              </div>
              <button
                type="button"
                onClick={handleClearOfflineConversations}
                className={`text-[9px] px-2 py-1.5 rounded-lg font-bold transition-all cursor-pointer border ${
                  confirmClearOffline
                    ? 'bg-rose-600 border-rose-600 text-white animate-pulse'
                    : 'bg-zinc-50 hover:bg-rose-50 border-zinc-200 hover:border-rose-200 text-zinc-500 hover:text-rose-600'
                }`}
                title="Remove all offline mock / autonomous entries in bulk"
              >
                {confirmClearOffline ? 'Confirm Clear?' : 'Clear Offline'}
              </button>
            </div>

            {/* Filter Toggle Segment */}
            <div className="mt-3.5 flex bg-zinc-100 p-0.5 rounded-lg text-[11px]">
              <button
                type="button"
                onClick={() => setFilterMode('online')}
                className={`flex-1 py-1.5 rounded-md font-semibold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  filterMode === 'online'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Online ({conversations.filter(c => c.isCustomerOnline).length})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`flex-1 py-1.5 rounded-md font-semibold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-white text-zinc-900 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <span>All ({conversations.length})</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-zinc-50/50">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-400 px-4">
                <Inbox className="w-8 h-8 mb-2 text-zinc-300" />
                <p className="text-xs font-semibold">No queues fit your filter.</p>
                <p className="text-[10px] text-zinc-400 mt-1">
                  {filterMode === 'online' 
                    ? "No real-time visitors are currently connected." 
                    : "Your support queue is empty."}
                </p>
              </div>
            ) : (
              filteredConversations.map(c => {
                const cust = getCustomerForConv(c.customerId);
                const isSelected = selectedConversation?.id === c.id;
                
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConversation(c)}
                    className={`w-full flex flex-col p-3 rounded-2xl text-left border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white border-zinc-900 shadow-sm'
                        : 'border-transparent hover:border-zinc-200 bg-transparent hover:bg-white/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <div className="flex items-center space-x-2">
                        <div className="relative">
                          <img 
                            src={cust?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'} 
                            alt={cust?.name} 
                            className="w-6 h-6 rounded-full object-cover" 
                          />
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${
                            c.isCustomerOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'
                          }`} />
                        </div>
                        <span className="text-xs font-semibold text-zinc-900 truncate max-w-[130px]">
                          {cust?.name || 'Anonymous User'}
                        </span>
                      </div>
                      <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        c.priority === 'urgent' ? 'bg-rose-100 text-rose-700' :
                        c.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                        'bg-zinc-100 text-zinc-600'
                      }`}>
                        {c.priority}
                      </span>
                    </div>

                    <p className="text-[10px] font-semibold text-zinc-400 mt-0.5 truncate flex items-center">
                      {cust?.companyName || 'Web Widget'}
                    </p>

                    {/* Status Badge */}
                    <div className="mt-2.5 flex items-center justify-between text-[9px] text-zinc-400">
                      <span className={`font-semibold px-2 py-0.5 rounded-full ${
                        c.status === 'open' ? 'bg-emerald-100 text-emerald-700' :
                        c.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-zinc-200 text-zinc-600'
                      }`}>
                        {c.status.toUpperCase()}
                      </span>
                      <span>
                        {new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Actions panel */}
                    <div className="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between w-full">
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const statuses: ('open' | 'pending' | 'closed')[] = ['open', 'pending', 'closed'];
                            const nextIndex = (statuses.indexOf(c.status) + 1) % statuses.length;
                            handleUpdateConversation(c.id, { status: statuses[nextIndex] });
                          }}
                          className="px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-[8px] font-bold text-zinc-600 transition-colors uppercase cursor-pointer"
                          title="Cycle status"
                        >
                          Status ↻
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const priorities: ('low' | 'medium' | 'high' | 'urgent')[] = ['low', 'medium', 'high', 'urgent'];
                            const nextIndex = (priorities.indexOf(c.priority) + 1) % priorities.length;
                            handleUpdateConversation(c.id, { priority: priorities[nextIndex] });
                          }}
                          className="px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 text-[8px] font-bold text-zinc-600 transition-colors uppercase cursor-pointer"
                          title="Cycle priority"
                        >
                          Priority ↻
                        </button>
                        {c.assignedAgentId === activeAgent?.id ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateConversation(c.id, { assignedAgentId: null });
                            }}
                            className="px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-zinc-100 text-[8px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors uppercase cursor-pointer"
                            title="Unassign conversation"
                          >
                            Me ✓
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateConversation(c.id, { assignedAgentId: activeAgent?.id || null });
                            }}
                            className="px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-indigo-50 text-[8px] font-bold text-zinc-600 hover:text-indigo-600 transition-colors uppercase cursor-pointer"
                            title="Assign to me"
                          >
                            Claim
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteConversation(e, c.id)}
                        className={`px-1.5 py-0.5 rounded transition-all text-[8px] font-bold flex items-center space-x-1 cursor-pointer ${
                          confirmDeleteId === c.id 
                            ? 'bg-rose-600 text-white hover:bg-rose-700 scale-105 animate-pulse'
                            : 'bg-zinc-100 hover:bg-rose-50 text-zinc-400 hover:text-rose-600'
                        }`}
                        title={confirmDeleteId === c.id ? 'Click again to confirm' : 'Delete conversation'}
                      >
                        <Trash2 className="w-2.5 h-2.5 shrink-0" />
                        {confirmDeleteId === c.id && <span className="text-[7px]">Confirm?</span>}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 3. Center Main Workspace Content */}
      <div className="flex-1 flex flex-col min-h-0 bg-white">
        {activeTab === 'chat' ? (
          selectedConversation ? (
            <ChatWindow
              conversation={selectedConversation}
              messages={messages}
              activeAgent={activeAgent!}
              allAgents={allAgents}
              customer={getCustomerForConv(selectedConversation.customerId)}
              onSendMessage={handleSendMessage}
              onUpdateConversation={handleUpdateConversation}
              typingState={typingState}
              aiSuggestion={aiSuggestion}
              onClearSuggestion={() => setAiSuggestion(null)}
              token={token}
              conversations={conversations}
              onUpdateCustomer={handleUpdateCustomer}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-zinc-50/20">
              <Inbox className="w-12 h-12 text-zinc-300 mb-3" />
              <h3 className="font-display font-semibold text-zinc-800 text-sm">Support Workspace Clear</h3>
              <p className="text-xs text-zinc-500 mt-2 max-w-[280px]">
                Select a live client ticket from the support queue to start analyzing context, running RAG suggestions, and chatting.
              </p>
            </div>
          )
        ) : activeTab === 'kb' ? (
          <KBManager orgId={currentUser.orgId} token={token} />
        ) : activeTab === 'analytics' ? (
          <AnalyticsView orgId={currentUser.orgId} token={token} />
        ) : (
          <SettingsView orgId={currentUser.orgId} token={token} />
        )}
      </div>

      {/* 4. Slide-out Real-time Customer Widget Simulator Drawer */}
      {isWidgetOpen ? (
        <CustomerWidgetSimulator 
          onClose={() => setIsWidgetOpen(false)} 
          orgId={currentUser.orgId} 
          currentUser={currentUser}
        />
      ) : (
        <button
          onClick={() => setIsWidgetOpen(true)}
          className="fixed bottom-6 right-6 bg-zinc-950 hover:bg-zinc-900 text-white px-4 py-3 rounded-full shadow-2xl flex items-center space-x-2 border border-zinc-800 transition-all hover:scale-105 z-40 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span className="font-display font-medium text-xs tracking-wider">Simulate Live Customer</span>
          <ChevronRight className="w-4 h-4 text-zinc-400" />
        </button>
      )}

    </div>
  );
}
