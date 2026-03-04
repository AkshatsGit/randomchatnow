import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Shuffle, Users, ArrowRight, Zap,
    Shield, Globe, Sparkles, User, RefreshCw
} from 'lucide-react';

const Home = () => {
    const { profile, randomizeName, updateProfile } = useAuth();
    const navigate = useNavigate();

    const handleGenderSelect = (g) => {
        updateProfile({ gender: g });
    };

    return (
        <div className="relative min-h-screen overflow-hidden">
            {/* Animated Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse delay-700" />

            <main className="relative container mx-auto px-6 pt-24 pb-32 flex flex-col items-center">

                {/* Hero Section */}
                <div className="text-center space-y-8 mb-20">
                    <div className="inline-flex items-center gap-2 px-6 py-2 bg-gray-900 border border-gray-800 rounded-full text-xs font-bold uppercase tracking-[0.2em] text-purple-400 animate-in fade-in slide-in-from-top-4 duration-1000">
                        <Zap className="w-3 h-3 fill-current" /> Instant Connection Engine
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        Random <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 underline decoration-purple-500/30">Chat Now.</span>
                    </h1>

                    <p className="text-gray-500 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed animate-in fade-in duration-1000 delay-300">
                        No logins. No BS. Just pure conversations with people across the globe.
                        Your identity is protected by the void.
                    </p>
                </div>

                {/* Identity Preview Card */}
                <div className="w-full max-w-4xl bg-gray-900/50 backdrop-blur-3xl border border-gray-800/50 rounded-[3rem] p-10 mb-16 shadow-2xl relative overflow-hidden group hover:border-purple-500/30 transition-all duration-500 animate-in zoom-in-95 duration-700 delay-500">
                    <div className="flex flex-col md:flex-row items-center gap-12 relative z-10">
                        <div className="relative shrink-0">
                            <div className="absolute inset-0 bg-purple-500 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
                            <img
                                src={profile?.photoURL}
                                className="w-32 h-32 rounded-[2.5rem] border-4 border-gray-800 bg-gray-950 relative z-10 shadow-2xl"
                                alt="avatar"
                            />
                            <button
                                onClick={randomizeName}
                                className="absolute -bottom-2 -right-2 p-3 bg-purple-600 rounded-2xl text-white shadow-xl hover:scale-110 active:rotate-180 transition-all z-20"
                            >
                                <RefreshCw className="w-5 h-5 font-bold" />
                            </button>
                        </div>

                        <div className="flex-1 space-y-6 text-center md:text-left w-full">
                            <div className="space-y-1">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                                    <Sparkles className="w-4 h-4 text-purple-400" /> Your Current Pulse
                                </h3>
                                <div className="text-3xl font-black">{profile?.displayName}</div>
                                <div className="text-xs font-mono text-purple-500/60 uppercase">Anonymous ID: {profile?.customId}</div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 p-1 bg-gray-950 rounded-2xl border border-gray-800 shadow-inner">
                                {['male', 'female', 'non-binary'].map((g) => (
                                    <button
                                        key={g}
                                        onClick={() => handleGenderSelect(g)}
                                        className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${profile?.gender === g ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl mb-24 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-700">
                    <button
                        onClick={() => navigate('/chat')}
                        className="group relative overflow-hidden p-10 bg-gray-900/40 border border-gray-800 rounded-[3rem] text-left hover:border-purple-500/50 hover:bg-gray-800/40 transition-all duration-300"
                    >
                        <div className="flex flex-col gap-6 relative z-10">
                            <div className="p-4 bg-purple-500/10 text-purple-500 rounded-3xl w-fit group-hover:bg-purple-600 group-hover:text-white transition-all duration-500">
                                <Shuffle className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
                                    Flash 1v1 <ArrowRight className="w-6 h-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
                                </h2>
                                <p className="text-gray-500 font-medium">Match with a random stranger. Zero logs. Infinite possibilities.</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/groups')}
                        className="group relative overflow-hidden p-10 bg-gray-900/40 border border-gray-800 rounded-[3rem] text-left hover:border-blue-500/50 hover:bg-gray-800/40 transition-all duration-300"
                    >
                        <div className="flex flex-col gap-6 relative z-10">
                            <div className="p-4 bg-blue-500/10 text-blue-500 rounded-3xl w-fit group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                                <Users className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black mb-2 flex items-center gap-3">
                                    Global Hubs <ArrowRight className="w-6 h-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all" />
                                </h2>
                                <p className="text-gray-500 font-medium">Topic-based group sessions. Find your tribe in the chaos.</p>
                            </div>
                        </div>
                    </button>
                </div>

                {/* Trust Badges */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-12 opacity-40 hover:opacity-100 transition-opacity duration-500 border-t border-gray-800 pt-16 w-full max-w-4xl text-center">
                    <div className="flex flex-col items-center gap-4 group">
                        <Shield className="w-6 h-6 group-hover:text-purple-400 transition-colors" />
                        <span className="text-[10px] uppercase font-bold tracking-[0.3em]">Encrypted Pulse</span>
                    </div>
                    <div className="flex flex-col items-center gap-4 group">
                        <Globe className="w-6 h-6 group-hover:text-blue-400 transition-colors" />
                        <span className="text-[10px] uppercase font-bold tracking-[0.3em]">Global Grid</span>
                    </div>
                    <div className="flex flex-col items-center gap-4 group hidden md:flex">
                        <Users className="w-6 h-6 group-hover:text-amber-400 transition-colors" />
                        <span className="text-[10px] uppercase font-bold tracking-[0.3em]">Zero Log Auth</span>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Home;
