import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Shuffle, MessageSquare, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Home = () => {
    const navigate = useNavigate();
    const { profile, updateProfile } = useAuth();

    const startChat = () => {
        navigate('/chat');
    };

    const startGroupChat = () => {
        navigate('/groups');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white selection:bg-purple-500 selection:text-white flex flex-col items-center justify-center p-6 sm:p-12 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20"></div>

            <main className="max-w-4xl w-full z-10 flex flex-col items-center text-center space-y-12">
                <header className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-xl text-purple-300 font-medium text-sm mb-6 animate-pulse">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                        </span>
                        No sign up required
                    </div>
                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-500 pb-2">
                        RandomChatNow
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                        Instantly connect with people worldwide. Whether you want a deep 1-on-1 conversation or to jump into a lively group chat, we've got you covered.
                    </p>
                </header>

                <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl justify-center items-stretch">
                    {/* 1-on-1 Chat Card */}
                    <div className="group relative w-full md:w-1/2 p-6 md:p-8 bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 hover:border-purple-500/50 rounded-3xl transition-all duration-300 shadow-2xl hover:-translate-y-2 flex flex-col items-center cursor-pointer" onClick={startChat}>
                        <div className="w-16 h-16 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <Shuffle className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">1-on-1 Chat</h2>
                        <p className="text-gray-400 text-sm mb-6 flex-grow">Hop into a real-time random chat with the next available person.</p>
                        <button className="w-full py-3 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center justify-center gap-2 transition-colors">
                            Start Chat <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Group Chat Card */}
                    <div className="group relative w-full md:w-1/2 p-6 md:p-8 bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 hover:border-blue-500/50 rounded-3xl transition-all duration-300 shadow-2xl hover:-translate-y-2 flex flex-col items-center cursor-pointer" onClick={startGroupChat}>
                        <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300">
                            <Users className="w-8 h-8 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">Group Rooms</h2>
                        <p className="text-gray-400 text-sm mb-6 flex-grow">Join random rooms with up to 40 members and socialize.</p>
                        <button className="w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center justify-center gap-2 transition-colors">
                            Join Groups <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Profile Section */}
                <div className="mt-12 p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md max-w-sm w-full">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-xl font-bold border-2 border-gray-500">
                            {profile?.displayName?.charAt(0) || '?'}
                        </div>
                        <div className="text-left">
                            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Your Identity</p>
                            <p className="font-bold text-lg">{profile?.displayName || 'Loading...'}</p>
                            <p className="text-xs text-gray-500">ID: {profile?.customId || '.....'}</p>
                        </div>
                    </div>
                    <div className="flex text-sm text-gray-400 mt-4 outline-none w-full bg-black/20 px-4 py-2 rounded-lg border border-white/5 focus-within:border-purple-500 transition-colors cursor-text">
                        <input
                            type="text"
                            className="bg-transparent outline-none w-full placeholder-gray-600"
                            placeholder="Change your display name..."
                            defaultValue={profile?.displayName}
                            onBlur={(e) => {
                                if (e.target.value.trim() && e.target.value !== profile?.displayName) {
                                    updateProfile({ displayName: e.target.value.trim() });
                                }
                            }}
                        />
                    </div>
                </div>
            </main>

            <footer className="absolute bottom-6 text-gray-500 text-sm">
                Built for instant connections. Over 10k+ chats daily.
            </footer>
        </div>
    );
};

export default Home;
