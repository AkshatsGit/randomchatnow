import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rtdb, ref, push, set, onValue, update, remove, onDisconnect } from '../services/firebase';
import { Users, Send, MapPin, Hash, Shield, UsersRound, X, LogOut } from 'lucide-react';

const GroupChat = () => {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null); // The room object we are currently in
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [newRoomName, setNewRoomName] = useState('');
    const [membersCount, setMembersCount] = useState(0);

    const messagesEndRef = useRef(null);

    useEffect(() => {
        // Load all active rooms
        const roomsRef = ref(rtdb, 'groups');
        const unsub = onValue(roomsRef, (snapshot) => {
            if (snapshot.exists()) {
                const roomsData = [];
                snapshot.forEach((child) => {
                    const room = child.val();
                    const members = room.members ? Object.keys(room.members).length : 0;
                    roomsData.push({ id: child.key, ...room, count: members });
                });
                setRooms(roomsData);
            } else {
                setRooms([]);
            }
        });

        return () => unsub();
    }, []);

    useEffect(() => {
        if (!currentRoom) return;
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, currentRoom]);

    const createRoom = (e) => {
        e.preventDefault();
        if (!newRoomName.trim() || !profile) return;

        const roomsRef = ref(rtdb, 'groups');
        const newRoomRef = push(roomsRef);

        set(newRoomRef, {
            name: newRoomName,
            createdBy: profile.customId,
            createdAt: Date.now(),
            maxMembers: 40
        }).then(() => {
            setNewRoomName('');
            joinRoom(newRoomRef.key, newRoomName);
        });
    };

    const joinRoom = (roomId, roomName) => {
        if (!profile) return;

        const targetRoom = rooms.find(r => r.id === roomId);
        if (targetRoom && targetRoom.count >= 40) {
            alert('Room is full (Max 40 members).');
            return;
        }

        const roomMemberRef = ref(rtdb, `groups/${roomId}/members/${profile.customId}`);

        // Setup disconnect hook
        onDisconnect(roomMemberRef).remove();

        // Add self to room
        set(roomMemberRef, {
            name: profile.displayName,
            joinedAt: Date.now()
        });

        setCurrentRoom({ id: roomId, name: roomName });

        // Listen to messages
        const msgsRef = ref(rtdb, `groups/${roomId}/messages`);
        onValue(msgsRef, (snapshot) => {
            if (snapshot.exists()) {
                const msgs = [];
                snapshot.forEach((child) => {
                    msgs.push({ id: child.key, ...child.val() });
                });
                setMessages(msgs);
            } else {
                setMessages([]);
            }
        });

        // Listen for member count
        const membersRef = ref(rtdb, `groups/${roomId}/members`);
        onValue(membersRef, (snapshot) => {
            if (snapshot.exists()) {
                setMembersCount(Object.keys(snapshot.val()).length);
            } else {
                setMembersCount(0);
            }
        });
    };

    const leaveRoom = () => {
        if (!currentRoom || !profile) return;
        // Remove self
        remove(ref(rtdb, `groups/${currentRoom.id}/members/${profile.customId}`));
        setCurrentRoom(null);
        setMessages([]);
        setMembersCount(0);
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!inputText.trim() || !currentRoom) return;

        const messagesRef = ref(rtdb, `groups/${currentRoom.id}/messages`);
        const newMessageRef = push(messagesRef);
        set(newMessageRef, {
            senderId: profile.customId,
            senderName: profile.displayName,
            text: inputText,
            timestamp: Date.now(),
            color: getProfileColor(profile.customId) // Small aesthetic touch
        });

        setInputText('');
    };

    // Generate consistent colors for users in GC based on their customId
    const getProfileColor = (id) => {
        if (!id) return '#ffffff';
        const colors = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#f472b6'];
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    // Room Selection View
    if (!currentRoom) {
        return (
            <div className="max-w-6xl mx-auto p-6 min-h-screen">
                <header className="flex items-center justify-between mb-12 flex-wrap gap-4">
                    <div>
                        <h1 className="text-4xl font-extrabold pb-2 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-500 flex items-center gap-3">
                            <UsersRound className="w-10 h-10 text-cyan-400" /> Community Chat Rooms
                        </h1>
                        <p className="text-gray-400">Join a room and start socializing. Max 40 members per room.</p>
                    </div>
                    <button onClick={() => navigate('/')} className="px-6 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition font-medium border border-gray-700 shadow flex items-center gap-2">
                        Back
                    </button>
                </header>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Create Room Form */}
                    <div className="lg:col-span-1 border border-gray-800 bg-gray-900/50 backdrop-blur-sm p-6 rounded-3xl h-fit border-t-purple-500/50 border-t-2">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Hash className="text-purple-400 w-5 h-5" /> Create New Room
                        </h2>
                        <form onSubmit={createRoom} className="space-y-4">
                            <input
                                type="text"
                                value={newRoomName}
                                onChange={e => setNewRoomName(e.target.value)}
                                placeholder="E.g. Anime Fans, Lofi Chill..."
                                maxLength={30}
                                className="w-full bg-black/40 border border-gray-700 px-4 py-3 rounded-xl focus:border-purple-500 outline-none transition-colors"
                            />
                            <button
                                type="submit"
                                disabled={!newRoomName.trim()}
                                className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition disabled:opacity-50"
                            >
                                Create & Join
                            </button>
                        </form>
                    </div>

                    {/* Room List */}
                    <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
                        {rooms.length === 0 && (
                            <div className="sm:col-span-2 text-center p-12 text-gray-500 bg-gray-800/20 border border-gray-800 rounded-3xl border-dashed">
                                No rooms exist right now. Be the first to create one!
                            </div>
                        )}
                        {rooms.map(room => (
                            <div key={room.id} onClick={() => joinRoom(room.id, room.name)} className="relative group p-6 bg-gray-900 rounded-3xl border border-gray-800 hover:border-blue-500/50 hover:bg-gray-800/80 cursor-pointer transition shadow hover:shadow-cyan-900/20 flex flex-col justify-between min-h-[160px]">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-200 mb-2 truncate" title={room.name}>{room.name}</h3>
                                    <p className="text-xs text-gray-500 mb-4 font-mono">ID: {room.id.substring(1, 8)}</p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg text-sm border border-gray-700">
                                        <Users className="w-4 h-4 text-cyan-400" />
                                        <span className={room.count >= 40 ? 'text-red-400' : 'text-gray-300'}>
                                            {room.count} <span className="opacity-50">/ 40</span>
                                        </span>
                                    </div>
                                    <button className="text-sm font-semibold text-blue-400 group-hover:text-white transition">Join →</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Chat View
    return (
        <div className="flex flex-col h-screen bg-gray-950">
            {/* Header */}
            <header className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800 shadow-xl z-10 px-6 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-tr from-cyan-600 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3">
                        <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-100 text-lg leading-tight flex items-center gap-2">
                            {currentRoom.name}
                        </h2>
                        <span className="text-xs text-cyan-400 flex items-center gap-1 font-medium bg-cyan-900/30 px-2 py-0.5 rounded-md mt-1 border border-cyan-800/50 w-fit">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                            {membersCount} Member{membersCount !== 1 ? 's' : ''} Online
                        </span>
                    </div>
                </div>
                <button
                    onClick={leaveRoom}
                    className="p-2.5 rounded-xl bg-gray-800 text-gray-400 hover:bg-red-500/20 hover:text-red-500 transition-colors border border-gray-700 hover:border-red-500/50 flex items-center gap-2"
                >
                    <span className="hidden sm:inline font-medium text-sm">Leave</span>
                    <LogOut className="w-4 h-4" />
                </button>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar lg:px-20 bg-gradient-to-b from-gray-900/50 to-gray-950">
                <div className="space-y-4">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3 py-20 opacity-60">
                            <MapPin className="w-12 h-12 animate-bounce" />
                            <p>You're the first one here! Say hello.</p>
                        </div>
                    )}

                    {messages.map((msg, index) => {
                        const isMe = msg.senderId === profile.customId;
                        const showHeader = index === 0 || messages[index - 1].senderId !== msg.senderId || (msg.timestamp - messages[index - 1].timestamp > 60000);

                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                                <div className={`flex flex-col max-w-[85%] md:max-w-[65%] ${isMe ? 'items-end' : 'items-start'}`}>
                                    {showHeader && !isMe && (
                                        <span className="text-sm font-semibold mb-1 ml-2 opacity-90" style={{ color: msg.color || '#9ca3af' }}>
                                            {msg.senderName}
                                        </span>
                                    )}
                                    <div className={`px-5 py-3 shadow-md inline-block relative ${isMe ? 'bg-indigo-600 text-white rounded-3xl rounded-tr-sm' : 'bg-gray-800 text-gray-100 rounded-3xl rounded-tl-sm border border-gray-700/50 group-hover:border-gray-600'}`}>
                                        <p className="leading-relaxed whitespace-pre-wrap word-break-words text-[15px]">{msg.text}</p>
                                    </div>
                                    <span className="text-[10px] text-gray-600 mt-1 mx-2 hidden group-hover:block transition-all duration-300">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} className="h-4" />
                </div>
            </div>

            {/* Input Area */}
            <form onSubmit={sendMessage} className="p-4 bg-gray-900/80 backdrop-blur-xl border-t border-gray-800 lg:px-20">
                <div className="flex gap-2 p-1.5 bg-gray-950 rounded-2xl border border-gray-800 focus-within:border-cyan-500/50 transition-colors shadow-inner">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={`Message ${currentRoom.name}...`}
                        maxLength={500}
                        className="flex-1 bg-transparent px-4 py-3 outline-none text-gray-100 placeholder-gray-600"
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim()}
                        className="px-6 py-2 m-1 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 transition-colors disabled:opacity-50 disabled:from-gray-700 disabled:to-gray-700 shadow flex items-center justify-center font-bold"
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    );
};

export default GroupChat;
