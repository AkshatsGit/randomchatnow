import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    rtdb, ref, push, set, onValue, update, remove,
    onDisconnect, get, serverTimestamp
} from '../services/firebase';
import {
    Send, LogOut, Loader2, DollarSign, RefreshCw,
    MessageSquare, ChevronRight, User, ShieldAlert
} from 'lucide-react';
import { processPayment } from '../utils/helpers';

const Chat1on1 = () => {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const [status, setStatus] = useState('idle'); // idle, finding, chatting
    const [chatRoomId, setChatRoomId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [partner, setPartner] = useState(null);
    const [paymentLoading, setPaymentLoading] = useState(false);

    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!profile) return;
        return () => {
            if (chatRoomId) handleExit();
        };
    }, [profile, chatRoomId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Matching Engine
    useEffect(() => {
        if (status === 'finding' && profile) {
            const queueRef = ref(rtdb, 'queue/1on1');
            const unsub = onValue(queueRef, (snapshot) => {
                const queue = snapshot.val();
                if (!queue) return;
                const me = queue[profile.customId];
                if (me && me.matchedWith && me.roomId) {
                    setChatRoomId(me.roomId);
                    setStatus('chatting');
                    setupChatRoom(me.roomId);
                    remove(ref(rtdb, `queue/1on1/${profile.customId}`));
                    return;
                }
                if (me) {
                    for (const pId in queue) {
                        const p = queue[pId];
                        if (pId !== profile.customId && !p.matchedWith) {
                            const iAmNewer = (me.timestamp > p.timestamp) || (me.timestamp === p.timestamp && profile.customId > pId);
                            if (iAmNewer) {
                                const rid = `1v1_${Math.random().toString(36).substr(2, 9)}`;
                                update(ref(rtdb, `queue/1on1/${profile.customId}`), { matchedWith: pId, roomId: rid });
                                update(ref(rtdb, `queue/1on1/${pId}`), { matchedWith: profile.customId, roomId: rid });
                                break;
                            }
                        }
                    }
                }
            });
            return () => unsub();
        }
    }, [status, profile]);

    const joinQueue = (premium = false) => {
        if (!profile) return;
        setStatus('finding');
        const qRef = ref(rtdb, `queue/1on1/${profile.customId}`);
        onDisconnect(qRef).remove();
        set(qRef, {
            id: profile.customId,
            name: profile.displayName,
            photo: profile.photoURL,
            timestamp: Date.now(),
            premium,
            gender: profile.gender || 'unknown'
        });
    };

    const setupChatRoom = (rid) => {
        const mRef = ref(rtdb, `chats/${rid}/messages`);
        const membersRef = ref(rtdb, `chats/${rid}/members`);

        onValue(mRef, (snap) => {
            const msgs = [];
            snap.forEach(c => { msgs.push({ id: c.key, ...c.val() }); });
            setMessages(msgs);
        });

        update(ref(rtdb, `chats/${rid}/members/${profile.customId}`), {
            status: 'online',
            name: profile.displayName,
            photo: profile.photoURL
        });

        onValue(membersRef, (snap) => {
            if (snap.exists()) {
                const m = snap.val();
                for (let id in m) {
                    if (id !== profile.customId) setPartner({ id, ...m[id] });
                }
            }
        });

        // Set system message: Connected
        push(mRef, {
            type: 'system',
            text: 'You are now chatting with a random stranger. Say hi!',
            timestamp: serverTimestamp()
        });

        onDisconnect(ref(rtdb, `chats/${rid}/members/${profile.customId}`)).update({ status: 'offline' });
    };

    const handleExit = () => {
        if (chatRoomId) {
            update(ref(rtdb, `chats/${chatRoomId}/members/${profile.customId}`), { status: 'left' });
            push(ref(rtdb, `chats/${chatRoomId}/messages`), {
                type: 'system',
                text: `${profile.displayName} has left the chat.`,
                timestamp: serverTimestamp()
            });
        }
    };

    const nextChat = () => {
        handleExit();
        setChatRoomId(null);
        setMessages([]);
        setPartner(null);
        joinQueue();
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!inputText.trim() || !chatRoomId) return;
        push(ref(rtdb, `chats/${chatRoomId}/messages`), {
            senderId: profile.customId,
            senderName: profile.displayName,
            text: inputText,
            timestamp: serverTimestamp()
        });
        setInputText('');
    };

    if (status === 'idle') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen px-4 animate-in fade-in duration-700">
                <div className="text-center space-y-6 mb-12">
                    <div className="inline-flex p-4 bg-purple-500/10 rounded-3xl text-purple-500 mb-4 animate-bounce">
                        <MessageSquare className="w-12 h-12" />
                    </div>
                    <h2 className="text-5xl font-black tracking-tighter">1-on-1 Pulse</h2>
                    <p className="text-gray-500 max-w-sm mx-auto font-medium">Join the void. Meet someone real. Pure anonymity, instant connection.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                    <button onClick={() => joinQueue(false)} className="group relative overflow-hidden p-8 bg-gray-900 border border-gray-800 rounded-[2.5rem] transition-all hover:border-purple-500/50 hover:bg-gray-800/50">
                        <div className="flex flex-col items-start text-left gap-4">
                            <div className="p-3 bg-gray-800 rounded-2xl group-hover:bg-purple-600 transition-colors">
                                <RefreshCw className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Standard Chat</h3>
                                <p className="text-sm text-gray-500">Free forever. Totally random.</p>
                            </div>
                        </div>
                    </button>

                    <button className="group relative overflow-hidden p-8 bg-purple-600 rounded-[2.5rem] transition-all hover:scale-[1.02] active:scale-95 shadow-2xl shadow-purple-500/20">
                        <div className="flex flex-col items-start text-left gap-4">
                            <div className="p-3 bg-white/20 rounded-2xl">
                                <DollarSign className="w-6 h-6 text-yellow-300" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Gender Filter</h3>
                                <p className="text-sm text-white/60">Match exactly who you want.</p>
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'finding') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen animate-in zoom-in duration-500">
                <div className="relative mb-12">
                    <div className="w-48 h-48 rounded-full border-[12px] border-gray-900 border-t-purple-600 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-24 h-24 bg-purple-600/20 rounded-full animate-pulse flex items-center justify-center">
                            <Users className="w-10 h-10 text-purple-500" />
                        </div>
                    </div>
                </div>
                <h3 className="text-3xl font-black text-gray-100 tracking-tight">Scanning the Void...</h3>
                <p className="text-gray-500 mt-2 font-medium">Wait a few seconds for a stranger to appear.</p>
                <button onClick={() => { setStatus('idle'); remove(ref(rtdb, `queue/1on1/${profile?.customId}`)); }} className="mt-12 px-8 py-3 bg-gray-900 border border-gray-800 rounded-2xl text-gray-400 hover:text-white transition-all font-bold uppercase tracking-widest text-xs">Abandom Scan</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#050505]">
            <header className="flex items-center justify-between p-6 bg-gray-900/40 backdrop-blur-xl border-b border-gray-800/50">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <img
                            src={partner?.photo || generateAvatar('placeholder')}
                            className="w-12 h-12 rounded-2xl bg-gray-800 border-2 border-purple-500/50"
                        />
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-gray-900 ${partner?.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
                    </div>
                    <div>
                        <h2 className="font-black text-lg tracking-tight">{partner?.name || 'Stranger'}</h2>
                        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">
                            {partner?.status === 'online' ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={nextChat} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-all group">
                        Next <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button onClick={() => { handleExit(); setStatus('idle'); setChatRoomId(null); }} className="p-2.5 bg-gray-800 hover:bg-red-500 text-gray-400 hover:text-white rounded-xl transition-all">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar scroll-smooth">
                {messages.map((msg, i) => {
                    if (msg.type === 'system') {
                        return (
                            <div key={i} className="flex justify-center my-6">
                                <div className="px-5 py-2 bg-gray-900/50 border border-gray-800 rounded-full text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                    <ShieldAlert className="w-3 h-3" /> {msg.text}
                                </div>
                            </div>
                        );
                    }
                    const isMe = msg.senderId === profile.customId;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                            <div className={`max-w-[80%] rounded-3xl px-6 py-4 shadow-xl ${isMe ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-gray-900 text-gray-200 rounded-tl-none border border-gray-800'}`}>
                                <p className="text-sm md:text-base leading-relaxed break-words font-medium">{msg.text}</p>
                                <div className={`text-[9px] mt-2 opacity-40 font-bold uppercase ${isMe ? 'text-right' : 'text-left'}`}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-6 bg-gray-950 border-t border-gray-900">
                <div className="max-w-4xl mx-auto flex gap-3">
                    <div className="flex-1 bg-gray-900 border border-gray-800 rounded-[1.5rem] px-6 py-1 focus-within:border-purple-500 transition-all flex items-center shadow-inner">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Send a message..."
                            className="flex-1 bg-transparent py-4 outline-none text-sm md:text-base"
                        />
                    </div>
                    <button type="submit" disabled={!inputText.trim()} className="p-5 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:grayscale">
                        <Send className="w-6 h-6" />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Chat1on1;
