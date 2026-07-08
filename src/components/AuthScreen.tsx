/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Lock, Mail, User, Building2, Check, X, Loader2, Camera, Upload } from 'lucide-react';

interface AuthScreenProps {
  onAuthSuccess: (token: string, user: any) => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=faces',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&h=150&fit=crop&crop=faces',
];

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [delayRemaining, setDelayRemaining] = useState(0);
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(PRESET_AVATARS[0]);


  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMessage('Profile photo must be smaller than 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setSelectedAvatarUrl(reader.result);
          setErrorMessage('');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Password requirements real-time verification (for signup)
  const passwordCriteria = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    special: /[@$!%*?&]/.test(password),
  };

  const isPasswordValid = Object.values(passwordCriteria).every(Boolean) && password.length <= 128;

  // Countdown timer for delays if backend locks out or throttles
  useEffect(() => {
    if (delayRemaining <= 0) return;
    const timer = setInterval(() => {
      setDelayRemaining(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [delayRemaining]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');


    if (isLogin) {
      // Login flow
      setIsLoading(true);
      setStatusMessage('Authenticating securely...');

      try {
        const startTime = Date.now();
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        setIsLoading(false);
        setStatusMessage('');

        if (res.ok) {
          const data = await res.json();
          setStatusMessage('Security handshake complete...');
          // Optional short timeout for smooth transition
          setTimeout(() => {
            onAuthSuccess(data.token, data.user);
          }, 400);
        } else {
          let errorMsg = 'Incorrect email or password.';
          try {
            const data = await res.json();
            errorMsg = data.error || errorMsg;
          } catch (e) {
            errorMsg = `Server error (${res.status}). Please try again later.`;
          }

          if (res.status === 429) {
            setErrorMessage(errorMsg || 'Too many login attempts. Please try again later.');
          } else if (res.status === 423) {
            setErrorMessage(errorMsg || 'This account is locked. Please try again in 15 minutes.');
          } else {
            setErrorMessage(errorMsg);
          }
        }
      } catch (err) {
        setIsLoading(false);
        setStatusMessage('');
        setErrorMessage('Failed to connect securely to the authentication server.');
      }
    } else {
      // Signup flow
      if (!isPasswordValid) {
        setErrorMessage('Please satisfy all password complexity requirements.');
        return;
      }
      if (!name.trim() || !companyName.trim()) {
        setErrorMessage('All registration fields are required.');
        return;
      }

      setIsLoading(true);
      setStatusMessage('Provisioning secure multi-tenant environment...');

      try {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name, companyName, avatarUrl: selectedAvatarUrl })
        });

        setIsLoading(false);
        setStatusMessage('');

        if (res.ok) {
          const data = await res.json();
          onAuthSuccess(data.token, data.user);
        } else {
          let errorMsg = 'Registration failed. Please check inputs.';
          try {
            const data = await res.json();
            errorMsg = data.error || errorMsg;
          } catch (e) {
            if (res.status === 413) {
              errorMsg = 'Profile photo is too large. Please select a smaller photo or a preset.';
            } else {
              errorMsg = `Server returned an error (${res.status}). Please try again.`;
            }
          }
          setErrorMessage(errorMsg);
        }
      } catch (err) {
        setIsLoading(false);
        setStatusMessage('');
        setErrorMessage('Failed to connect securely to the server during registration.');
      }
    }
  };



  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-zinc-950 px-4 py-12 text-zinc-300 font-sans select-none overflow-y-auto">
      <div className="w-full max-w-md space-y-8 bg-zinc-900/60 border border-zinc-800 p-8 rounded-3xl shadow-2xl relative">
        
        {/* Glow effect */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="text-center relative z-10">
          <div className="mx-auto h-12 w-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-600/20 mb-4">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-white">
            B2B Support Hub
          </h2>
          <p className="mt-2 text-xs text-zinc-500">
            Multi-Tenant Customer Support Copilot System
          </p>
        </div>

        {/* Mode Selector */}
        <div className="grid grid-cols-2 p-1 bg-zinc-950 rounded-2xl border border-zinc-800 relative z-10">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setErrorMessage('');
              setEmail('');
              setPassword('');
              setShowPassword(false);
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${isLogin ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setErrorMessage('');
              setEmail('');
              setPassword('');
              setName('');
              setCompanyName('');
              setShowPassword(false);
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${!isLogin ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Create Workspace
          </button>
        </div>

        {/* Forms */}
        <form onSubmit={handleSubmit} className="space-y-4 mt-6 relative z-10">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-start space-x-2 animate-pulse" id="auth-error">
              <span className="font-bold">⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}



          {!isLogin && (
            <>
              {/* Full Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Your Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-600" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Sarah Connor"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {/* Company / Org Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Workspace / Company Name</label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-600" />
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Stellar B2B"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </>
          )}

          {/* Email */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-600" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sarah@company.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-zinc-600" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-11 pr-11 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Password complexity checklist for Signup */}
          {!isLogin && password.length > 0 && (
            <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-[10px] space-y-1">
              <span className="font-semibold text-zinc-500 block mb-1">PASSWORD REQUIREMENTS:</span>
              <div className="grid grid-cols-2 gap-1 text-zinc-400">
                <div className="flex items-center space-x-1.5">
                  {passwordCriteria.length ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                  <span className={passwordCriteria.length ? 'text-emerald-400' : ''}>Min 8 characters</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  {passwordCriteria.upper ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                  <span className={passwordCriteria.upper ? 'text-emerald-400' : ''}>Uppercase letter</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  {passwordCriteria.lower ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                  <span className={passwordCriteria.lower ? 'text-emerald-400' : ''}>Lowercase letter</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  {passwordCriteria.digit ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                  <span className={passwordCriteria.digit ? 'text-emerald-400' : ''}>Contains number</span>
                </div>
                <div className="flex items-center space-x-1.5 col-span-2">
                  {passwordCriteria.special ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <X className="w-3.5 h-3.5 text-rose-500" />}
                  <span className={passwordCriteria.special ? 'text-emerald-400' : ''}>Special character (@$!%*?&)</span>
                </div>
              </div>
            </div>
          )}

          {/* Choose Profile Photo (Signup Only) */}
          {!isLogin && (
            <div className="p-4 bg-zinc-950/60 border border-zinc-850 rounded-2xl space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
                Profile Photo for Chatting
              </label>
              
              <div className="flex items-center space-x-4">
                {/* Active Photo Avatar Circle */}
                <div className="relative shrink-0">
                  <img
                    src={selectedAvatarUrl}
                    alt="Active Profile Preview"
                    className="w-16 h-16 rounded-full object-cover border-2 border-indigo-500/80 shadow-md bg-zinc-900"
                  />
                  <label 
                    htmlFor="avatar-upload"
                    className="absolute bottom-0 right-0 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full p-1.5 cursor-pointer shadow border border-zinc-900 hover:scale-105 transition-all flex items-center justify-center"
                    title="Upload Custom Image"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="avatar-upload"
                  />
                </div>

                {/* Preset Picker & Custom Upload Button */}
                <div className="flex-1 space-y-1.5">
                  <span className="text-[10px] font-medium text-zinc-400 block">Choose a professional face portrait:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_AVATARS.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedAvatarUrl(url)}
                        className={`relative rounded-full overflow-hidden w-7 h-7 border transition-all hover:scale-110 cursor-pointer ${selectedAvatarUrl === url ? 'border-indigo-500 ring-2 ring-indigo-500/30 scale-105' : 'border-zinc-800 hover:border-zinc-500'}`}
                      >
                        <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                        {selectedAvatarUrl === url && (
                          <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="pt-1">
                    <label 
                      htmlFor="avatar-upload"
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-semibold text-zinc-300 hover:text-white hover:border-zinc-700 cursor-pointer transition-all"
                    >
                      <Upload className="w-3 h-3 text-indigo-400" />
                      <span>Upload Custom Photo</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Dynamic Live Card Profile Preview */}
              <div className="pt-2.5 border-t border-zinc-900">
                <span className="text-[9px] font-bold tracking-widest text-zinc-600 uppercase block mb-2">Live Chat Profile Preview</span>
                <div className="bg-zinc-900/80 border border-zinc-800 p-2.5 rounded-xl flex items-center space-x-3 shadow-inner">
                  <img src={selectedAvatarUrl} alt="Preview" className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/20" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white truncate">{name.trim() || 'Your Full Name'}</p>
                    <p className="text-[9px] text-indigo-400 font-medium truncate flex items-center space-x-1">
                      <span>Owner / Agent</span>
                      <span className="text-zinc-700">•</span>
                      <span className="text-zinc-500 truncate">{companyName.trim() || 'Your Company Workspace'}</span>
                    </p>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/25 shrink-0 animate-pulse" title="Ready to chat" />
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || (!isLogin && !isPasswordValid)}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl text-xs transition-colors shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:shadow-none flex items-center justify-center space-x-2 cursor-pointer mt-6"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>{statusMessage || 'Processing security protocols...'}</span>
              </>
            ) : (
              <span>{isLogin ? 'Sign In Securely' : 'Create Secure Tenant Account'}</span>
            )}
          </button>
        </form>



      </div>
    </div>
  );
}
