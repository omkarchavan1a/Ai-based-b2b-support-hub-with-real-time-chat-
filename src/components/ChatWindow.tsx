/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Sparkles, Clock, AlertCircle, Building, User, Mail, 
  Tag, CheckCircle2, ChevronRight, ThumbsUp, ThumbsDown, Loader2,
  Phone, MapPin, Monitor, Calendar, FileText, Check, Edit2, 
  MessageSquare, Star, ExternalLink, RefreshCw, Info, X, Settings
} from 'lucide-react';
import { Message, Conversation, Customer, User as AgentType } from '../types';

interface ChatWindowProps {
  conversation: Conversation;
  messages: Message[];
  activeAgent: AgentType;
  allAgents: AgentType[];
  customer: Customer | null;
  onSendMessage: (content: string) => void;
  onUpdateConversation: (id: string, updates: Partial<Conversation>) => void;
  typingState: { isTyping: boolean; senderType: string } | null;
  aiSuggestion: { text: string; logId: string; isThinking: boolean } | null;
  onClearSuggestion: () => void;
  token: string | null;
  conversations: Conversation[];
  onUpdateCustomer: (updated: Customer) => void;
}

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&h=150&fit=crop&crop=faces',
];

export default function ChatWindow({
  conversation,
  messages,
  activeAgent,
  allAgents,
  customer,
  onSendMessage,
  onUpdateConversation,
  typingState,
  aiSuggestion,
  onClearSuggestion,
  token,
  conversations,
  onUpdateCustomer
}: ChatWindowProps) {
  const [inputMessage, setInputMessage] = useState('');
  const [newTag, setNewTag] = useState('');
  const [editedSuggestion, setEditedSuggestion] = useState('');
  const [feedbackSent, setFeedbackSent] = useState<'liked' | 'disliked' | null>(null);

  const [isEditingProblem, setIsEditingProblem] = useState(false);
  const [localProblem, setLocalProblem] = useState(conversation.problemDescription || '');
  const [isSavingProblem, setIsSavingProblem] = useState(false);

  const [isResolving, setIsResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState(conversation.resolutionNotes || '');
  const [isSavingResolution, setIsSavingResolution] = useState(false);

  // Active right side drawer tab ('ai' or 'profile')
  const [activeRightTab, setActiveRightTab] = useState<'ai' | 'profile'>('ai');

  // AI key presence gating (PRD alignment)
  const [hasAIKey, setHasAIKey] = useState<boolean>(true);

  useEffect(() => {
    const checkAIKey = async () => {
      try {
        const res = await fetch(`/api/health?orgId=${conversation.orgId}`);
        const data = await res.json();
        setHasAIKey(!!data.hasGeminiKey);
      } catch (e) {
        console.error('Failed to check AI key health:', e);
      }
    };
    checkAIKey();
  }, [conversation.orgId, conversation.id]);

  // Customer detailed edit state
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profileCompany, setProfileCompany] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [profileNotes, setProfileNotes] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize local edit fields when active customer transitions
  useEffect(() => {
    if (customer) {
      setProfileName(customer.name || '');
      setProfileEmail(customer.email || '');
      setProfileCompany(customer.companyName || '');
      setProfilePhone(customer.phone || '');
      setProfileLocation(customer.location || '');
      setProfileNotes(customer.notes || '');
      setProfileAvatarUrl(customer.avatarUrl || '');
      setSaveStatus('idle');
      setShowAvatarPicker(false);
    }
  }, [customer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingState]);

  useEffect(() => {
    if (aiSuggestion) {
      setEditedSuggestion(aiSuggestion.text);
      setFeedbackSent(null);
    } else {
      setEditedSuggestion('');
    }
  }, [aiSuggestion]);

  useEffect(() => {
    setLocalProblem(conversation.problemDescription || '');
    setIsEditingProblem(false);
    setResolutionNotes(conversation.resolutionNotes || '');
    setIsResolving(false);
  }, [conversation.id, conversation.problemDescription, conversation.resolutionNotes]);

  const handleSend = () => {
    if (!inputMessage.trim()) return;
    onSendMessage(inputMessage);
    setInputMessage('');
    inputRef.current?.focus();
  };

  const handleSendSuggestion = async () => {
    if (!editedSuggestion.trim() || !aiSuggestion) return;
    onSendMessage(editedSuggestion);
    
    // Log helpfulness feedback
    try {
      await fetch('/api/copilot/feedback', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          logId: aiSuggestion.logId,
          wasUsed: true,
          agentEdited: editedSuggestion.trim() !== aiSuggestion.text.trim()
        })
      });
    } catch (e) {
      console.error('Failed to log feedback:', e);
    }

    onClearSuggestion();
  };

  const handleFeedback = async (type: 'liked' | 'disliked') => {
    if (!aiSuggestion) return;
    setFeedbackSent(type);
    try {
      await fetch('/api/copilot/feedback', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          logId: aiSuggestion.logId,
          wasUsed: type === 'liked',
          agentEdited: false
        })
      });
    } catch (e) {
      console.error('Failed to log feedback:', e);
    }
  };

  const addTag = () => {
    if (!newTag.trim()) return;
    const currentTags = conversation.tags || [];
    if (!currentTags.includes(newTag.trim().toLowerCase())) {
      const updated = [...currentTags, newTag.trim().toLowerCase()];
      onUpdateConversation(conversation.id, { tags: updated });
    }
    setNewTag('');
  };

  const removeTag = (tag: string) => {
    const updated = (conversation.tags || []).filter(t => t !== tag);
    onUpdateConversation(conversation.id, { tags: updated });
  };

  // Compute SLA timer status
  const getSLAStatus = () => {
    if (conversation.status === 'closed') return null;
    if (!conversation.slaBreachTime) return null;

    const breachDate = new Date(conversation.slaBreachTime);
    const now = new Date();
    const diffMs = breachDate.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);

    if (diffMins < 0) {
      return { text: `SLA Breached by ${Math.abs(diffMins)}m`, isBreached: true, color: 'text-rose-600 bg-rose-50 border-rose-200' };
    } else {
      return { text: `SLA breaches in ${diffMins}m`, isBreached: false, color: 'text-amber-600 bg-amber-50 border-amber-200' };
    }
  };

  const handleSaveProfile = async () => {
    if (!customer) return;
    setIsSavingProfile(true);
    setSaveStatus('idle');
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail,
          companyName: profileCompany,
          phone: profilePhone,
          location: profileLocation,
          notes: profileNotes,
          avatarUrl: profileAvatarUrl
        })
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdateCustomer(updated);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (e) {
      console.error('Failed to save customer profile:', e);
      setSaveStatus('error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const sla = getSLAStatus();

  // Find all historical conversations for this customer
  const customerHistory = customer 
    ? conversations.filter(c => c.customerId === customer.id)
    : [];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Upper header block */}
      <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
        <div className="flex items-center space-x-3 text-left">
          {/* Avatar Clickable Trigger */}
          <button 
            onClick={() => setActiveRightTab('profile')}
            className="relative group focus:outline-none shrink-0"
            title="Click to view client profile"
          >
            <img 
              src={customer?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'} 
              alt={customer?.name || 'Customer'} 
              className="w-10 h-10 rounded-xl object-cover ring-2 ring-zinc-100 group-hover:ring-indigo-500 hover:scale-105 transition-all cursor-pointer shadow-sm"
            />
            {/* Green status indicator */}
            <span className="absolute bottom-[-2px] right-[-2px] block h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
          </button>

          <div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveRightTab('profile')}
                className="text-sm font-bold text-zinc-950 hover:text-indigo-600 font-display transition-colors text-left focus:outline-none cursor-pointer hover:underline decoration-indigo-400 decoration-2"
                title="Click to view client profile"
              >
                {customer?.name || 'Anonymous Visitor'}
              </button>
              {sla && (
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-medium ${sla.color} flex items-center space-x-1`}>
                  <Clock className="w-3 h-3 mr-1" />
                  {sla.text}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-1 flex items-center space-x-2">
              <Building className="w-3 h-3 text-zinc-400 shrink-0" />
              <span className="truncate max-w-[120px]">{customer?.companyName || 'Web Widget'}</span>
              <span className="text-zinc-300">•</span>
              <Mail className="w-3 h-3 text-zinc-400 shrink-0" />
              <span className="truncate max-w-[160px]">{customer?.email || 'anonymous@visitor.com'}</span>
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center space-x-3">
          {/* Assignment Selection */}
          <div className="flex items-center space-x-1">
            <span className="text-[10px] font-semibold text-zinc-500">Assign:</span>
            <select
              value={conversation.assignedAgentId || ''}
              onChange={(e) => onUpdateConversation(conversation.id, { assignedAgentId: e.target.value || null })}
              className="text-xs border border-zinc-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white cursor-pointer"
            >
              <option value="">Unassigned</option>
              {allAgents.map(ag => (
                <option key={ag.id} value={ag.id}>{ag.name}</option>
              ))}
            </select>
          </div>

          {/* Ticket Status Select */}
          <div className="flex items-center space-x-1">
            <span className="text-[10px] font-semibold text-zinc-500">Status:</span>
            <select
              value={conversation.status}
              onChange={(e) => {
                const val = e.target.value as any;
                if (val === 'closed') {
                  setIsResolving(true);
                } else {
                  onUpdateConversation(conversation.id, { status: val });
                }
              }}
              className="text-xs border border-zinc-200 rounded-lg py-1 px-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium bg-white cursor-pointer"
            >
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Resolve Ticket Button */}
          {conversation.status !== 'closed' && (
            <button
              onClick={() => setIsResolving(true)}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1 shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Resolve Ticket</span>
            </button>
          )}
        </div>
      </div>

      {/* Split Window for Chat Feed and Copilot Suggested replies */}
      <div className="flex-1 flex min-h-0">
        {/* Chat Feed Column */}
        <div className="flex-1 flex flex-col min-h-0 border-r border-zinc-100 bg-zinc-50/50">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Customer's Stated Issue Banner */}
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-4 shadow-xs text-left">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <div className="flex items-center space-x-2">
                  <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                  </span>
                  <h4 className="text-xs font-bold text-zinc-900 font-display uppercase tracking-wider">Customer's Stated Issue</h4>
                </div>
                {!isEditingProblem ? (
                  <button
                    onClick={() => {
                      setLocalProblem(conversation.problemDescription || '');
                      setIsEditingProblem(true);
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center space-x-1 hover:underline cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{conversation.problemDescription ? 'Edit Issue' : 'Add Issue'}</span>
                  </button>
                ) : null}
              </div>

              {isEditingProblem ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={localProblem}
                    onChange={(e) => setLocalProblem(e.target.value)}
                    rows={3}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white resize-none font-sans leading-relaxed text-zinc-800"
                    placeholder="Document or update the exact issue the customer is experiencing..."
                  />
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => {
                        setLocalProblem(conversation.problemDescription || '');
                        setIsEditingProblem(false);
                      }}
                      className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-lg text-[10px] font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        setIsSavingProblem(true);
                        try {
                          await fetch(`/api/conversations/${conversation.id}`, {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token || ''}`
                            },
                            body: JSON.stringify({ problemDescription: localProblem.trim() })
                          });
                          onUpdateConversation(conversation.id, { problemDescription: localProblem.trim() });
                          setIsEditingProblem(false);
                        } catch (e) {
                          console.error('Failed to save problem description:', e);
                        } finally {
                          setIsSavingProblem(false);
                        }
                      }}
                      disabled={isSavingProblem}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-semibold transition-colors flex items-center space-x-1"
                    >
                      {isSavingProblem ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin animate-infinite" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <span>Save Issue</span>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-600 leading-relaxed mt-2.5 whitespace-pre-wrap italic bg-zinc-50/50 p-2.5 rounded-xl border border-zinc-100">
                  {conversation.problemDescription ? `"${conversation.problemDescription}"` : "No problem description submitted by customer yet. Click 'Add Issue' to document it."}
                </p>
              )}
            </div>

            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400">
                <AlertCircle className="w-8 h-8 mb-2" />
                <p className="text-xs">No message history yet. Send a message to start conversation.</p>
              </div>
            ) : (
              messages.map(msg => {
                const isCustomer = msg.senderType === 'customer';
                const isSystem = msg.senderType === 'system';
                
                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center my-2">
                      <span className="text-[10px] font-medium text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full border border-zinc-200/50">
                        {msg.content}
                      </span>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex items-start space-x-3 ${isCustomer ? 'justify-start text-left' : 'justify-end'}`}>
                    {/* Customer Message Avatar Trigger */}
                    {isCustomer && (
                      <button
                        onClick={() => setActiveRightTab('profile')}
                        className="mt-1 focus:outline-none shrink-0"
                        title={`Click to view ${msg.senderName}'s detailed profile`}
                      >
                        <img 
                          src={customer?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'} 
                          alt={msg.senderName} 
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-200 hover:ring-indigo-500 hover:scale-110 transition-all cursor-pointer shadow-sm" 
                        />
                      </button>
                    )}
                    
                    <div className="max-w-[70%] text-left">
                      <div className={`rounded-2xl p-3.5 text-xs shadow-sm ${
                        isCustomer 
                          ? 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-none' 
                          : 'bg-indigo-600 text-white rounded-tr-none'
                      }`}>
                        <div className="flex items-center justify-between space-x-4 mb-1">
                          <button
                            onClick={() => isCustomer && setActiveRightTab('profile')}
                            className={`font-semibold text-[10px] text-left focus:outline-none ${
                              isCustomer 
                                ? 'opacity-75 hover:text-indigo-600 hover:underline cursor-pointer' 
                                : 'opacity-75'
                            }`}
                            title={isCustomer ? "Click to view detailed profile" : undefined}
                          >
                            {msg.senderName}
                          </button>
                          <span className="text-[9px] opacity-65">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>

                    {/* Agent Message Avatar Trigger */}
                    {!isCustomer && !isSystem && (
                      <div className="mt-1 shrink-0" title={`${msg.senderName}`}>
                        <img 
                          src={msg.senderAvatarUrl || activeAgent.avatarUrl || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e'} 
                          alt={msg.senderName} 
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-200 shadow-sm" 
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Live Typing indicator */}
            {typingState?.isTyping && typingState.senderType === 'customer' && (
              <div className="flex justify-start items-center space-x-2">
                <img 
                  src={customer?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'} 
                  alt="Customer" 
                  className="w-8 h-8 rounded-full object-cover ring-1 ring-zinc-200 shadow-sm"
                />
                <div className="bg-white border border-zinc-200 rounded-2xl rounded-tl-none p-3 shadow-sm flex items-center space-x-1">
                  <span className="text-[10px] font-semibold text-zinc-500 mr-2">Client is typing</span>
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Ticket Tagging Footer */}
          <div className="px-6 py-2 border-t border-zinc-100 bg-white flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-zinc-400 font-semibold uppercase flex items-center">
              <Tag className="w-3 h-3 mr-1" /> Tags:
            </span>
            {(conversation.tags || []).map(t => (
              <span key={t} className="text-[10px] bg-indigo-50 text-indigo-700 font-medium px-2 py-0.5 rounded-full flex items-center space-x-1">
                <span>{t}</span>
                <button onClick={() => removeTag(t)} className="hover:text-indigo-900 font-bold ml-1">×</button>
              </span>
            ))}
            <div className="inline-flex items-center ml-2 border border-zinc-200 rounded-full px-2 py-0.5 bg-zinc-50">
              <input
                type="text"
                placeholder="+ tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                className="text-[10px] focus:outline-none bg-transparent w-12"
              />
            </div>
          </div>

          {/* Quick manual message composition input */}
          <div className="px-6 py-4 border-t border-zinc-200 bg-white flex items-center space-x-3">
            <input
              type="text"
              placeholder="Type your manual response here..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              ref={inputRef}
              className="flex-1 border border-zinc-200 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              onClick={handleSend}
              disabled={!inputMessage.trim()}
              className="px-4 py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors shadow-sm disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tabbed Right Panel (AI Copilot OR Customer CRM Profile) */}
        <div id="tour-copilot-section" className="w-80 bg-zinc-50 border-l border-zinc-200 flex flex-col min-h-0">
          {/* Header Tab Toggles */}
          <div className="flex border-b border-zinc-200 bg-white shrink-0">
            <button
              onClick={() => setActiveRightTab('ai')}
              className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 ${
                activeRightTab === 'ai'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Copilot</span>
            </button>
            <button
              onClick={() => setActiveRightTab('profile')}
              className={`flex-1 py-3 text-[11px] font-bold uppercase tracking-wider text-center border-b-2 transition-all flex items-center justify-center space-x-1.5 ${
                activeRightTab === 'profile'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Client Profile</span>
            </button>
          </div>

          {/* Tab Content Panel */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0 flex flex-col">
            {activeRightTab === 'ai' ? (
              // --- TAB 1: AI Copilot ---
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto min-h-0 flex flex-col pb-4">
                  {!hasAIKey ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-zinc-50/50 rounded-2xl border border-zinc-200/50 max-w-sm mx-auto my-auto space-y-4 animate-in fade-in duration-300">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-indigo-500 animate-pulse" />
                      </div>
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-semibold text-zinc-900 font-display">AI Copilot Deactivated</h4>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                          Your organization has not configured an active AI provider key (Gemini or OpenAI). Connect a verified key in Settings to unlock automated RAG drafts and live copilot recommendations.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const settingsTab = document.getElementById('tour-nav-settings');
                          if (settingsTab) {
                            settingsTab.click();
                          } else {
                            const navBtn = document.querySelector('[id*="settings"]') as HTMLButtonElement;
                            if (navBtn) navBtn.click();
                          }
                        }}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold transition-all shadow-sm cursor-pointer flex items-center space-x-1"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Configure API Key</span>
                      </button>
                    </div>
                  ) : aiSuggestion?.isThinking ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-400 py-10">
                      <Loader2 className="w-6 h-6 text-indigo-500 animate-spin mb-2" />
                      <p className="text-[11px]">RAG Knowledge Retrieval active...</p>
                      <p className="text-[10px] text-zinc-400 mt-1 max-w-[180px]">Querying local indices and drafting expert solution.</p>
                    </div>
                  ) : aiSuggestion?.text ? (
                    <div className="space-y-4 flex flex-col flex-1">
                      <div className="flex-1 flex flex-col bg-white border border-indigo-100 rounded-xl p-3 shadow-sm min-h-0">
                        <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-100">
                          <span className="text-[10px] font-semibold text-indigo-600 flex items-center uppercase">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Suggested Draft
                          </span>
                          <div className="flex items-center space-x-1.5">
                            <button 
                              onClick={() => handleFeedback('liked')}
                              disabled={feedbackSent !== null}
                              className={`p-1 rounded hover:bg-zinc-100 transition-colors ${feedbackSent === 'liked' ? 'text-emerald-600 bg-emerald-50' : 'text-zinc-400'}`}
                              title="Helpful suggestion"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleFeedback('disliked')}
                              disabled={feedbackSent !== null}
                              className={`p-1 rounded hover:bg-zinc-100 transition-colors ${feedbackSent === 'disliked' ? 'text-rose-600 bg-rose-50' : 'text-zinc-400'}`}
                              title="Irrelevant suggestion"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={editedSuggestion}
                          onChange={(e) => setEditedSuggestion(e.target.value)}
                          className="flex-1 text-[11px] text-zinc-700 leading-relaxed font-sans resize-none focus:outline-none w-full border-0 p-0"
                          placeholder="Review and edit suggested reply..."
                        />
                      </div>
 
                      <div className="space-y-2">
                        <button
                          onClick={handleSendSuggestion}
                          className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center space-x-1.5"
                        >
                          <span>Accept & Send Reply</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={onClearSuggestion}
                          className="w-full py-2 bg-white border border-zinc-200 text-zinc-600 rounded-xl text-xs font-medium hover:bg-zinc-50 transition-colors"
                        >
                          Dismiss Draft
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-400 py-10 px-2">
                      <Sparkles className="w-7 h-7 text-zinc-300 mb-2" />
                      <h4 className="text-[11px] font-semibold text-zinc-600">No Action Required</h4>
                      <p className="text-[10px] text-zinc-500 mt-1 max-w-[180px]">
                        When the customer sends a query, the AI will search the Knowledge Base and propose a smart response draft automatically.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // --- TAB 2: Client Profile (Dossier CRM) ---
              <div className="space-y-5 text-left flex flex-col h-full">
                {customer ? (
                  <>
                    {/* Avatar Display Card */}
                    <div className="bg-white border border-zinc-200 rounded-2xl p-4 text-center shadow-sm relative overflow-hidden">
                      <div className="absolute top-2 right-2">
                        <button 
                          onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                          className="p-1 rounded-full text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 transition-colors"
                          title="Change customer avatar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex justify-center mb-2">
                        <img 
                          src={profileAvatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'} 
                          alt="Customer profile" 
                          className="w-20 h-20 rounded-full object-cover ring-4 ring-indigo-50 shadow-md"
                        />
                      </div>

                      <h3 className="text-xs font-bold text-zinc-900">{profileName || 'No Name Provided'}</h3>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{profileCompany || 'Independent Account'}</p>

                      {/* Expandable Photo Picker Preset Grid */}
                      {showAvatarPicker && (
                        <div className="mt-3 pt-3 border-t border-zinc-100">
                          <p className="text-[9px] font-bold text-zinc-400 uppercase mb-2">Select Avatar Photo</p>
                          <div className="grid grid-cols-6 gap-1.5 justify-center">
                            {AVATAR_PRESETS.map((preset, index) => (
                              <button
                                key={index}
                                onClick={() => {
                                  setProfileAvatarUrl(preset);
                                  setShowAvatarPicker(false);
                                }}
                                className="w-7 h-7 rounded-full overflow-hidden ring-1 ring-zinc-200 hover:ring-indigo-500 focus:outline-none transition-all hover:scale-110"
                              >
                                <img src={preset} alt={`preset-${index}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Stats Dashboard Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white border border-zinc-200 rounded-xl p-2.5 shadow-sm text-center">
                        <MessageSquare className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
                        <span className="block text-[10px] text-zinc-400 font-medium">Interaction count</span>
                        <span className="text-sm font-extrabold text-zinc-950">{customerHistory.length} tickets</span>
                      </div>
                      <div className="bg-white border border-zinc-200 rounded-xl p-2.5 shadow-sm text-center">
                        <Calendar className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                        <span className="block text-[10px] text-zinc-400 font-medium">Customer Since</span>
                        <span className="text-[11px] font-bold text-zinc-950">
                          {new Date(customer.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    {/* Dossier CRM Form */}
                    <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-3.5 shadow-sm">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-1.5 flex items-center">
                        <User className="w-3.5 h-3.5 mr-1 text-zinc-400" />
                        <span>Client Dossier Details</span>
                      </p>

                      {/* Field: Full Name */}
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">Full Name</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-400">
                            <User className="w-3.5 h-3.5" />
                          </span>
                          <input
                            type="text"
                            value={profileName}
                            onChange={(e) => setProfileName(e.target.value)}
                            placeholder="Customer Name"
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Field: Email */}
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">Email Address</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-400">
                            <Mail className="w-3.5 h-3.5" />
                          </span>
                          <input
                            type="email"
                            value={profileEmail}
                            onChange={(e) => setProfileEmail(e.target.value)}
                            placeholder="Email Address"
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Field: Company */}
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">Company Name</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-400">
                            <Building className="w-3.5 h-3.5" />
                          </span>
                          <input
                            type="text"
                            value={profileCompany}
                            onChange={(e) => setProfileCompany(e.target.value)}
                            placeholder="Company Name"
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Field: Phone */}
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">Phone Number</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-400">
                            <Phone className="w-3.5 h-3.5" />
                          </span>
                          <input
                            type="text"
                            value={profilePhone}
                            onChange={(e) => setProfilePhone(e.target.value)}
                            placeholder="+1 (555) 000-0000"
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Field: Location */}
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">Detected Location</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-400">
                            <MapPin className="w-3.5 h-3.5" />
                          </span>
                          <input
                            type="text"
                            value={profileLocation}
                            onChange={(e) => setProfileLocation(e.target.value)}
                            placeholder="City, Country / IP address"
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Field: Browser (Read-only System Stat) */}
                      {customer.browserInfo && (
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">Technical Browser User-Agent</label>
                          <div className="flex items-center space-x-2 bg-zinc-50 border border-zinc-200/60 rounded-xl p-2 text-[10px] text-zinc-600 font-mono">
                            <Monitor className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="truncate">{customer.browserInfo}</span>
                          </div>
                        </div>
                      )}

                      {/* Field: Internal Relationship Notes */}
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-400 uppercase mb-1">Internal CRM Relationship Notes</label>
                        <div className="relative">
                          <span className="absolute top-2.5 left-2.5 text-zinc-400">
                            <FileText className="w-3.5 h-3.5" />
                          </span>
                          <textarea
                            value={profileNotes}
                            onChange={(e) => setProfileNotes(e.target.value)}
                            placeholder="Log VIP status, special preferences, past server bugs, billing problems, or follow-up tasks..."
                            rows={3}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                          />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="pt-2">
                        <button
                          onClick={handleSaveProfile}
                          disabled={isSavingProfile}
                          className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          {isSavingProfile ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Saving Dossier...</span>
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Save Dossier Changes</span>
                            </>
                          )}
                        </button>
                        
                        {saveStatus === 'success' && (
                          <p className="text-[10px] text-emerald-600 font-semibold text-center mt-2 flex items-center justify-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Client profile saved successfully!</span>
                          </p>
                        )}
                        {saveStatus === 'error' && (
                          <p className="text-[10px] text-rose-600 font-semibold text-center mt-2 flex items-center justify-center space-x-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Failed to update customer details.</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Past Ticket Interaction History Log list */}
                    <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 pb-1.5 mb-2 flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-zinc-400" />
                        <span>Recent Ticket History ({customerHistory.length})</span>
                      </p>

                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {customerHistory.map(hist => {
                          const isCurrent = hist.id === conversation.id;
                          return (
                            <div 
                              key={hist.id} 
                              className={`p-2 rounded-xl border text-[10px] transition-all ${
                                isCurrent 
                                  ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-100' 
                                  : 'bg-zinc-50/50 border-zinc-100 hover:bg-zinc-100/50'
                              }`}
                            >
                              <div className="flex items-center justify-between font-semibold">
                                <span className="text-zinc-700 truncate max-w-[110px]">
                                  {hist.id.replace('conv_', '#Ticket-')}
                                </span>
                                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                                  hist.status === 'open' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                  hist.status === 'pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                  'bg-zinc-100 text-zinc-500'
                                }`}>
                                  {hist.status}
                                </span>
                              </div>
                              
                              <p className="text-[9px] text-zinc-400 mt-1">
                                Created: {new Date(hist.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>

                              {/* Highlight AI Ticket summaries or CSAT if available */}
                              {hist.summary && (
                                <div className="mt-1.5 bg-white p-1.5 rounded border border-zinc-100 text-[9px] text-zinc-500 leading-relaxed italic">
                                  "{hist.summary.slice(0, 100)}..."
                                </div>
                              )}

                              {hist.csatScore && (
                                <div className="mt-1 flex items-center space-x-1.5 text-emerald-600">
                                  <Star className="w-3 h-3 fill-emerald-500 stroke-emerald-500" />
                                  <span className="font-bold text-[9px]">CSAT: {hist.csatScore}/5 Rating</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center text-zinc-400 py-12">
                    <User className="w-8 h-8 mb-2" />
                    <p className="text-xs">No client details available.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resolution Modal */}
      {isResolving && (
        <div className="fixed inset-0 bg-zinc-900/65 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-xl border border-zinc-250 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-zinc-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="font-display font-bold text-sm">Resolve Support Ticket</h3>
              </div>
              <button 
                onClick={() => setIsResolving(false)}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="bg-emerald-50 text-emerald-800 p-3.5 rounded-xl text-xs flex items-start space-x-2.5 border border-emerald-100">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Wrap Up and Document</p>
                  <p className="mt-1 opacity-90 leading-relaxed">
                    Provide a brief summary of how you resolved the customer's problem. This resolution will be shared directly in the chat history with the customer and logged in our CRM.
                  </p>
                </div>
              </div>

              {conversation.problemDescription && (
                <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-150 text-left">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Customer's Stated Issue</span>
                  <p className="text-xs text-zinc-700 italic mt-1 font-medium">"{conversation.problemDescription}"</p>
                </div>
              )}

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-bold text-zinc-700">How was this issue resolved? <span className="text-red-500">*</span></label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="e.g. Cleared customer session cache, verified invoice payment via stripe dashboard, and confirmed reset link is fully functional."
                  rows={4}
                  required
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white resize-none font-sans leading-relaxed text-zinc-800"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsResolving(false)}
                className="px-4 py-2 bg-white border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!resolutionNotes.trim() || isSavingResolution}
                onClick={async () => {
                  setIsSavingResolution(true);
                  try {
                    // 1. PATCH the conversation with 'closed' status and resolutionNotes
                    await fetch(`/api/conversations/${conversation.id}`, {
                      method: 'PATCH',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token || ''}`
                      },
                      body: JSON.stringify({
                        status: 'closed',
                        resolutionNotes: resolutionNotes.trim()
                      })
                    });

                    // 2. Post a formal System / Agent Resolution message to the chat!
                    const systemMessageText = `✅ TICKET RESOLVED\n\nResolution Summary:\n${resolutionNotes.trim()}`;
                    onSendMessage(systemMessageText);

                    // 3. Update parent state
                    onUpdateConversation(conversation.id, {
                      status: 'closed',
                      resolutionNotes: resolutionNotes.trim()
                    });

                    setIsResolving(false);
                  } catch (e) {
                    console.error('Failed to resolve conversation:', e);
                  } finally {
                    setIsSavingResolution(false);
                  }
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center space-x-2 cursor-pointer"
              >
                {isSavingResolution ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Closing Ticket...</span>
                  </>
                ) : (
                  <span>Confirm Resolution & Close</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
