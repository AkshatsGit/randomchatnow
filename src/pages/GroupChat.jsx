import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    rtdb, ref, push, set, onValue, update,
    remove, onDisconnect, serverTimestamp, get
} from '../services/firebase';
import {
    Users, Send, Hash, UsersRound, X,
    LogOut, Flame, Globe, Sparkles, MessageSquare
} from 'lucide-react';

const GroupChat = () => {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [newRoomName, setNewRoomName] = useState('');
    const [membersCount, setMembersCount] = useState(0);

    const messagesEndRef = useRef(null);

    useEffect(() => {
        const roomsRef = ref(rtdb, 'groups');
        const unsub = onValue(roomsRef, (snapshot) => {
            if (snapshot.exists()) {
                const roomsData = [];
                const now = Date.now();
                const THREE_HOURS = 3 * 60 * 60 * 1000;

                snapshot.forEach((child) => {
                    const room = child.val();
                    const lastActivity = room.updatedAt || room.createdAt || now;

                    // Expiration Logic: 3 hours of inactivity
                    if (now - lastActivity > THREE_HOURS) {
                        // Cleanup expired room
                        remove(ref(rtdb, `groups/${child.key}`));
                        remove(ref(rtdb, `group_messages/${child.key}`));
                    } else {
                        const members = room.members ? Object.keys(room.members).length : 0;
                        roomsData.push({ id: child.key, ...room, count: members });
                    }
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
        const roomId = newRoomRef.key;

        set(newRoomRef, {
            name: newRoomName,
            createdBy: profile.customId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            maxMembers: 40
        }).then(() => {
            setNewRoomName('');
            joinRoom(roomId, newRoomName);
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
        onDisconnect(roomMemberRef).remove();

        set(roomMemberRef, {
            name: profile.displayName,
            photo: profile.photoURL,
            joinedAt: Date.now()
        });

        setCurrentRoom({ id: roomId, name: roomName });

        const msgsRef = ref(rtdb, `group_messages/${roomId}`);
        onValue(msgsRef, (snap) => {
            const msgs = [];
            snap.forEach(c => { msgs.push({ id: c.key, ...c.val() }); });
            setMessages(msgs);
        });

        onValue(ref(rtdb, `groups/${roomId}/members`), (snap) => {
            setMembersCount(snap.exists() ? Object.keys(snap.val()).length : 0);
        });
    };

    const leaveRoom = () => {
        if (!currentRoom) return;
        remove(ref(rtdb, `groups/${currentRoom.id}/members/${profile.customId}`));
        setCurrentRoom(null);
        setMessages([]);
    };

    const sendMessage = (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const textToSync = inputText.trim();
        if (!textToSync || !currentRoom) return;

        const mRef = ref(rtdb, `group_messages/${currentRoom.id}`);
        push(mRef, {
            senderId: profile.customId,
            senderName: profile.displayName,
            senderPhoto: profile.photoURL,
            text: textToSync,
            timestamp: Date.now()
        });

        // Update room activity
        update(ref(rtdb, `groups/${currentRoom.id}`), { updatedAt: Date.now() });
        setInputText('');
        setTimeout(() => {
            const ta = document.getElementById('groupchat-textarea');
            if (ta) ta.style.height = 'auto';
        }, 0);
    };

    if (!currentRoom) {
        return (
            <div className="max-w-6xl mx-auto px-6 py-12 pb-32 animate-in fade-in duration-700">
                <header className="mb-16 space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 rounded-full text-[10px] font-black uppercase tracking-widest text-blue-400">
                        <Globe className="w-3 h-3" /> Live Global Hubs
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter">Community Pulse.</h1>
                    <p className="text-gray-500 max-w-xl font-medium">Temporary rooms that vanish after 3 hours of silence. Join the noise or start your own world.</p>
                </header>

                <div className="grid lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-1 space-y-8">
                        <div className="bg-gray-900 shadow-2xl rounded-[2.5rem] p-8 border border-gray-800 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Sparkles className="w-16 h-16" />
                            </div>
                            <h2 className="text-2xl font-bold mb-6">Forge a Room</h2>
                            <form onSubmit={createRoom} className="space-y-4">
                                <input
                                    type="text"
                                    value={newRoomName}
                                    onChange={e => setNewRoomName(e.target.value)}
                                    placeholder="Room Name..."
                                    className="w-full bg-black/40 border border-gray-800 px-6 py-4 rounded-2xl focus:border-blue-500 outline-none transition-all placeholder:text-gray-700"
                                />
                                <button className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-bold transition shadow-lg shadow-blue-900/40">Launch Pulse</button>
                            </form>
                        </div>
                    </div>

                    <div className="lg:col-span-2 grid sm:grid-cols-2 gap-6">
                        {rooms.length === 0 && (
                            <div className="sm:col-span-2 flex flex-col items-center justify-center p-20 bg-gray-900/20 border-2 border-dashed border-gray-800 rounded-[3rem] text-gray-500 gap-4">
                                <Flame className="w-12 h-12 opacity-20" />
                                <p className="font-bold italic">The grid is silent. No active pulses detected.</p>
                            </div>
                        )}
                        {rooms.map(room => (
                            <div key={room.id} onClick={() => joinRoom(room.id, room.name)} className="bg-gray-900 hover:bg-gray-800/80 border border-gray-800 hover:border-blue-500/50 rounded-[2.5rem] p-6 cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between group h-48 relative overflow-hidden">
                                <div className="space-y-2 relative z-10">
                                    <h3 className="text-xl font-black group-hover:text-blue-400 transition-colors uppercase tracking-tight">{room.name}</h3>
                                    <p className="text-[10px] text-gray-600 font-mono tracking-tighter uppercase">HUB ID: {room.id.substring(1, 8)}</p>
                                </div>
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="flex -space-x-2">
                                            {[1, 2, 3].map(i => <div key={i} className="w-6 h-6 rounded-full bg-gray-800 border-2 border-gray-900" />)}
                                        </div>
                                        <span className="text-xs font-bold text-gray-400">{room.count} Connected</span>
                                    </div>
                                    <div className="p-3 bg-gray-950 rounded-2xl group-hover:bg-blue-600 transition-colors shadow-inner">
                                        <Send className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col bg-[#050505] animate-in slide-in-from-right-4 duration-500 mobile-no-pt desktop-chat-wrapper" style={{ position: 'fixed', inset: 0, boxSizing: 'border-box', paddingTop: 80, overflow: 'hidden' }}>
            <header className="flex items-center justify-between p-6 bg-gray-900/40 backdrop-blur-xl border-b border-gray-800/50">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                        <UsersRound className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="font-black text-xl tracking-tight uppercase">{currentRoom.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest bg-blue-400/10 px-2 py-0.5 rounded-md border border-blue-400/20 flex items-center gap-1">
                                <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" /> {membersCount} Live
                            </span>
                            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter">Hub Instance</span>
                        </div>
                    </div>
                </div>
                <button onClick={leaveRoom} className="p-3 bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-xl transition-all border border-gray-700">
                    <LogOut className="w-5 h-5" />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {messages.map((msg, idx) => {
                    const isMe = msg.senderId === profile.customId;
                    return (
                        <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}>
                            {!isMe && <img src={msg.senderPhoto} className="w-8 h-8 rounded-lg mt-1 mr-3 opacity-60" />}
                            <div className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-lg ${isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-gray-900 text-gray-300 border border-gray-800 rounded-tl-none'}`}>
                                {!isMe && <div className="text-[10px] font-black mb-1 text-blue-400 uppercase tracking-widest">{msg.senderName}</div>}
                                <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                                <div className="text-[8px] mt-1 opacity-40 font-bold text-right italic uppercase">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-4 opacity-30">
                        <MessageSquare className="w-16 h-16" />
                        <p className="font-black uppercase tracking-widest text-xs font-mono">Channel Authenticated. Waiting for Pulse.</p>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-6 bg-gray-950 border-t border-gray-900">
                <div className="max-w-4xl mx-auto flex gap-3 items-end">
                    <textarea
                        id="groupchat-textarea"
                        value={inputText}
                        onChange={e => {
                            setInputText(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                if (window.innerWidth >= 768) {
                                    e.preventDefault();
                                    sendMessage(e);
                                }
                            }
                        }}
                        placeholder={`Broadcast to ${currentRoom.name}...`}
                        className="flex-1 bg-gray-900 border border-gray-800 px-6 py-4 rounded-2xl outline-none focus:border-blue-500 transition-all font-medium shadow-inner resize-none overflow-y-auto"
                        style={{ minHeight: '56px', maxHeight: '150px', lineHeight: '1.4' }}
                        rows="1"
                    />
                    <button type="submit" disabled={!inputText.trim()} className="w-14 h-14 flex items-center justify-center shrink-0 bg-blue-600 hover:bg-blue-500 rounded-2xl transition-all shadow-lg active:scale-95 disabled:grayscale">
                        <Send className="w-6 h-6 ml-1" />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default GroupChat;
