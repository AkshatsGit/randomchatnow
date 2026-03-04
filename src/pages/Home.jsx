import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Shuffle, Users, ArrowRight, Zap,
    Shield, Globe, Sparkles, RefreshCw,
    UserCircle, TrendingUp, TrendingDown, HelpCircle
} from 'lucide-react';
import { generateAvatar, AVATAR_SEEDS } from '../utils/helpers';

const Home = () => {
    const { profile, randomizeName, updateProfile } = useAuth();
    const navigate = useNavigate();

    const handleGenderSelect = (g) => {
        updateProfile({ gender: g });
    };

    const handleAvatarSelect = (seed) => {
        const url = generateAvatar(seed);
        updateProfile({ photoURL: url });
    };

    return (
        <div className="relative min-h-screen overflow-hidden">
            {/* Animated Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse delay-700" />

            <main className="relative container mx-auto px-6 pt-24 pb-32 flex flex-col items-center">

                {/* Hero Section */}
                <div className="text-center space-y-8 mb-16">
                    <div className="inline-flex items-center gap-2 px-6 py-2 bg-gray-900 border border-gray-800 rounded-full text-xs font-bold uppercase tracking-[0.2em] text-purple-400 animate-in fade-in slide-in-from-top-4 duration-1000">
                        <Zap className="w-3 h-3 fill-current" /> Instant Connection Engine
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none">
                        Random <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400 underline decoration-purple-500/30">Chat Now.</span>
                    </h1>
                </div>

                {/* Identity Card */}
                <div className="w-full max-w-4xl bg-gray-900/60 backdrop-blur-3xl border border-gray-800 rounded-[3rem] p-8 md:p-12 mb-16 shadow-2xl relative overflow-hidden group transition-all duration-500 hover:border-purple-500/30">
                    <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                        {/* Avatar Picker Section */}
                        <div className="shrink-0 space-y-4 flex flex-col items-center">
                            <div className="relative group/avatar">
                                <img
                                    src={profile?.photoURL}
                                    className="w-40 h-40 rounded-[3rem] border-4 border-gray-800 bg-gray-950 shadow-2xl transition-transform group-hover/avatar:scale-105"
                                    alt="avatar"
                                />
                                <button
                                    onClick={randomizeName}
                                    className="absolute -bottom-2 -right-2 p-4 bg-purple-600 rounded-2xl text-white shadow-xl hover:scale-110 active:rotate-180 transition-all z-20"
                                    title="Random Name & Avatar"
                                >
                                    <Shuffle className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Scrollable Avatars */}
                            <div className="w-full max-w-[200px] flex gap-2 overflow-x-auto pb-4 custom-scrollbar-thin">
                                {AVATAR_SEEDS.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => handleAvatarSelect(s)}
                                        className="shrink-0 w-12 h-12 rounded-xl bg-gray-800 border border-gray-700 overflow-hidden hover:border-purple-500 transition-colors"
                                    >
                                        <img src={generateAvatar(s)} alt={s} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 space-y-8 w-full">
                            <div className="text-center md:text-left space-y-2">
                                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                                    <Sparkles className="w-4 h-4 text-purple-400" /> Your Random ID
                                </h3>
                                <div className="text-4xl font-black">{profile?.displayName}</div>
                                <div className="text-xs font-mono text-purple-500/60 uppercase">UC-{profile?.customId}</div>
                            </div>

                            {/* Gender Selectors with Icons */}
                            <div className="space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-center md:text-left pl-1">Identify as</p>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'male', icon: TrendingUp, color: 'bg-blue-600', text: 'Male ♂' },
                                        { id: 'female', icon: TrendingDown, color: 'bg-pink-600', text: 'Female ♀' },
                                        { id: 'non-binary', icon: HelpCircle, color: 'bg-gray-700', text: 'Secret' }
                                    ].map((g) => (
                                        <button
                                            key={g.id}
                                            onClick={() => handleGenderSelect(g.id)}
                                            className={`py-4 px-2 rounded-2xl flex flex-col items-center gap-2 border transition-all ${profile?.gender === g.id ? `${g.color} border-transparent shadow-xl scale-[1.05]` : 'bg-gray-800 border-gray-700 text-gray-500 hover:border-gray-500'}`}
                                        >
                                            <g.icon className={`w-5 h-5 ${profile?.gender === g.id ? 'text-white' : 'text-gray-500'}`} />
                                            <span className={`text-[9px] font-black uppercase tracking-widest ${profile?.gender === g.id ? 'text-white' : ''}`}>{g.text}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Primary Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl mb-24">
                    <button
                        onClick={() => navigate('/chat')}
                        className="group relative overflow-hidden p-10 bg-gray-900/40 border border-gray-800 rounded-[3rem] text-left hover:border-purple-500/50 hover:bg-gray-800/40 transition-all duration-300 shadow-xl"
                    >
                        <div className="flex flex-col gap-6 relative z-10">
                            <div className="p-4 bg-purple-500/10 text-purple-500 rounded-3xl w-fit group-hover:bg-purple-600 group-hover:text-white transition-all duration-500">
                                <Shuffle className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black mb-2 flex items-center gap-3">Instant Pulse <ArrowRight className="w-6 h-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all" /></h2>
                                <p className="text-gray-500 font-medium text-sm leading-relaxed">Match 1v1 instantly. Pure anonymity. Free and Premium options available.</p>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/groups')}
                        className="group relative overflow-hidden p-10 bg-gray-900/40 border border-gray-800 rounded-[3rem] text-left hover:border-blue-500/50 hover:bg-gray-800/40 transition-all duration-300 shadow-xl"
                    >
                        <div className="flex flex-col gap-6 relative z-10">
                            <div className="p-4 bg-blue-500/10 text-blue-500 rounded-3xl w-fit group-hover:bg-blue-600 group-hover:text-white transition-all duration-500">
                                <Users className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black mb-2 flex items-center gap-3">Global Hubs <ArrowRight className="w-6 h-6 opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all" /></h2>
                                <p className="text-gray-500 font-medium text-sm leading-relaxed">Join community threads. Meet everyone at once. No logs, just vibes.</p>
                            </div>
                        </div>
                    </button>
                </div>
            </main>

            <style dangerouslySetInnerHTML={{
                __html: `
                .custom-scrollbar-thin::-webkit-scrollbar { height: 4px; }
                .custom-scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar-thin::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
            `}} />
        </div>
    );
};

export default Home;
