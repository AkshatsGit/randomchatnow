import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Home, Users, MessageSquare, ShieldCheck,
    RefreshCw, LogOut, User, Ghost, LogIn
} from 'lucide-react';

const Navbar = () => {
    const { profile, randomizeName, logout, loginWithGoogle } = useAuth();
    const location = useLocation();

    const isActive = (path) => location.pathname === path;

    return (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/80 backdrop-blur-xl border border-gray-800 px-6 py-3 rounded-3xl shadow-2xl z-50 flex items-center gap-8 min-w-[320px] justify-between transition-all duration-300 hover:border-purple-500/50">
            <Link to="/" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/') ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}>
                <Home className="w-5 h-5" />
                <span className="text-[10px] font-bold">Home</span>
            </Link>

            <Link to="/chat" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/chat') ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}>
                <Ghost className="w-5 h-5" />
                <span className="text-[10px] font-bold">1v1</span>
            </Link>

            <Link to="/groups" className={`flex flex-col items-center gap-1 transition-colors ${isActive('/groups') ? 'text-purple-400' : 'text-gray-500 hover:text-gray-300'}`}>
                <Users className="w-5 h-5" />
                <span className="text-[10px] font-bold">Groups</span>
            </Link>

            {/* Profile Section in Nav */}
            <div className="flex items-center gap-3 pl-4 border-l border-gray-800">
                {profile && (
                    <div className="flex items-center gap-3 group">
                        <div className="flex flex-col items-end">
                            <span className="text-xs font-bold text-gray-200 line-clamp-1 max-w-[80px]">
                                {profile.displayName}
                            </span>
                            <span className="text-[9px] text-gray-500 font-mono tracking-tighter uppercase">
                                ID: {profile.customId}
                            </span>
                        </div>
                        <div className="relative">
                            <img
                                src={profile.photoURL}
                                alt="avatar"
                                className="w-9 h-9 rounded-xl border border-gray-700 bg-gray-800 shadow-lg group-hover:border-purple-500 transition-colors"
                            />
                            <button
                                onClick={randomizeName}
                                className="absolute -bottom-1 -right-1 p-1 bg-purple-600 rounded-lg text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity transform hover:scale-110 active:rotate-180 duration-300"
                                title="Randomize Username"
                            >
                                <RefreshCw className="w-3 h-3" />
                            </button>
                        </div>
                    </div>
                )}

                {!profile?.isGoogle ? (
                    <button
                        onClick={loginWithGoogle}
                        className="p-2.5 bg-white hover:bg-gray-100 text-black rounded-xl transition-all hover:scale-105 flex items-center gap-2 shadow-lg"
                        title="Login with Google"
                    >
                        <LogIn className="w-4 h-4" />
                        <span className="text-[10px] font-extrabold uppercase hidden md:inline">Google</span>
                    </button>
                ) : (
                    <button
                        onClick={logout}
                        className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all"
                        title="Logout"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
