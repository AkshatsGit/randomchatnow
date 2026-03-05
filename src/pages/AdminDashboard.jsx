import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { rtdb, ref, onValue, get } from '../services/firebase';
import {
    Users, MessageSquare, Activity, ShieldCheck,
    ArrowLeft, Search, Globe, MapPin, Flag,
    TrendingUp, Zap, Clock, User
} from 'lucide-react';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    // Stats
    const [stats, setStats] = useState({
        activeSessions: 0,
        chatRooms: 0,
        peakVisitors: 432,
        uptime: '100%'
    });

    const [activeUsers, setActiveUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!isLoggedIn) return;

        // Listen for active users
        const usersRef = ref(rtdb, 'activeUsers');
        const unsubUsers = onValue(usersRef, (snapshot) => {
            if (snapshot.exists()) {
                const users = [];
                snapshot.forEach((child) => {
                    users.push({ id: child.key, ...child.val() });
                });
                setActiveUsers(users);
                setStats(prev => ({ ...prev, activeSessions: users.length }));
            } else {
                setActiveUsers([]);
                setStats(prev => ({ ...prev, activeSessions: 0 }));
            }
        });

        // Listen for rooms
        const roomsRef = ref(rtdb, 'groups');
        const unsubRooms = onValue(roomsRef, (snapshot) => {
            setStats(prev => ({ ...prev, chatRooms: snapshot.exists() ? Object.keys(snapshot.val()).length : 0 }));
        });

        return () => {
            unsubUsers();
            unsubRooms();
        };
    }, [isLoggedIn]);

    const handleLogin = (e) => {
        e.preventDefault();
        if (username.trim().toLowerCase() === 'akshat' && password.trim() === '123') {
            setIsLoggedIn(true);
        } else {
            alert('Invalid Admin Credentials');
        }
    };

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6">
                <div className="w-full max-w-md bg-gray-900 border border-gray-800 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-purple-600/50" />
                    <div className="flex flex-col items-center gap-6 mb-8">
                        <div className="p-4 bg-purple-600/10 rounded-2xl">
                            <ShieldCheck className="w-10 h-10 text-purple-500" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight">Admin Portal</h1>
                    </div>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="text"
                            placeholder="Username"
                            className="w-full bg-black/40 border border-gray-800 px-6 py-4 rounded-2xl outline-none focus:border-purple-500 transition-all font-medium"
                            onChange={e => setUsername(e.target.value)}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            className="w-full bg-black/40 border border-gray-800 px-6 py-4 rounded-2xl outline-none focus:border-purple-500 transition-all font-medium"
                            onChange={e => setPassword(e.target.value)}
                        />
                        <button className="w-full py-5 bg-purple-600 hover:bg-purple-500 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-purple-900/20 active:scale-95">Access Control</button>
                    </form>
                    <button onClick={() => navigate('/')} className="w-full mt-6 text-xs font-bold text-gray-600 hover:text-gray-400 transition-colors uppercase tracking-widest">Return to site</button>
                </div>
            </div>
        );
    }

    const filteredUsers = activeUsers.filter(u => {
        const name = u.name || '';
        const id = u.id || '';
        const search = searchQuery.toLowerCase();
        return name.toLowerCase().includes(search) || id.toLowerCase().includes(search);
    });

    return (
        <div className="min-h-screen bg-[#050505] text-gray-100 p-8 custom-scrollbar">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-500 flex items-center gap-4">
                        <Zap className="w-8 h-8 text-purple-500 fill-current" /> Live Hub Command
                    </h1>
                    <p className="text-gray-600 font-medium">Real-time telemetry from the RandomChatNow network.</p>
                </div>
                <div className="flex gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-purple-500" />
                        <input
                            type="text"
                            placeholder="Search active IDs..."
                            className="bg-gray-900 border border-gray-800 rounded-2xl px-12 py-3 outline-none focus:border-purple-500 transition-all w-64 font-medium"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {[
                    { label: 'Active Sessions', val: stats.activeSessions, icon: Users, color: 'text-blue-500' },
                    { label: 'Chat Rooms', val: stats.chatRooms, icon: Globe, color: 'text-purple-500' },
                    { label: 'Peak Visitors', val: stats.peakVisitors, icon: TrendingUp, color: 'text-yellow-500' },
                    { label: 'Uptime', val: stats.uptime, icon: Activity, color: 'text-green-500' }
                ].map((s, i) => (
                    <div key={i} className="bg-gray-900 border border-gray-800 p-8 rounded-[2.5rem] shadow-xl hover:border-gray-700 transition-all group">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-4 rounded-2xl bg-gray-950 group-hover:scale-110 transition-transform ${s.color}`}>
                                <s.icon className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] uppercase font-black tracking-widest text-gray-600 bg-gray-950 px-2 py-1 rounded-lg">Live</span>
                        </div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{s.label}</h4>
                        <div className="text-3xl font-black">{s.val}</div>
                    </div>
                ))}
            </div>

            {/* User Traffic Grid */}
            <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl mb-12">
                <div className="p-8 border-b border-gray-800 flex items-center justify-between">
                    <h2 className="text-xl font-black flex items-center gap-3"><Users className="text-purple-500" /> Global User Traffic</h2>
                    <span className="text-[10px] font-black uppercase text-purple-400 font-mono tracking-widest">{filteredUsers.length} Nodes Connected</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-950/50 text-gray-500 text-[10px] uppercase font-black tracking-widest">
                                <th className="px-8 py-6">User Identity</th>
                                <th className="px-8 py-6">IP Details</th>
                                <th className="px-8 py-6">Geo Location</th>
                                <th className="px-8 py-6">Carrier / Gender</th>
                                <th className="px-8 py-6">State</th>
                                <th className="px-8 py-6 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {filteredUsers.map((u) => (
                                <tr key={u.id} className="hover:bg-gray-800/30 transition-colors group">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <img src={u.photo} className="w-12 h-12 rounded-xl bg-gray-950 border border-gray-800 group-hover:scale-105 transition-transform" />
                                            <div>
                                                <div className="font-black text-gray-100">{u.name}</div>
                                                <div className="text-[10px] font-mono text-gray-600 uppercase">UC-{u.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="font-mono text-xs font-bold text-purple-400 bg-purple-500/5 px-2 py-1 rounded w-fit">{u.geo?.ip || '0.0.0.0'}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            {u.geo?.flag && <img src={u.geo.flag} className="w-5 h-3.5 rounded-sm object-cover" title={u.geo.country} />}
                                            <div>
                                                <div className="text-xs font-bold">{u.geo?.city || 'Cloud'}</div>
                                                <div className="text-[9px] uppercase font-black text-gray-600 tracking-tighter">{u.geo?.country || 'Earth'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-3">
                                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${u.isGoogle ? 'bg-white text-black border-white' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                                                {u.isGoogle ? 'Google' : 'Anonymous'}
                                            </span>
                                            {u.gender && (
                                                <span className={`p-1.5 rounded-lg border ${u.gender === 'female' ? 'border-pink-500/30 text-pink-500' : u.gender === 'male' ? 'border-blue-500/30 text-blue-500' : 'border-gray-700 text-gray-500'}`}>
                                                    <User className="w-3 h-3" />
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Live</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <button className="p-3 bg-gray-800 hover:bg-red-500/10 text-gray-600 hover:text-red-500 rounded-xl transition-all"><ShieldCheck className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Performance Analytics Placeholder */}
            <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] p-10 h-80 shadow-2xl relative overflow-hidden flex flex-col items-center justify-center text-center gap-4">
                <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                <Activity className="w-16 h-16 text-gray-800 animate-pulse" />
                <h3 className="text-xs font-black uppercase tracking-[0.4em] text-gray-700">Performance Analytics (Last 7 Days)</h3>
                <div className="w-full max-w-2xl flex items-end justify-between gap-2 h-32">
                    {[3, 5, 4, 8, 6, 9, 7].map((h, i) => (
                        <div key={i} className="flex-1 bg-gradient-to-t from-purple-600 to-indigo-600 rounded-t-xl transition-all hover:scale-x-110" style={{ height: `${h * 10}%` }} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
