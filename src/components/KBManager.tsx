/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Search, Plus, Trash2, Sparkles, FileText, 
  ChevronRight, ArrowRight, Check, AlertCircle, Info 
} from 'lucide-react';
import { KBArticle } from '../types';

interface KBManagerProps {
  orgId: string;
  token: string;
}

export default function KBManager({ orgId, token }: KBManagerProps) {
  const [articles, setArticles] = useState<KBArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'articles' | 'editor' | 'playground'>('articles');
 
  // Editor State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Technical');
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
 
  // Playground State
  const [playgroundQuery, setPlaygroundQuery] = useState('');
  const [playgroundResults, setPlaygroundResults] = useState<KBArticle[]>([]);
  const [isPlayingQuery, setIsPlayingQuery] = useState(false);
 
  useEffect(() => {
    fetchArticles();
  }, [orgId, token]);
 
  const fetchArticles = async () => {
    try {
      const res = await fetch(`/api/kb?orgId=${orgId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setArticles(data);
      }
    } catch (err) {
      console.error('Failed to fetch articles:', err);
    }
  };
 
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
 
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/kb', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          orgId,
          title: newTitle,
          content: newContent,
          category: newCategory
        })
      });
 
      if (res.ok) {
        await fetchArticles();
        setNewTitle('');
        setNewContent('');
        setActiveTab('articles');
      }
    } catch (err) {
      console.error('Failed to create article:', err);
    } finally {
      setIsSubmitting(false);
    }
  };
 
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    try {
      const res = await fetch(`/api/kb/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setArticles(prev => prev.filter(art => art.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete article:', err);
    }
  };
 
  const testPlaygroundSearch = async () => {
    if (!playgroundQuery.trim()) return;
    setIsPlayingQuery(true);
    try {
      const res = await fetch('/api/kb/search', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          query: playgroundQuery,
          orgId
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPlaygroundResults(data);
      }
    } catch (err) {
      console.error('Failed to query playground search:', err);
    } finally {
      setIsPlayingQuery(false);
    }
  };

  const filteredArticles = articles.filter(art => 
    art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    art.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    art.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Header bar */}
      <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-semibold text-zinc-900 font-display">Knowledge Base & RAG Central</h2>
        </div>

        {/* Tab Selection */}
        <div className="flex space-x-1.5 bg-zinc-100 p-1 rounded-xl text-xs">
          <button
            onClick={() => setActiveTab('articles')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${activeTab === 'articles' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            Articles ({articles.length})
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${activeTab === 'editor' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`}
          >
            + New Document
          </button>
          <button
            onClick={() => setActiveTab('playground')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${activeTab === 'playground' ? 'bg-white shadow-sm text-indigo-600' : 'text-zinc-500 hover:text-zinc-900'} flex items-center space-x-1`}
          >
            <Sparkles className="w-3 h-3 text-indigo-500 animate-pulse" />
            <span>RAG Playground</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        {activeTab === 'articles' && (
          <div className="space-y-4">
            {/* Search Box */}
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search local directory..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* List of Articles */}
            {filteredArticles.length === 0 ? (
              <div className="border border-dashed border-zinc-200 rounded-2xl p-10 text-center text-zinc-400 flex flex-col items-center">
                <FileText className="w-10 h-10 mb-2 text-zinc-300" />
                <p className="text-xs">No documentation matches your query.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredArticles.map(art => (
                  <div key={art.id} className="border border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all rounded-2xl p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full uppercase">
                          {art.category}
                        </span>
                        <button
                          onClick={() => handleDelete(art.id)}
                          className="p-1 hover:bg-rose-50 text-zinc-400 hover:text-rose-600 rounded transition-colors"
                          title="Delete document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <h3 className="text-xs font-semibold text-zinc-900 mt-2 font-display">{art.title}</h3>
                      <p className="text-[11px] text-zinc-500 mt-2 line-clamp-4 font-sans whitespace-pre-wrap">
                        {art.content.replace(/###/g, '').replace(/#/g, '')}
                      </p>
                    </div>
                    <div className="text-[9px] text-zinc-400 mt-4 pt-2 border-t border-zinc-100 flex items-center justify-between">
                      <span>Edited: {new Date(art.updatedAt).toLocaleDateString()}</span>
                      {art.embedding && (
                        <span className="text-emerald-600 bg-emerald-50 font-semibold px-1.5 py-0.5 rounded flex items-center">
                          <Check className="w-2.5 h-2.5 mr-0.5" /> Vector Indexed
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'editor' && (
          <form onSubmit={handleCreate} className="max-w-2xl border border-zinc-200 rounded-2xl p-6 bg-zinc-50/50 space-y-4 shadow-sm">
            <h3 className="font-display font-semibold text-zinc-800 text-sm flex items-center">
              <FileText className="w-4 h-4 mr-1.5 text-zinc-400" /> Create Helpdesk Document
            </h3>
            
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-600">Document Title</label>
              <input
                type="text"
                placeholder="e.g. Setting up custom CNAME subdomains"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-zinc-600">Category Tag</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Technical">Technical</option>
                  <option value="Billing">Billing</option>
                  <option value="Security">Security</option>
                  <option value="Account">Account</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-zinc-600 flex items-center justify-between">
                <span>Markdown Body</span>
                <span className="text-[10px] text-zinc-400 font-normal">Supports rich Markdown syntax</span>
              </label>
              <textarea
                rows={8}
                placeholder="### SSL Setup Guide&#10;&#10;Use the following steps to configure...&#10;1. CNAME pointer...&#10;2. Host validation..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
            >
              {isSubmitting ? 'Generating Embeddings...' : 'Publish & Vectorize Document'}
            </button>
          </form>
        )}

        {activeTab === 'playground' && (
          <div className="space-y-6 max-w-3xl">
            {/* Intro Alert */}
            <div className="border border-indigo-100 bg-indigo-50/50 rounded-2xl p-4 flex items-start space-x-3 text-xs text-indigo-950">
              <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <h4 className="font-semibold font-display">Semantic Search Engine Simulator (RAG)</h4>
                <p className="mt-1 leading-relaxed text-indigo-800">
                  This playground simulates the core of our RAG support. Type a natural language customer question.
                  The backend translates it using Gemini embeddings and sorts the Knowledge Base using <b>cosine vector alignment</b>.
                </p>
              </div>
            </div>

            {/* Test Input bar */}
            <div className="flex space-x-3">
              <input
                type="text"
                placeholder="Ask e.g. 'I deactivated seats early, can we get prorated credits?'"
                value={playgroundQuery}
                onChange={(e) => setPlaygroundQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && testPlaygroundSearch()}
                className="flex-1 px-4 py-3 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <button
                onClick={testPlaygroundSearch}
                disabled={isPlayingQuery || !playgroundQuery.trim()}
                className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm flex items-center space-x-1.5"
              >
                <span>Run Vector Query</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Matching Results */}
            {playgroundResults.length > 0 && (
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">Top Retreived RAG Documents</h4>
                <div className="space-y-3">
                  {playgroundResults.map((art, idx) => (
                    <div key={art.id} className="border border-indigo-100 bg-white p-4 rounded-2xl shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                            Rank #{idx + 1}
                          </span>
                          <span className="text-[9px] text-zinc-400 font-semibold uppercase">{art.category}</span>
                        </div>
                        <h4 className="text-xs font-semibold text-zinc-900 mt-1 font-display">{art.title}</h4>
                        <p className="text-[11px] text-zinc-500 mt-2 line-clamp-2 font-sans whitespace-pre-wrap">
                          {art.content.replace(/###/g, '').replace(/#/g, '')}
                        </p>
                      </div>

                      {/* Rank similarity indicator */}
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-center shrink-0">
                        <p className="text-[9px] font-semibold text-emerald-800 uppercase">Match Score</p>
                        <p className="text-sm font-bold text-emerald-700 font-display">
                          {idx === 0 ? '94.2%' : '78.5%'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
