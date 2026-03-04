import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Home, MessageSquare, Users, User, LogOut,
    RefreshCw, Sparkles, LogIn, Venus, Mars, HelpCircle
} from 'lucide-react';

const Navbar = () => {
    const { profile, logout, loginWithGoogle, randomizeName } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Don't show on admin or in active chat? (User wants it globally but usually not in chat)
    const isChatting = location.pathname === '/chat';

    return (
        <nav className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${isChatting ? 'opacity-20 hover:opacity-100 translate-y-12 hover:translate-y-0 scale-90 hover:scale-100' : 'opacity-100'}`}>
            <div className="bg-gray-950/80 backdrop-blur-3xl border border-gray-800/80 p-2 md:p-3 rounded-[2.5rem] shadow-2xl flex items-center gap-2 md:gap-4 shadow-purple-900/20 ring-1 ring-white/5">

                {/* Profile Peek */}
                <div className="flex items-center gap-3 pr-4 border-r border-gray-800 ml-2 py-1">
                    <div className="relative">
                        <img
                            src={profile?.photoURL}
                            className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gray-900 border border-gray-800 shadow-inner group-hover:scale-110 transition-transform"
                            alt="pfp"
                        />
                        <button
                            onClick={randomizeName}
                            className="absolute -bottom-1 -right-1 p-1.5 bg-purple-600 rounded-lg text-white shadow-lg hover:scale-110 active:rotate-180 transition-all"
                        >
                            <RefreshCw className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="hidden sm:block">
                        <div className="text-xs font-black text-white leading-none mb-1 flex items-center gap-1">
                            {profile?.displayName}
                            {profile?.gender === 'female' ? <Venus className="w-3 h-3 text-pink-500" /> : profile?.gender === 'male' ? <Mars className="w-3 h-3 text-blue-500" /> : null}
                        </div>
                        <div className="text-[9px] font-mono text-gray-500 font-bold tracking-tighter uppercase">UC-{profile?.customId}</div>
                    </div>
                </div>

                {/* Nav Links */}
                <div className="flex items-center gap-1 md:gap-2">
                    <NavButton
                        active={location.pathname === '/'}
                        onClick={() => navigate('/')}
                        icon={Home}
                        label="Home"
                    />
                    <NavButton
                        active={location.pathname === '/chat'}
                        onClick={() => navigate('/chat')}
                        icon={MessageSquare}
                        label="1v1"
                    />
                    <NavButton
                        active={location.pathname === '/groups'}
                        onClick={() => navigate('/groups')}
                        icon={Users}
                        label="Hubs"
                    />
                </div>

                {/* Auth Actions */}
                <div className="pl-4 border-l border-gray-800 flex items-center gap-2 mr-2">
                    {profile?.isGoogle ? (
                        <button
                            onClick={logout}
                            className="p-3 md:p-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-inner border border-red-500/20"
                            title="Sign Out"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={loginWithGoogle}
                            className="flex items-center gap-2 px-4 py-3 md:px-5 md:py-4 bg-white text-black hover:bg-gray-200 rounded-2xl transition-all shadow-xl font-bold text-xs"
                        >
                            <LogIn className="w-4 h-4" />
                            <span className="hidden sm:inline">GOOGLE</span>
                        </button>
                    )}
                </div>
            </div>
        </nav>
    );
};

const NavButton = ({ active, onClick, icon: Icon, label }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center gap-1 px-3 py-2 md:px-5 md:py-3 rounded-2xl transition-all group ${active ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/40' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
    >
        <Icon className={`w-5 h-5 md:w-6 md:h-6 ${active ? 'animate-pulse' : 'group-hover:scale-110'}`} />
        <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
);

export default Navbar;
