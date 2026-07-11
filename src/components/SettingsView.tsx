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

  // AI Connection Test States (PRD alignment)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'connected' | 'invalid'>('idle');
  const [testError, setTestError] = useState<string>('');
  const [testSuccess, setTestSuccess] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');

  // Dedicated AI Provider Config States (PRD Section 3.2)
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>('gemini');
  const [aiKey, setAiKey] = useState<string>('');
  const [aiModel, setAiModel] = useState<string>('gemini-2.5-flash');
  const [aiStatus, setAiStatus] = useState<'connected' | 'invalid' | 'not_set'>('not_set');
  const [aiMasked, setAiMasked] = useState<string | null>(null);
  const [aiTestStatus, setAiTestStatus] = useState<'idle' | 'testing' | 'connected' | 'invalid'>('idle');
  const [aiTestError, setAiTestError] = useState<string>('');
  const [aiTestSuccess, setAiTestSuccess] = useState<string>('');
  const [isAiSaved, setIsAiSaved] = useState<boolean>(false);

  const changeProvider = (val: string) => {
    setNewProvider(val);
    setTestStatus('idle');
    setTestError('');
    setTestSuccess('');
    if (val.toLowerCase().includes('gemini') || val.toLowerCase().includes('google')) {
      setSelectedModel('gemini-2.5-flash');
    } else if (val.toLowerCase().includes('openai')) {
      setSelectedModel('gpt-4o-mini');
    }
  };

  const changeKey = (val: string) => {
    setNewKey(val);
    setTestStatus('idle');
    setTestError('');
    setTestSuccess('');
  };

  const handleTestConnection = async () => {
    if (!newProvider.trim() || !newKey.trim()) {
      setFormError('Provider name and API key are required to test connection.');
      return;
    }
    setTestStatus('testing');
    setTestError('');
    setTestSuccess('');
    setFormError('');
    try {
      const res = await fetch('/api/v1/settings/ai-key/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider: newProvider,
          apiKey: newKey,
          model: selectedModel
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'connected') {
        setTestStatus('connected');
        setTestSuccess(data.message || 'Connection successful!');
      } else {
        setTestStatus('invalid');
        setTestError(data.error || 'Connection failed.');
      }
    } catch (err: any) {
      setTestStatus('invalid');
      setTestError(err.message || 'Connection test failed.');
    }
  };

  const fetchAIKey = async () => {
    try {
      const res = await fetch('/api/v1/settings/ai-key', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'connected') {
          setAiProvider(data.provider === 'openai' ? 'openai' : 'gemini');
          setAiStatus('connected');
          setAiMasked(data.maskedPreview);
          setAiKey(data.maskedPreview || '');
          setAiModel(data.model || (data.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash'));
        } else {
          setAiStatus('not_set');
          setAiMasked(null);
          setAiKey('');
          setAiModel('gemini-2.5-flash');
        }
      }
    } catch (err) {
      console.error('Failed to load AI key settings:', err);
    }
  };

  const handleTestAIConnection = async () => {
    if (!aiKey.trim()) {
      setAiTestError('API Key is required to run the connection test.');
      return;
    }
    setAiTestStatus('testing');
    setAiTestError('');
    setAiTestSuccess('');
    try {
      const res = await fetch('/api/v1/settings/ai-key/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider: aiProvider,
          apiKey: aiKey,
          model: aiModel
        })
      });
      const data = await res.json();
      if (res.ok && data.status === 'connected') {
        setAiTestStatus('connected');
        setAiTestSuccess(data.message || 'Connection successful!');
      } else {
        setAiTestStatus('invalid');
        setAiTestError(data.error || 'Connection failed.');
      }
    } catch (err: any) {
      setAiTestStatus('invalid');
      setAiTestError(err.message || 'Connection test failed.');
    }
  };

  const handleSaveAIKey = async () => {
    if (aiTestStatus !== 'connected') return;
    try {
      const res = await fetch('/api/v1/settings/ai-key/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          provider: aiProvider,
          apiKey: aiKey,
          model: aiModel
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiStatus('connected');
        setAiMasked(data.maskedPreview);
        setAiKey(data.maskedPreview);
        setIsAiSaved(true);
        setTimeout(() => setIsAiSaved(false), 2000);
        checkHealth();
        fetchSettings();
      } else {
        const data = await res.json();
        setAiTestError(data.error || 'Failed to save API Key.');
      }
    } catch (err: any) {
      setAiTestError(err.message || 'Failed to save API Key.');
    }
  };

  const handleRemoveAIKey = async () => {
    try {
      const res = await fetch('/api/v1/settings/ai-key', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAiStatus('not_set');
        setAiMasked(null);
        setAiKey('');
        setAiTestStatus('idle');
        setAiTestSuccess('');
        setAiTestError('');
        checkHealth();
        fetchSettings();
      }
    } catch (err) {
      console.error('Failed to remove AI key:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
    checkHealth();
    fetchAIKey();
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

    const provLower = newProvider.toLowerCase();
    const isAIProvider = provLower.includes('gemini') || provLower.includes('google') || provLower.includes('openai') || provLower.includes('anthropic') || provLower.includes('deepseek');

    if (isAIProvider && testStatus !== 'connected') {
      setFormError('A successful connection test is required to register this AI provider key. Please click "Test Connection" first.');
      return;
    }

    const newApiKeyObj: ProjectApiKey = {
      id: `key_${Date.now()}`,
      providerName: newProvider.trim(),
      apiKey: newKey.trim(),
      description: newDesc.trim(),
      status: newStatus,
      createdAt: new Date().toISOString(),
      model: isAIProvider ? selectedModel : undefined
    };
    const updatedKeys = [...apiKeys, newApiKeyObj];
    setApiKeys(updatedKeys);
    
    // Clear form & connection test states
    setNewProvider('');
    setNewKey('');
    setNewDesc('');
    setNewStatus('active');
    setFormError('');
    setTestStatus('idle');
    setTestError('');
    setTestSuccess('');
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

        {/* AI Provider Config Panel (PRD 3.2 Alignment) */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-zinc-150 pb-3">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <div>
                <h3 className="text-xs font-semibold text-zinc-900 font-display">AI Copilot Provider Settings</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Configure your primary large language model provider to power automated real-time RAG suggestions.</p>
              </div>
            </div>
            
            {/* Status Badge */}
            <div className="flex items-center">
              {aiStatus === 'connected' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ● Connected
                </span>
              ) : aiStatus === 'invalid' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                  ● Invalid Key
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-zinc-100 text-zinc-500 border border-zinc-200">
                  ● Not Configured
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 mb-1">AI Service Provider *</label>
              <select
                value={aiProvider}
                onChange={(e) => {
                  const val = e.target.value as 'gemini' | 'openai';
                  setAiProvider(val);
                  setAiModel(val === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini');
                  setAiTestStatus('idle');
                  setAiTestError('');
                  setAiTestSuccess('');
                }}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-zinc-800 cursor-pointer font-medium"
              >
                <option value="gemini">Google Gemini (Recommended)</option>
                <option value="openai">OpenAI (GPT Models)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-500 mb-1">Model Name *</label>
              <select
                value={aiModel}
                onChange={(e) => {
                  setAiModel(e.target.value);
                  setAiTestStatus('idle');
                  setAiTestError('');
                  setAiTestSuccess('');
                }}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-zinc-800 cursor-pointer font-medium"
              >
                {aiProvider === 'gemini' ? (
                  <>
                    <option value="gemini-2.0-flash">gemini-2.0-flash (Ultra Fast & Smart)</option>
                    <option value="gemini-2.5-flash">gemini-2.5-flash (Standard)</option>
                    <option value="gemini-3.5-flash">gemini-3.5-flash (Experimental)</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro (Creative Reasoning)</option>
                  </>
                ) : (
                  <>
                    <option value="gpt-4o-mini">gpt-4o-mini (Lightweight & Cost-effective)</option>
                    <option value="gpt-4o">gpt-4o (High Intelligence)</option>
                    <option value="gpt-3.5-turbo">gpt-3.5-turbo (Legacy)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 mb-1">API Key Password *</label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder={aiMasked ? aiMasked : "Paste your secret key here"}
                value={aiKey}
                onChange={(e) => {
                  setAiKey(e.target.value);
                  setAiTestStatus('idle');
                  setAiTestError('');
                  setAiTestSuccess('');
                }}
                className="w-full pl-3 pr-10 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-zinc-850 font-mono"
              />
              <span className="absolute right-3 top-2.5 text-zinc-400">
                <Key className="w-3.5 h-3.5" />
              </span>
            </div>
            {aiMasked && (
              <p className="text-[9px] text-zinc-400 mt-1">
                A key is currently configured ({aiMasked}). Paste a new key above to overwrite.
              </p>
            )}
          </div>

          {/* Test connection results inline */}
          {aiTestSuccess && (
            <div className="text-[10px] bg-emerald-50 border border-emerald-150 text-emerald-800 px-3 py-2 rounded-xl flex items-start space-x-1.5 animate-in fade-in duration-150">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{aiTestSuccess} connection verified successfully. Ready to save!</span>
            </div>
          )}

          {aiTestError && (
            <div className="text-[10px] bg-rose-50 border border-rose-150 text-rose-800 px-3 py-2 rounded-xl flex items-start space-x-1.5 animate-in fade-in duration-150">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <span className="font-bold">Verification failed:</span> {aiTestError}
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1 border-t border-zinc-100">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleTestAIConnection}
                disabled={aiTestStatus === 'testing' || !aiKey.trim()}
                className={`px-3.5 py-1.5 border rounded-xl text-[11px] font-semibold transition-all flex items-center space-x-1.5 cursor-pointer ${
                  !aiKey.trim()
                    ? 'bg-zinc-50 text-zinc-400 border-zinc-200 cursor-not-allowed'
                    : 'bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-700'
                }`}
              >
                {aiTestStatus === 'testing' ? (
                  <>
                    <div className="w-3 h-3 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                    <span>Verifying key...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Test Connection</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSaveAIKey}
                disabled={aiTestStatus !== 'connected'}
                className={`px-4 py-1.5 rounded-xl text-[11px] font-bold text-white transition-all flex items-center space-x-1 cursor-pointer ${
                  aiTestStatus !== 'connected'
                    ? 'bg-zinc-300 border border-zinc-200 text-zinc-500 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-sm'
                }`}
                title={aiTestStatus !== 'connected' ? 'Please click Test Connection and pass before saving.' : 'Save key'}
              >
                <span>Save Provider Key</span>
              </button>

              {isAiSaved && (
                <span className="text-[10px] font-semibold text-emerald-600 animate-pulse flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Key updated!
                </span>
              )}
            </div>

            {aiStatus === 'connected' && (
              <button
                type="button"
                onClick={handleRemoveAIKey}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-[11px] font-bold transition-colors cursor-pointer border border-rose-100"
              >
                Disconnect Provider
              </button>
            )}
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
                      onClick={() => changeProvider(p)}
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
                    onChange={(e) => changeProvider(e.target.value)}
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
                  onChange={(e) => changeKey(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-zinc-850 font-mono"
                />
              </div>

              {/* Model selection dropdown if it is an AI provider */}
              {(newProvider.toLowerCase().includes('gemini') || 
                newProvider.toLowerCase().includes('google') || 
                newProvider.toLowerCase().includes('openai') || 
                newProvider.toLowerCase().includes('anthropic') || 
                newProvider.toLowerCase().includes('deepseek')) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-50 border border-zinc-150 p-3 rounded-xl">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1">AI Model Name *</label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-zinc-800 cursor-pointer font-medium"
                    >
                      {(newProvider.toLowerCase().includes('gemini') || newProvider.toLowerCase().includes('google')) ? (
                        <>
                          <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended)</option>
                          <option value="gemini-3.5-flash">gemini-3.5-flash (Standard)</option>
                          <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                          <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                        </>
                      ) : newProvider.toLowerCase().includes('openai') ? (
                        <>
                          <option value="gpt-4o-mini">gpt-4o-mini (Recommended)</option>
                          <option value="gpt-4o">gpt-4o</option>
                          <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                        </>
                      ) : newProvider.toLowerCase().includes('anthropic') ? (
                        <>
                          <option value="claude-3-5-haiku-20241022">claude-3-5-haiku</option>
                          <option value="claude-3-5-sonnet-20241022">claude-3-5-sonnet</option>
                        </>
                      ) : (
                        <>
                          <option value="deepseek-chat">deepseek-chat</option>
                          <option value="deepseek-reasoner">deepseek-reasoner</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testStatus === 'testing'}
                      className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                        testStatus === 'connected'
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : testStatus === 'invalid'
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'
                      }`}
                    >
                      {testStatus === 'testing' ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" />
                          <span>Testing Key...</span>
                        </>
                      ) : testStatus === 'connected' ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Connection Passed</span>
                        </>
                      ) : testStatus === 'invalid' ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>Connection Failed (Retry)</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Test API Key Connection</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {testSuccess && (
                <div className="text-[10px] bg-emerald-50 border border-emerald-150 text-emerald-800 px-3 py-2 rounded-xl flex items-start space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{testSuccess} Your key is verified and ready to be registered.</span>
                </div>
              )}

              {testError && (
                <div className="text-[10px] bg-rose-50 border border-rose-150 text-rose-800 px-3 py-2 rounded-xl flex items-start space-x-1.5 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">
                    <span className="font-bold">Connection test failed:</span> {testError}
                  </div>
                </div>
              )}

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
                  {(() => {
                    const provLower = newProvider.toLowerCase();
                    const isAIProvider = provLower.includes('gemini') || provLower.includes('google') || provLower.includes('openai') || provLower.includes('anthropic') || provLower.includes('deepseek');
                    const isSaveDisabled = isAIProvider && testStatus !== 'connected';
                    return (
                      <button
                        type="button"
                        onClick={handleAddApiKey}
                        disabled={isSaveDisabled}
                        className={`px-4 py-1.5 rounded-xl text-[11px] font-bold text-white transition-colors cursor-pointer flex items-center space-x-1 ${
                          isSaveDisabled
                            ? 'bg-zinc-300 border border-zinc-200 text-zinc-500 cursor-not-allowed'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                        title={isSaveDisabled ? 'Please test the key successfully before registering.' : 'Save key'}
                      >
                        <span>Register Key</span>
                      </button>
                    );
                  })()}
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
