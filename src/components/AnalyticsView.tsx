/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BarChart2, Users, Star, Clock, Sparkles, AlertCircle, 
  CheckCircle, ChevronRight, TrendingUp, HelpCircle, Info 
} from 'lucide-react';

interface AnalyticsData {
  totalTickets: number;
  openTickets: number;
  pendingTickets: number;
  closedTickets: number;
  averageCsat: number;
  slaBreached: number;
  helpfulPercentage: number;
  ticketVolumeTrends: { name: string; tickets: number }[];
}

interface AnalyticsViewProps {
  orgId: string;
  token: string;
}

export default function AnalyticsView({ orgId, token }: AnalyticsViewProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [orgId, token]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/analytics?orgId=${orgId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const stats = await res.json();
        setData(stats);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-xs text-zinc-500">Compiling support statistics...</p>
        </div>
      </div>
    );
  }

  // Calculate percentages for bars
  const total = data.totalTickets || 1;
  const openPct = Math.round((data.openTickets / total) * 100);
  const pendingPct = Math.round((data.pendingTickets / total) * 100);
  const closedPct = Math.round((data.closedTickets / total) * 100);

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm font-bold text-zinc-900 font-display tracking-wide uppercase">Operational Dashboard</h2>
          <p className="text-xs text-zinc-500 mt-1">Real-time support operations, response times, and AI copilot accuracy.</p>
        </div>
        <button
          onClick={fetchAnalytics}
          className="text-xs bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl px-3 py-1.5 font-medium shadow-sm transition-colors"
        >
          Refresh Logs
        </button>
      </div>

      {/* Grid of KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* KPI: SLA Breached */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">SLA Warnings</span>
            <span className="text-xl font-bold font-display text-zinc-950 mt-1 block">{data.slaBreached}</span>
            <span className="text-[10px] text-zinc-500 mt-1 block">Active breach status</span>
          </div>
          <div className={`p-2.5 rounded-xl ${data.slaBreached > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* KPI: CSAT Rating */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">Customer CSAT</span>
            <span className="text-xl font-bold font-display text-zinc-950 mt-1 block">{data.averageCsat} / 5.0</span>
            <span className="text-[10px] text-emerald-600 mt-1 font-semibold flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> High rating
            </span>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl">
            <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
          </div>
        </div>

        {/* KPI: AI Copilot Helpfulness */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">AI Helpfulness</span>
            <span className="text-xl font-bold font-display text-zinc-950 mt-1 block">{data.helpfulPercentage}%</span>
            <span className="text-[10px] text-zinc-500 mt-1 block">Accepted/edited drafts</span>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-500 rounded-xl">
            <Sparkles className="w-5 h-5 fill-indigo-100 text-indigo-500" />
          </div>
        </div>

        {/* KPI: Open Tickets */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex items-start justify-between">
          <div>
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">Active Queue</span>
            <span className="text-xl font-bold font-display text-zinc-950 mt-1 block">{data.openTickets}</span>
            <span className="text-[10px] text-zinc-500 mt-1 block">Awaiting reply</span>
          </div>
          <div className="p-2.5 bg-zinc-100 text-zinc-700 rounded-xl">
            <BarChart2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Graphs & Visualizations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket Volume Custom SVG Chart */}
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 font-display">Weekly Ingress Distribution</h3>
            <p className="text-[10px] text-zinc-500">Ticket intake trend for the current billing cycle</p>
          </div>

          {/* SVG Line Graph */}
          <div className="h-44 mt-6 relative">
            <svg className="w-full h-full" viewBox="0 0 500 150">
              {/* Grid lines */}
              <line x1="0" y1="20" x2="500" y2="20" stroke="#f4f4f5" strokeWidth="1" />
              <line x1="0" y1="75" x2="500" y2="75" stroke="#f4f4f5" strokeWidth="1" />
              <line x1="0" y1="130" x2="500" y2="130" stroke="#f4f4f5" strokeWidth="1" />

              {/* Data curve */}
              <path
                d="M 20 130 C 80 80, 120 40, 160 70 C 220 110, 260 30, 320 20 C 380 15, 420 90, 480 50"
                fill="none"
                stroke="url(#chartGradient)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Shading below curve */}
              <path
                d="M 20 130 C 80 80, 120 40, 160 70 C 220 110, 260 30, 320 20 C 380 15, 420 90, 480 50 L 480 140 L 20 140 Z"
                fill="url(#areaGradient)"
              />

              {/* Gradients */}
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4f46e5" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#818cf8" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Interactive nodes */}
              <circle cx="160" cy="70" r="5" fill="#4f46e5" stroke="white" strokeWidth="1.5" />
              <circle cx="320" cy="20" r="5" fill="#4f46e5" stroke="white" strokeWidth="1.5" />
              <circle cx="480" cy="50" r="5" fill="#6366f1" stroke="white" strokeWidth="1.5" />
            </svg>

            {/* Labels overlay */}
            <div className="absolute bottom-0 w-full flex justify-between text-[10px] text-zinc-400 px-2 select-none">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>
        </div>

        {/* Ticket queue breakdown bars */}
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold text-zinc-900 font-display">Service Queue Status</h3>
            <p className="text-[10px] text-zinc-500">Breakdown of support loads across departments</p>
          </div>

          <div className="space-y-4 mt-6">
            {/* Open bar */}
            <div>
              <div className="flex justify-between text-[11px] mb-1 font-medium">
                <span className="text-zinc-600 flex items-center">
                  <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full mr-2" />
                  Open Queue
                </span>
                <span className="text-zinc-900 font-semibold">{data.openTickets} ({openPct}%)</span>
              </div>
              <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${openPct}%` }} />
              </div>
            </div>

            {/* Pending bar */}
            <div>
              <div className="flex justify-between text-[11px] mb-1 font-medium">
                <span className="text-zinc-600 flex items-center">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full mr-2" />
                  Pending Partner Action
                </span>
                <span className="text-zinc-900 font-semibold">{data.pendingTickets} ({pendingPct}%)</span>
              </div>
              <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full transition-all" style={{ width: `${pendingPct}%` }} />
              </div>
            </div>

            {/* Closed bar */}
            <div>
              <div className="flex justify-between text-[11px] mb-1 font-medium">
                <span className="text-zinc-600 flex items-center">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full mr-2" />
                  Closed & Rated
                </span>
                <span className="text-zinc-900 font-semibold">{data.closedTickets} ({closedPct}%)</span>
              </div>
              <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-50 h-full rounded-full transition-all" style={{ width: `${closedPct}%` }} />
              </div>
            </div>
          </div>

          <div className="text-[10px] text-zinc-400 bg-zinc-50 rounded-xl p-2.5 mt-4 border border-zinc-100 flex items-start space-x-2">
            <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">All metrics are evaluated in real-time. Closing active tickets updates the CSAT score.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
