/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Organization {
  id: string;
  name: string;
  createdAt: string;
}

export interface User {
  id: string;
  orgId: string;
  role: 'owner' | 'agent' | 'viewer';
  email: string;
  name: string;
  avatarUrl?: string;
  status: 'online' | 'offline' | 'busy';
  passwordHash?: string;
  passwordSalt?: string;
}

export interface Customer {
  id: string;
  orgId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  companyName?: string;
  createdAt: string;
  phone?: string;
  notes?: string;
  location?: string;
  browserInfo?: string;
  isOnline?: boolean;
}

export interface Conversation {
  id: string;
  orgId: string;
  customerId: string;
  assignedAgentId: string | null;
  status: 'open' | 'pending' | 'closed';
  channel: 'widget' | 'api';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  createdAt: string;
  lastMessageAt: string;
  slaBreachTime?: string; // ISO string for when SLA is breached
  csatScore?: number; // 1-5 rating
  summary?: string; // AI generated summary
  problemDescription?: string; // Detailed problem the user is facing
  resolutionNotes?: string; // Resolution notes documented by agent
  isCustomerOnline?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderType: 'customer' | 'agent' | 'system' | 'ai';
  senderId: string; // userId, customerId, or system/ai
  senderName: string;
  senderAvatarUrl?: string;
  content: string;
  attachments?: { name: string; url: string; size: string }[];
  readAt: string | null;
  createdAt: string;
}

export interface KBArticle {
  id: string;
  orgId: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  embedding?: number[];
}

export interface AISuggestionLog {
  id: string;
  conversationId: string;
  suggestedText: string;
  wasUsed: boolean;
  agentEdited: boolean;
  createdAt: string;
}

export interface SLAConfig {
  low: number; // in minutes
  medium: number;
  high: number;
  urgent: number;
}

export interface BusinessHours {
  enabled: boolean;
  start: string; // "09:00"
  end: string; // "17:00"
  timezone: string; // "America/New_York"
}

export interface ProjectApiKey {
  id: string;
  providerName: string;
  apiKey: string;
  description: string;
  status: 'active' | 'inactive';
  createdAt: string;
  model?: string;
  isEncrypted?: boolean;
}

export interface SupportSettings {
  orgId: string;
  slaConfig: SLAConfig;
  businessHours: BusinessHours;
  routingRule: 'round-robin' | 'manual';
  apiKeys?: ProjectApiKey[];
}
