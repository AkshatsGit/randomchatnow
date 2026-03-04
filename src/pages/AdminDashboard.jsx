import React, { useState, useEffect } from 'react';
import { rtdb, ref, onValue, get } from '../services/firebase';
import {
    Users, Activity, Globe, Shield, LogOut,
    ArrowUpRight, BarChart3, Database, Search
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loginData, setLoginData] = useState({ username: '', password: '' });
    const [activeUsers, setActiveUsers] = useState({});
    const [stats, setStats] = useState({ totalVisits: 0, currentRooms: 0 });
    const navigate = useNavigate();

    useEffect(() => {
        if (!isAuthenticated) return;

        const usersRef = ref(rtdb, 'activeUsers');
        const roomsRef = ref(rtdb, 'groups');

        const unsubUsers = onValue(usersRef, (snapshot) => {
            setActiveUsers(snapshot.val() || {});
        });

        const unsubRooms = onValue(roomsRef, (snapshot) => {
            const rooms = snapshot.val() || {};
            setStats(prev => ({ ...prev, currentRooms: Object.keys(rooms).length }));
        });

        return () => {
            unsubUsers();
            unsubRooms();
        };
    }, [isAuthenticated]);

    const handleLogin = (e) => {
        e.preventDefault();
        if (loginData.username === 'akshat' && loginData.password === '123') {
            setIsAuthenticated(true);
        } else {
            alert("Invalid Admin Credentials");
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#050505]">
                <form onSubmit={handleLogin} className="bg-gray-900/50 p-8 rounded-3xl border border-gray-800 shadow-2xl w-full max-w-md space-y-6">
                    <div className="flex flex-col items-center gap-3">
                        <div className="p-4 bg-purple-500/10 rounded-2xl text-purple-500">
                            <Shield className="w-8 h-8" />
                        </div>
                        <h1 className="text-2xl font-bold">Admin Portal</h1>
                    </div>

                    <div className="space-y-4">
                        <input
                            type="text"
                            placeholder="Username"
                            className="w-full bg-gray-950 border border-gray-800 p-4 rounded-xl outline-none focus:border-purple-500"
                            onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            className="w-full bg-gray-950 border border-gray-800 p-4 rounded-xl outline-none focus:border-purple-500"
                            onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        />
                    </div>
                    <button className="w-full bg-purple-600 hover:bg-purple-500 py-4 rounded-xl font-bold transition-all">
                        Access Control
                    </button>
                    <button type="button" onClick={() => navigate('/')} className="w-full text-gray-500 text-sm hover:underline">Return to site</button>
                </form>
            </div>
        );
    }

    const usersList = Object.values(activeUsers);

    return (
        <div className="min-h-screen bg-[#050505] p-6 lg:p-10 space-y-10 pb-32">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3">
                        <span className="p-2 bg-red-500/10 text-red-500 rounded-lg">
                            <Activity className="w-6 h-6 animate-pulse" />
                        </span>
                        Live Command Center
                    </h1>
                    <p className="text-gray-500 text-sm">Monitoring Akshat's Global Chat Network</p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-gray-900/50 px-6 py-3 rounded-2xl border border-gray-800 flex items-center gap-4">
                        <Database className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-bold text-gray-300">Firebase Live</span>
                    </div>
                    <button onClick={() => setIsAuthenticated(false)} className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Active Sessions', val: usersList.length, icon: Users, color: 'text-blue-400' },
                    { label: 'Chat Rooms', val: stats.currentRooms, icon: Globe, color: 'text-green-400' },
                    { label: 'Peak Visitors', val: '432', icon: BarChart3, color: 'text-yellow-400' },
                    { label: 'Uptime', val: '100%', icon: Shield, color: 'text-purple-400' }
                ].map((s, idx) => (
                    <div key={idx} className="bg-gray-900/40 p-6 rounded-3xl border border-gray-800 hover:border-gray-700 transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 bg-gray-900 rounded-2xl ${s.color}`}>
                                <s.icon className="w-5 h-5" />
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-gray-600 group-hover:text-gray-200 transition-colors" />
                        </div>
                        <p className="text-gray-500 text-sm font-medium">{s.label}</p>
                        <h3 className="text-2xl font-bold text-gray-100">{s.val}</h3>
                    </div>
                ))}
            </div>

            {/* Active Users Table */}
            <div className="bg-gray-900/30 rounded-3xl border border-gray-800 overflow-hidden">
                <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <Users className="w-5 h-5 text-gray-500" /> User Traffic
                    </h2>
                    <div className="relative">
                        <Search className="w-4 h-4 text-gray-600 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search active IDs..."
                            className="bg-gray-950 border border-gray-800 pl-10 pr-4 py-2 rounded-xl text-sm outline-none focus:border-purple-500"
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-xs text-gray-500 uppercase tracking-widest border-b border-gray-800">
                                <th className="p-6 font-bold">User Identity</th>
                                <th className="p-6 font-bold">IP Address</th>
                                <th className="p-6 font-bold">Carrier/Method</th>
                                <th className="p-6 font-bold">State</th>
                                <th className="p-6 font-bold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800/50">
                            {usersList.map((usr) => (
                                <tr key={usr.id} className="hover:bg-gray-800/20 transition-colors group">
                                    <td className="p-6">
                                        <div className="flex items-center gap-4">
                                            <img src={usr.photo} className="w-10 h-10 rounded-xl bg-gray-800" />
                                            <div>
                                                <div className="font-bold text-gray-100">{usr.name}</div>
                                                <div className="text-xs text-gray-500 font-mono tracking-tighter uppercase">{usr.id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6 font-mono text-sm text-gray-400">{usr.ip}</td>
                                    <td className="p-6">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${usr.isGoogle ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'}`}>
                                            {usr.isGoogle ? 'Google' : 'Anonymous'}
                                        </span>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-2 text-green-500 text-xs font-bold">
                                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            Live
                                        </div>
                                    </td>
                                    <td className="p-6 text-right">
                                        <button className="p-2 text-gray-500 hover:text-red-500 transition-colors">
                                            <Shield className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {usersList.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-20 text-center text-gray-500 font-medium italic">
                                        The grid is empty. Waiting for users to connect...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Analytics Graph Visualization Dummy */}
            <div className="h-48 bg-gray-900/20 rounded-3xl border border-gray-800 p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between text-sm text-gray-500 font-bold uppercase tracking-widest">
                    <span>Performance Analytics</span>
                    <span>Last 7 Days</span>
                </div>
                <div className="flex items-end gap-2 h-20">
                    {[3, 5, 8, 4, 7, 9, 6, 3, 5, 8, 4, 7, 9, 6, 4, 6, 8, 9, 5].map((h, i) => (
                        <div key={i} className="flex-1 bg-purple-500/20 rounded-t-sm relative group">
                            <div style={{ height: `${h * 10}%` }} className="bg-purple-500/40 group-hover:bg-purple-500 transition-all rounded-t-sm" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
