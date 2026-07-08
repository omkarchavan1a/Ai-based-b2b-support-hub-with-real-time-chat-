/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, Key, Clock, Shield, Sliders, Code, 
  Copy, Check, Sparkles, AlertTriangle, ShieldCheck,
  Eye, EyeOff, Trash2, Plus, X, Globe, Database, Cpu, Server, CheckCircle2
} from 'lucide-react';
import { SupportSettings, ProjectApiKey } from '../types';

interface SettingsViewProps {
  orgId: string;
  token: string;
}

export default function SettingsView({ orgId, token }: SettingsViewProps) {
  const [settings, setSettings] = useState<SupportSettings | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string>('Google Gemini');
  const [copied, setCopied] = useState(false);

  // SLA states
  const [lowSLA, setLowSLA] = useState(1440);
  const [mediumSLA, setMediumSLA] = useState(480);
  const [highSLA, setHighSLA] = useState(120);
  const [urgentSLA, setUrgentSLA] = useState(60);

  // Business hours states
  const [businessEnabled, setBusinessEnabled] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');

  // Custom API keys states
  const [apiKeys, setApiKeys] = useState<ProjectApiKey[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProvider, setNewProvider] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStatus, setNewStatus] = useState<'active' | 'inactive'>('active');
  const [showKeyId, setShowKeyId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchSettings();
    checkHealth();
  }, [orgId, token]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`/api/settings?orgId=${orgId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data: SupportSettings = await res.json();
        setSettings(data);
        setLowSLA(data.slaConfig.low);
        setMediumSLA(data.slaConfig.medium);
        setHighSLA(data.slaConfig.high);
        setUrgentSLA(data.slaConfig.urgent);
        setBusinessEnabled(data.businessHours.enabled);
        setStartTime(data.businessHours.start);
        setEndTime(data.businessHours.end);
        setApiKeys(data.apiKeys || []);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const checkHealth = async () => {
    try {
      const res = await fetch(`/api/health?orgId=${orgId}`);
      if (res.ok) {
        const status = await res.json();
        setHasGeminiKey(status.hasGeminiKey);
        if (status.activeProvider) {
          setActiveProvider(status.activeProvider);
        }
      }
    } catch (err) {
      console.error('Failed to verify API key status:', err);
    }
  };

  const handleSave = async (customKeysList?: ProjectApiKey[]) => {
    try {
      const keysToSave = customKeysList !== undefined ? customKeysList : apiKeys;
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orgId,
          slaConfig: {
            low: lowSLA,
            medium: mediumSLA,
            high: highSLA,
            urgent: urgentSLA
          },
          businessHours: {
            enabled: businessEnabled,
            start: startTime,
            end: endTime,
            timezone: 'UTC'
          },
          apiKeys: keysToSave
        })
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setApiKeys(updated.apiKeys || []);
        setIsSaved(true);
        checkHealth();
        setTimeout(() => setIsSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  };

  const handleAddApiKey = () => {
    if (!newProvider.trim() || !newKey.trim()) {
      setFormError('Provider name and API key are required.');
      return;
    }
    const newApiKeyObj: ProjectApiKey = {
      id: `key_${Date.now()}`,
      providerName: newProvider.trim(),
      apiKey: newKey.trim(),
      description: newDesc.trim(),
      status: newStatus,
      createdAt: new Date().toISOString()
    };
    const updatedKeys = [...apiKeys, newApiKeyObj];
    setApiKeys(updatedKeys);
    
    // Clear form
    setNewProvider('');
    setNewKey('');
    setNewDesc('');
    setNewStatus('active');
    setFormError('');
    setShowAddForm(false);

    // Save automatically for great UX
    handleSave(updatedKeys);
  };

  const handleDeleteApiKey = (id: string) => {
    const updatedKeys = apiKeys.filter(k => k.id !== id);
    setApiKeys(updatedKeys);
    handleSave(updatedKeys);
  };

  const handleToggleApiKeyStatus = (id: string) => {
    const updatedKeys = apiKeys.map(k => {
      if (k.id === id) {
        return { ...k, status: (k.status === 'active' ? 'inactive' : 'active') as 'active' | 'inactive' };
      }
      return k;
    });
    setApiKeys(updatedKeys);
    handleSave(updatedKeys);
  };

  const embedCode = `<!-- AI B2B Support Hub Real-time Widget snippet -->
<script>
  window.StellarSupportConfig = {
    orgId: "${orgId}",
    theme: "modern-dark",
    primaryColor: "#4f46e5"
  };
</script>
<script src="${window.location.origin}/assets/support-widget.js" async></script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!settings) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/50">
      <div className="max-w-3xl space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-sm font-bold text-zinc-900 font-display tracking-wide uppercase">Hub Configuration</h2>
          <p className="text-xs text-zinc-500 mt-1">Configure automated routing rules, SLA countdown timers, security triggers, and grab embed codes.</p>
        </div>

        {/* AI Secrets Monitor Panel */}
        <div className={`border rounded-2xl p-4 shadow-sm flex items-start space-x-4 ${
          hasGeminiKey 
            ? 'border-emerald-100 bg-emerald-50/50 text-emerald-950' 
            : 'border-rose-100 bg-rose-50/50 text-rose-950'
        }`}>
          {hasGeminiKey ? (
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h3 className="font-display text-xs font-semibold flex items-center">
              {hasGeminiKey ? `${activeProvider} AI Integration Active` : 'AI Key Missing (RAG suggestion drafts are disabled)'}
            </h3>
            <p className="text-[11px] mt-1 leading-relaxed opacity-90">
              {hasGeminiKey 
                ? `Your server is securely authenticated with ${activeProvider}. Automated suggested replies from your local Knowledge Base are actively analyzing customer inquiries in real-time.`
                : 'To enable automatic RAG draft suggestions from your Knowledge Base, you can register any LLM API provider key (Google Gemini, OpenAI, Anthropic Claude, DeepSeek, Groq, OpenRouter, Cohere) under the "Project API Keys & Providers" section below or configure your GEMINI_API_KEY inside the Settings > Secrets panel.'
              }
            </p>
          </div>
        </div>

        {/* SLA Threshold Configs */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold text-zinc-900 font-display flex items-center">
            <Sliders className="w-4 h-4 mr-1.5 text-zinc-400" /> SLA Response Thresholds (Minutes)
          </h3>
          <p className="text-[10px] text-zinc-500">Define the response deadlines for different conversation priorities before they trigger SLA breaches on agent dashboards.</p>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase">Urgent SLA</label>
              <input
                type="number"
                value={urgentSLA}
                onChange={(e) => setUrgentSLA(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold text-zinc-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase">High SLA</label>
              <input
                type="number"
                value={highSLA}
                onChange={(e) => setHighSLA(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold text-zinc-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase">Medium SLA</label>
              <input
                type="number"
                value={mediumSLA}
                onChange={(e) => setMediumSLA(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold text-zinc-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase">Low SLA</label>
              <input
                type="number"
                value={lowSLA}
                onChange={(e) => setLowSLA(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none font-semibold text-zinc-800"
              />
            </div>
          </div>
        </div>

        {/* Business Hours Setup */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-900 font-display flex items-center">
              <Clock className="w-4 h-4 mr-1.5 text-zinc-400" /> Business Operations Hours
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={businessEnabled}
                onChange={(e) => setBusinessEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
            </label>
          </div>
          <p className="text-[10px] text-zinc-500">When enabled, messages sent outside of these times automatically trigger an "Away Auto-Reply" system email to the visitor.</p>
          
          <div className={`grid grid-cols-2 gap-4 pt-2 transition-opacity ${businessEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase">Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:outline-none text-zinc-800"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-zinc-400 uppercase">End Time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-zinc-200 rounded-xl text-xs focus:outline-none text-zinc-800"
              />
            </div>
          </div>
        </div>

        {/* Project API Keys & Providers Config */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-900 font-display flex items-center">
              <Key className="w-4 h-4 mr-1.5 text-indigo-600" /> Project API Keys & Providers
            </h3>
            {!showAddForm && (
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(true);
                  setFormError('');
                }}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add API Key</span>
              </button>
            )}
          </div>
          <p className="text-[10px] text-zinc-500">Configure and register secure API credentials and provider endpoints for external integrations, webhook processors, and server-side logic.</p>

          {/* Add Form Expansion */}
          {showAddForm && (
            <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200/80 space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200/50">
                <h4 className="text-[11px] font-bold text-zinc-700 uppercase tracking-wider">Register New Key</h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Presets */}
              <div>
                <span className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Quick Provider Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['OpenAI', 'Google Gemini', 'Anthropic Claude', 'Stripe', 'Twilio', 'Slack Webhook'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewProvider(p)}
                      className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-zinc-200 hover:border-indigo-300 rounded-lg text-[10px] font-medium text-zinc-600 hover:text-indigo-600 transition-all cursor-pointer"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 mb-1">API Provider Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. OpenAI or Custom SaaS"
                    value={newProvider}
                    onChange={(e) => setNewProvider(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 mb-1">Project Name / Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Dev Testing or Production Main"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-zinc-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 mb-1">API Authentication Key *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. sk-proj-........................ or client-secret"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-zinc-850 font-mono"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-zinc-500">Initial Status:</span>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as 'active' | 'inactive')}
                    className="text-xs border border-zinc-200 rounded-lg py-1 px-2 focus:outline-none bg-white font-medium text-zinc-700 cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3.5 py-1.5 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-xl text-[11px] font-semibold text-zinc-600 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddApiKey}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-[11px] font-bold text-white transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <span>Register Key</span>
                  </button>
                </div>
              </div>

              {formError && (
                <p className="text-[10px] font-semibold text-rose-600">{formError}</p>
              )}
            </div>
          )}

          {/* List of registered keys */}
          {apiKeys.length === 0 ? (
            <div className="border border-dashed border-zinc-200 rounded-2xl p-6 text-center text-zinc-400 bg-zinc-50/20">
              <Key className="w-8 h-8 mx-auto mb-2 opacity-30 text-zinc-500" />
              <p className="text-xs font-medium text-zinc-500">No custom API keys registered yet.</p>
              <p className="text-[10px] text-zinc-400 mt-1">Register keys for your external provider systems to track authorization state.</p>
            </div>
          ) : (
            <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-150">
                      <th className="px-4 py-2.5 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Provider & Project</th>
                      <th className="px-4 py-2.5 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Authentication Key</th>
                      <th className="px-4 py-2.5 text-[9px] font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-2.5 text-[9px] font-bold text-zinc-400 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {apiKeys.map((key) => {
                      const isRevealed = showKeyId === key.id;
                      const maskedKey = key.apiKey.length > 10
                        ? `${key.apiKey.substring(0, 6)}••••••••${key.apiKey.substring(key.apiKey.length - 4)}`
                        : '••••••••••••';
                      
                      return (
                        <tr key={key.id} className="hover:bg-zinc-50/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              <span className="p-1 bg-zinc-100 text-zinc-600 rounded-lg shrink-0">
                                <Cpu className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <span className="text-xs font-bold text-zinc-800 block">{key.providerName}</span>
                                {key.description && (
                                  <span className="text-[10px] text-zinc-400 block">{key.description}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-zinc-600">
                            <div className="flex items-center space-x-2">
                              <span>{isRevealed ? key.apiKey : maskedKey}</span>
                              <button
                                type="button"
                                onClick={() => setShowKeyId(isRevealed ? null : key.id)}
                                className="text-zinc-400 hover:text-zinc-600 p-0.5"
                                title={isRevealed ? "Hide Key" : "Reveal Key"}
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(key.apiKey);
                                }}
                                className="text-zinc-400 hover:text-zinc-600 p-0.5"
                                title="Copy to clipboard"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleToggleApiKeyStatus(key.id)}
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase transition-all border shrink-0 cursor-pointer ${
                                key.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                              }`}
                            >
                              {key.status}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteApiKey(key.id)}
                              className="text-zinc-400 hover:text-rose-600 p-1 transition-colors hover:bg-rose-50 rounded-lg"
                              title="Delete Key"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Embed Code Grabber */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold text-zinc-900 font-display flex items-center">
            <Code className="w-4 h-4 mr-1.5 text-zinc-400" /> Embed Chat Widget
          </h3>
          <p className="text-[10px] text-zinc-500">Copy this lightweight framework-agnostic JavaScript tag and paste it inside the HTML body header of your primary corporate marketing site to go live.</p>
          
          <div className="relative bg-zinc-950 p-4 rounded-xl">
            <pre className="text-[10px] text-zinc-300 font-mono overflow-x-auto whitespace-pre">
              {embedCode}
            </pre>
            <button
              onClick={copyToClipboard}
              className="absolute right-3 top-3 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors border border-zinc-700 shadow-sm"
              title="Copy snippet"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Global Save Trigger */}
        <div className="flex items-center space-x-3 pt-2">
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
          >
            Save Changes
          </button>
          {isSaved && (
            <span className="text-xs font-semibold text-emerald-600 animate-fade-in flex items-center">
              <Check className="w-4 h-4 mr-1" /> Settings saved successfully
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
