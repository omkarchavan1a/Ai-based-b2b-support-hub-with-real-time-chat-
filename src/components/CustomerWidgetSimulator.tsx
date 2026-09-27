/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageSquare, Star, Sparkles, Building, User, AlertCircle, RotateCcw } from 'lucide-react';
import { Message, Customer, Conversation } from '../types';

interface CustomerWidgetSimulatorProps {
  onClose: () => void;
  orgId: string;
  currentUser?: any;
}

const ANONYMOUS_PROFILES = [
  {
    name: 'Enterprise Client',
    email: 'client@enterprise.io',
    companyName: 'Enterprise SaaS Corp',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&h=150&fit=crop&crop=faces',
  },
  {
    name: 'Business Partner',
    email: 'contact@partner-labs.com',
    companyName: 'Bell Labs Support',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces',
  },
  {
    name: 'System Integrator',
    email: 'integrations@analytical-engine.org',
    companyName: 'Analytical Systems',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=faces',
  },
  {
    name: 'SaaS Developer',
    email: 'dev@kernel-systems.org',
    companyName: 'Kernel Corp',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=faces',
  },
  {
    name: 'Technical Contact',
    email: 'support-liaison@python.org',
    companyName: 'Python Systems',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=faces',
  },
  {
    name: 'Operations Manager',
    email: 'operations@apollo-guidance.gov',
    companyName: 'NASA AGC',
    avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop&crop=faces',
  },
  {
    name: 'Platform User',
    email: 'user@bletchley-park.org.uk',
    companyName: 'Bletchley Solutions',
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop&crop=faces',
  },
  {
    name: 'Web Administrator',
    email: 'admin@w3-network.org',
    companyName: 'W3C Network',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=faces',
  }
];

export default function CustomerWidgetSimulator({ onClose, orgId, currentUser }: CustomerWidgetSimulatorProps) {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(() => {
    const savedCustomer = localStorage.getItem('simulated_selected_customer');
    if (savedCustomer) {
      try {
        return JSON.parse(savedCustomer);
      } catch (e) {
        // ignore and fallback
      }
    }

    if (currentUser) {
      const defaultAgentCust = {
        id: `cust_${currentUser.id}`,
        orgId,
        name: currentUser.name,
        companyName: 'My Workplace',
        email: currentUser.email,
        avatarUrl: currentUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=faces',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('simulated_selected_customer', JSON.stringify(defaultAgentCust));
      return defaultAgentCust;
    }
    
    // Pick a random predefined developer profile for the anonymous visitor
    const randomIndex = Math.floor(Math.random() * ANONYMOUS_PROFILES.length);
    const randomProfile = ANONYMOUS_PROFILES[randomIndex];

    const randomCust = {
      id: `cust_visitor_${Math.floor(100000 + Math.random() * 900000)}`,
      orgId,
      name: randomProfile.name,
      companyName: randomProfile.companyName,
      email: randomProfile.email,
      avatarUrl: randomProfile.avatarUrl,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem('simulated_selected_customer', JSON.stringify(randomCust));
    return randomCust;
  });

  const randomizePersona = () => {
    const randomIndex = Math.floor(Math.random() * ANONYMOUS_PROFILES.length);
    const randomProfile = ANONYMOUS_PROFILES[randomIndex];
    setSelectedCustomer(prev => ({
      ...prev,
      id: `cust_visitor_${Math.floor(100000 + Math.random() * 900000)}`,
      name: randomProfile.name,
      companyName: randomProfile.companyName,
      email: randomProfile.email,
      avatarUrl: randomProfile.avatarUrl,
    }));
  };

  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('simulated_messages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [conversation, setConversation] = useState<Conversation | null>(() => {
    const saved = localStorage.getItem('simulated_conversation');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [isTyping, setIsTyping] = useState(false);
  const [csatRating, setCsatRating] = useState<number | null>(() => {
    const saved = localStorage.getItem('simulated_csat_rating');
    return saved ? parseInt(saved, 10) : null;
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [problemDescription, setProblemDescription] = useState('');
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [setupStep, setSetupStep] = useState<1 | 2>(() => {
    const saved = localStorage.getItem('simulated_setup_step');
    return saved ? (parseInt(saved, 10) as 1 | 2) : 1;
  });
  const [error, setError] = useState<string | null>(null);
  const [widgetTicket, setWidgetTicket] = useState<string | null>(() => {
    return localStorage.getItem('simulated_widget_ticket');
  });

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRenderRef = useRef(true);

  // Sync state to LocalStorage
  useEffect(() => {
    if (selectedCustomer) {
      localStorage.setItem('simulated_selected_customer', JSON.stringify(selectedCustomer));
    }
  }, [selectedCustomer]);

  useEffect(() => {
    if (conversation) {
      localStorage.setItem('simulated_conversation', JSON.stringify(conversation));
    } else {
      localStorage.removeItem('simulated_conversation');
    }
  }, [conversation]);

  useEffect(() => {
    if (messages && messages.length > 0) {
      localStorage.setItem('simulated_messages', JSON.stringify(messages));
    } else {
      localStorage.removeItem('simulated_messages');
    }
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('simulated_setup_step', setupStep.toString());
  }, [setupStep]);

  useEffect(() => {
    if (csatRating !== null) {
      localStorage.setItem('simulated_csat_rating', csatRating.toString());
    } else {
      localStorage.removeItem('simulated_csat_rating');
    }
  }, [csatRating]);

  // Load active or recent conversations for this customer ONLY when changed after first mount
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setMessages([]);
    setConversation(null);
    setCsatRating(null);
    setIsTyping(false);
    setProblemDescription('');
    setTicketPriority('medium');
    setError(null);
    setWidgetTicket(null);

    localStorage.removeItem('simulated_conversation');
    localStorage.removeItem('simulated_messages');
    localStorage.removeItem('simulated_csat_rating');
    localStorage.removeItem('simulated_widget_ticket');
  }, [selectedCustomer]);

  const connectWebSocket = (conv: Conversation, ticket?: string | null) => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const activeTicket = ticket ?? widgetTicket;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ticketParam = activeTicket ? `&ticket=${encodeURIComponent(activeTicket)}` : '';
    const wsUrl = `${protocol}//${window.location.host}/ws?role=customer&customerId=${selectedCustomer.id}&conversationId=${conv.id}${ticketParam}`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === 'message:new' && payload.message.conversationId === conv.id) {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.message.id)) return prev;
          return [...prev, payload.message];
        });
      } else if (payload.type === 'typing:start' && payload.senderType === 'agent') {
        setIsTyping(true);
      } else if (payload.type === 'typing:stop' && payload.senderType === 'agent') {
        setIsTyping(false);
      } else if (payload.type === 'conversation:updated' && payload.conversation.id === conv.id) {
        setConversation(payload.conversation);
      }
    };

    ws.onerror = (err) => {
      console.error('WebSocket connection error:', err);
      setError('Real-time connection interrupted. Some updates may fail to load.');
    };

    ws.onclose = () => {
      console.log('WebSocket closed for visitor widget simulator');
    };

    socketRef.current = ws;
  };

  // Sync conversation and connect ws on mount if there is a restored session
  useEffect(() => {
    if (conversation) {
      const authQuery = widgetTicket
        ? `?ticket=${encodeURIComponent(widgetTicket)}`
        : `?customerId=${selectedCustomer.id}`;
      // Refresh messages
      fetch(`/api/conversations/${conversation.id}/messages${authQuery}`)
        .then(res => {
          if (res.ok) return res.json();
        })
        .then(hist => {
          if (Array.isArray(hist)) {
            setMessages(hist);
          }
        })
        .catch(err => console.error('Error fetching restored messages:', err));

      // Refresh conversation details
      fetch(`/api/conversations/${conversation.id}`)
        .then(res => {
          if (res.ok) return res.json();
        })
        .then(details => {
          if (details) {
            setConversation(details);
          }
        })
        .catch(err => console.error('Error fetching restored conversation:', err));

      connectWebSocket(conversation);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  const resetSession = () => {
    localStorage.removeItem('simulated_selected_customer');
    localStorage.removeItem('simulated_conversation');
    localStorage.removeItem('simulated_messages');
    localStorage.removeItem('simulated_csat_rating');
    localStorage.removeItem('simulated_setup_step');
    localStorage.removeItem('simulated_widget_ticket');
    setWidgetTicket(null);

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setMessages([]);
    setConversation(null);
    setCsatRating(null);
    setIsTyping(false);
    setProblemDescription('');
    setTicketPriority('medium');
    setSetupStep(1);
    setError(null);

    // Pick a new random visitor profile
    const randomIndex = Math.floor(Math.random() * ANONYMOUS_PROFILES.length);
    const randomProfile = ANONYMOUS_PROFILES[randomIndex];

    const randomCust = {
      id: `cust_visitor_${Math.floor(100000 + Math.random() * 900000)}`,
      orgId,
      name: randomProfile.name,
      companyName: randomProfile.companyName,
      email: randomProfile.email,
      avatarUrl: randomProfile.avatarUrl,
      createdAt: new Date().toISOString()
    };
    setSelectedCustomer(randomCust);
    localStorage.setItem('simulated_selected_customer', JSON.stringify(randomCust));
  };

  // Connect customer to WebSocket
  const startChat = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      // 1. Create conversation on backend via REST
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.name,
          customerEmail: selectedCustomer.email,
          companyName: selectedCustomer.companyName,
          avatarUrl: selectedCustomer.avatarUrl,
          channel: 'widget',
          priority: ticketPriority,
          tags: ['web-widget'],
          problemDescription: problemDescription.trim()
        })
      });
      if (!res.ok) {
        throw new Error('Failed to register support request with server');
      }
      const conv: Conversation & { ticket?: string } = await res.json();
      setConversation(conv);
      if (conv.ticket) {
        setWidgetTicket(conv.ticket);
        localStorage.setItem('simulated_widget_ticket', conv.ticket);
      }

      // 2. Fetch history if any
      const authQuery = conv.ticket
        ? `?ticket=${encodeURIComponent(conv.ticket)}`
        : `?customerId=${selectedCustomer.id}`;
      const histRes = await fetch(`/api/conversations/${conv.id}/messages${authQuery}`);
      if (histRes.ok) {
        const hist = await histRes.json();
        setMessages(Array.isArray(hist) ? hist : []);
      } else {
        setMessages([]);
      }

      // 3. Establish WebSocket connection
      connectWebSocket(conv, conv.ticket || null);
    } catch (err: any) {
      console.error('Failed to start simulator chat:', err);
      setError(err?.message || 'Failed to start simulator chat. Please check connection and try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputMessage.trim() || !conversation) return;

    const newMsg: Message = {
      id: `msg_${Date.now()}`,
      conversationId: conversation.id,
      senderType: 'customer',
      senderId: selectedCustomer.id,
      senderName: selectedCustomer.name,
      content: inputMessage,
      readAt: null,
      createdAt: new Date().toISOString()
    };

    // Optimistic Update: instantly add to customer's message feed
    setMessages(prev => {
      if (prev.some(m => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });

    setInputMessage('');

    // Attempt WebSocket transmission if connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        socketRef.current.send(JSON.stringify({ type: 'typing:stop' }));
        socketRef.current.send(JSON.stringify({
          type: 'message:send',
          message: newMsg
        }));
      } catch (err) {
        console.error('Failed to send customer message via WebSocket:', err);
      }
    }

    // Always persist to database via reliable REST fallback
    // NOTE: WS already persists via saveMessage (idempotent by id), so only
    // use REST when WS is unavailable to avoid duplicate write races.
    const wsOpen = socketRef.current && socketRef.current.readyState === WebSocket.OPEN;
    if (!wsOpen) {
      try {
        const authQuery = widgetTicket
          ? `?ticket=${encodeURIComponent(widgetTicket)}`
          : `?customerId=${selectedCustomer.id}`;
        await fetch(`/api/conversations/${conversation.id}/messages${authQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMsg)
        });
      } catch (err) {
        console.error('Failed to persist customer message via REST:', err);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'typing:start' }));

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.send(JSON.stringify({ type: 'typing:stop' }));
      }, 1500);
    }
  };

  const submitRating = async (rating: number) => {
    if (!conversation) return;
    try {
      const res = await fetch(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      });
      if (res.ok) {
        setCsatRating(rating);
      }
    } catch (err) {
      console.error('Error submitting CSAT:', err);
    }
  };

  // Preset quick reply messages for testing
  const presets = [
    { label: '🔑 SSO Error', text: 'Hey, our SAML authentication is failing with "InResponseTo field mismatch". Can you check our clock skew limits?' },
    { label: '💳 Seat Credits', text: 'Hi, can we get credits for the 5 deleted seats last month? We deactivated them early.' },
    { label: '⚓ API Webhooks', text: 'Hello, what does the JSON payload signature structure look like for payment webhook deliveries?' }
  ];

  return (
    <div className="flex flex-col h-[680px] max-h-[calc(100vh-48px)] bg-white border border-zinc-200 w-[440px] max-w-[calc(100vw-32px)] shadow-2xl rounded-2xl overflow-hidden fixed bottom-6 right-6 z-50">
      {/* Header */}
      <div className="bg-zinc-900 text-white p-4 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-indigo-400" />
          <span className="font-display font-semibold text-sm tracking-wide">Live Customer Widget Simulator</span>
        </div>
        <div className="flex items-center space-x-1">
          <button 
            type="button"
            onClick={resetSession} 
            title="Reset simulation session and start fresh"
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Step Indicator when configuring ticket */}
      {!conversation && (
        <div className="bg-zinc-50 border-b border-zinc-150 px-5 py-2.5 flex items-center justify-between text-xs font-medium text-zinc-500 shrink-0">
          <button 
            type="button"
            onClick={() => setSetupStep(1)}
            className={`flex items-center space-x-2 focus:outline-none hover:text-zinc-800 transition-colors ${setupStep === 1 ? 'text-indigo-600 font-bold' : ''}`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${setupStep === 1 ? 'bg-indigo-600 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
              {setupStep === 1 ? '1' : '✓'}
            </span>
            <span>1. Persona Selection</span>
          </button>
          <div className="flex-1 mx-4 h-px bg-zinc-200" />
          <div className={`flex items-center space-x-2 ${setupStep === 2 ? 'text-indigo-600 font-bold' : ''}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${setupStep === 2 ? 'bg-indigo-600 text-white' : 'bg-zinc-200 text-zinc-600'}`}>
              2
            </span>
            <span>2. Describe Problem</span>
          </div>
        </div>
      )}

      {/* Step 1: Customize Support Persona */}
      {!conversation && setupStep === 1 && (
        <div className="flex-1 flex flex-col min-h-0 bg-zinc-50 animate-in fade-in duration-150">
          <div className="p-5 overflow-y-auto flex-1 space-y-5">
            
            {/* Header Description */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0 mt-0.5">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-zinc-900 text-xs">Define Customer Identity</h3>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                    Set up a custom support persona. Any messages, support tickets, and live sessions will simulate this client identity in real-time.
                  </p>
                </div>
              </div>
            </div>

            {/* Editable Profile Information */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Profile Information</span>
                <button
                  type="button"
                  onClick={randomizePersona}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center space-x-1 cursor-pointer bg-transparent border-none p-0 focus:outline-none"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Randomize Persona</span>
                </button>
              </div>
              <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3.5 shadow-2xs">
                <div>
                  <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={selectedCustomer.name}
                    onChange={(e) => setSelectedCustomer(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Grace Hopper"
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-zinc-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Company / Organization</label>
                    <input
                      type="text"
                      value={selectedCustomer.companyName || ''}
                      onChange={(e) => setSelectedCustomer(prev => ({ ...prev, companyName: e.target.value }))}
                      placeholder="e.g. Compiler Tech"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-zinc-800"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Email Address</label>
                    <input
                      type="email"
                      value={selectedCustomer.email}
                      onChange={(e) => setSelectedCustomer(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="e.g. grace@compiler-tech.io"
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-zinc-800"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Avatar Selector Presets */}
            <div className="space-y-3">
              <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Choose Avatar Preset</span>
              <div className="flex items-center gap-3 bg-white border border-zinc-200 rounded-2xl p-4 shadow-2xs">
                {[
                  { label: 'Agent Persona', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop&crop=faces' },
                  { label: 'Creative Designer', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces' },
                  { label: 'Dev Lead', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces' },
                  { label: 'SaaS Director', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=faces' },
                  { label: 'Security Lead', url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&h=150&fit=crop&crop=faces' },
                ].map((preset, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedCustomer(prev => ({ ...prev, avatarUrl: preset.url }))}
                    className={`relative p-0.5 rounded-full border-2 transition-all hover:scale-105 cursor-pointer ${
                      selectedCustomer.avatarUrl === preset.url 
                        ? 'border-indigo-600 scale-110 shadow-sm' 
                        : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                    title={preset.label}
                  >
                    <img src={preset.url} alt={preset.label} className="w-10 h-10 rounded-full object-cover" />
                    {selectedCustomer.avatarUrl === preset.url && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-indigo-600 border border-white text-[8px] font-bold text-white rounded-full flex items-center justify-center">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Footer Navigation Step 1 */}
          <div className="p-4 bg-white border-t border-zinc-200 flex justify-end shrink-0">
            <button
              type="button"
              onClick={() => setSetupStep(2)}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <span>Next: Describe Problem</span>
              <span className="text-sm font-normal">→</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Describe Support Request OR Chat Stream */}
      {(conversation || setupStep === 2) && (
        <div className="flex-1 flex flex-col min-h-0 bg-zinc-50">
          {!conversation ? (
            <div className="flex-1 flex flex-col min-h-0 bg-zinc-50 animate-in fade-in duration-150">
              <div className="flex-1 p-5 overflow-y-auto space-y-4">
                <div className="text-center mb-1">
                  <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center mb-2 mx-auto">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="font-display font-bold text-zinc-900 text-sm">Submit Live Support Request</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Initiating chat as <span className="font-semibold text-indigo-600">{selectedCustomer.name}</span>
                  </p>
                </div>

                <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-xs space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">What problem are you facing? *</label>
                    <textarea
                      placeholder="e.g. My invoice payment failed, or I cannot find the reset password link in my setting profile dashboard."
                      value={problemDescription}
                      onChange={(e) => setProblemDescription(e.target.value)}
                      rows={5}
                      required
                      className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white resize-none font-sans leading-relaxed text-zinc-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Select Urgency / Priority</label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setTicketPriority(p)}
                          className={`py-2 px-1 rounded-xl text-[10px] font-bold uppercase transition-all border ${
                            ticketPriority === p
                              ? p === 'urgent' ? 'bg-rose-50 text-rose-700 border-rose-400 font-extrabold shadow-xs' :
                                p === 'high' ? 'bg-amber-50 text-amber-700 border-amber-400 font-extrabold shadow-xs' :
                                p === 'medium' ? 'bg-indigo-50 text-indigo-700 border-indigo-400 font-extrabold shadow-xs' :
                                'bg-zinc-100 text-zinc-800 border-zinc-300 font-extrabold shadow-xs'
                              : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-700'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2 Footer Navigation */}
              <div className="p-4 bg-white border-t border-zinc-200 flex flex-col shrink-0 gap-3">
                {error && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-2.5 text-[11px] flex items-start space-x-1.5 animate-pulse">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSetupStep(1)}
                    className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    ← Back to Profile
                  </button>

                  <button
                    type="button"
                    onClick={startChat}
                    disabled={isConnecting || !problemDescription.trim()}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 flex items-center space-x-2 cursor-pointer"
                  >
                    {isConnecting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <span>Submit & Start Chat</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Ticket status bar */}
            <div className="bg-white px-4 py-2 border-b border-zinc-200 flex items-center justify-between">
              <span className="text-[10px] font-semibold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                Ticket: {conversation.id.toUpperCase()}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                conversation.status === 'open' ? 'bg-emerald-100 text-emerald-700' :
                conversation.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                'bg-zinc-200 text-zinc-700'
              }`}>
                {conversation.status.toUpperCase()}
              </span>
            </div>

            {error && (
              <div className="bg-rose-50 border-b border-rose-200 text-rose-700 px-4 py-1.5 text-[10px] flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{error}</span>
                </div>
                <button 
                  onClick={() => setError(null)} 
                  className="text-rose-500 hover:text-rose-700 font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Stated problem banner */}
            {conversation.problemDescription && (
              <div className="bg-zinc-900 text-zinc-100 px-4 py-2.5 text-[11px] border-b border-zinc-800 flex items-start space-x-2">
                <span className="font-semibold text-amber-400 uppercase shrink-0">Issue:</span>
                <span className="line-clamp-2 italic opacity-90">{conversation.problemDescription}</span>
              </div>
            )}

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => {
                const isMe = msg.senderType === 'customer';
                return (
                  <div key={msg.id} className={`flex items-start space-x-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {!isMe && (
                      <img 
                        src={msg.senderAvatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e'} 
                        alt={msg.senderName} 
                        className="w-7 h-7 rounded-full object-cover mt-0.5 border border-zinc-250 shrink-0 shadow-xs" 
                      />
                    )}
                    <div className={`max-w-[75%] rounded-2xl p-3 text-xs shadow-sm ${
                      isMe 
                        ? 'bg-zinc-900 text-white rounded-tr-none' 
                        : 'bg-white text-zinc-800 border border-zinc-200 rounded-tl-none'
                    }`}>
                      <p className="text-[9px] font-bold text-zinc-500 mb-0.5">{msg.senderName}</p>
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-[8px] text-right mt-1 opacity-50">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex justify-start items-center space-x-2">
                  <div className="w-7 h-7 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-bold text-zinc-400">...</span>
                  </div>
                  <div className="bg-white border border-zinc-200 rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* CSAT Overlay on close */}
            {conversation.status === 'closed' && (
              <div className="bg-indigo-50 border-t border-indigo-200 p-4 text-center">
                {conversation.resolutionNotes && (
                  <div className="max-w-sm mx-auto mb-3 bg-white p-3 rounded-xl border border-indigo-100 text-left">
                    <h5 className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1">Ticket Resolution Notes</h5>
                    <p className="text-xs text-zinc-700 leading-relaxed italic">
                      "{conversation.resolutionNotes}"
                    </p>
                  </div>
                )}
                <h4 className="text-xs font-semibold text-indigo-900">How was your support today?</h4>
                <p className="text-[10px] text-indigo-700 mt-1">Please rate our support agent experience</p>
                {csatRating === null ? (
                  <div className="flex justify-center space-x-2 mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => submitRating(star)}
                        className="p-1 hover:scale-125 transition-transform"
                      >
                        <Star className="w-6 h-6 text-amber-400 fill-transparent hover:fill-amber-400" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3 mt-2">
                    <div className="flex items-center justify-center space-x-1">
                      <span className="text-xs font-medium text-emerald-700">Thank you for rating:</span>
                      <div className="flex">
                        {Array.from({ length: csatRating }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetSession}
                      className="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                    >
                      Start New Support Session
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Quick Test Prompts */}
            {conversation.status !== 'closed' && (
              <div className="p-2 bg-zinc-100 border-t border-zinc-200">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase px-2 mb-1 block">Quick Testing Templates</span>
                <div className="flex flex-wrap gap-1 px-1">
                  {presets.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInputMessage(p.text)}
                      className="text-[10px] bg-white border border-zinc-300 text-zinc-700 px-2 py-1 rounded-lg hover:border-indigo-500 hover:text-indigo-600 transition-all font-medium truncate max-w-full"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Box */}
            {conversation.status !== 'closed' && (
              <div className="p-3 bg-white border-t border-zinc-200 flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Send a live message..."
                  value={inputMessage}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="flex-1 border border-zinc-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputMessage.trim()}
                  className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )}
  </div>
  );
}
