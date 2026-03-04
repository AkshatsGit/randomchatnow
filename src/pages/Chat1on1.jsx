import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    rtdb, ref, push, set, onValue, update,
    remove, onDisconnect, serverTimestamp, get
} from '../services/firebase';
import {
    Send, LogOut, Loader2, DollarSign, RefreshCw,
    MessageSquare, ChevronRight, User, ShieldAlert,
    Timer, UserCheck, Heart, Zap, HelpCircle
} from 'lucide-react';
import { processPayment } from '../utils/helpers';

const Chat1on1 = () => {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const [status, setStatus] = useState('idle'); // idle, finding, matching (for premium), chatting
    const [chatRoomId, setChatRoomId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [partner, setPartner] = useState(null);
    const [isPremium, setIsPremium] = useState(false);

    // Premium choices state
    const [choices, setChoices] = useState([]);
    const [choiceTimer, setChoiceTimer] = useState(15);
    const [paymentLoading, setPaymentLoading] = useState(false);

    const messagesEndRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(() => {
        if (!profile) return;
        return () => {
            if (chatRoomId) handleExit();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [profile, chatRoomId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Matching Engine
    useEffect(() => {
        if (status === 'finding' && profile && !isPremium) {
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
    }, [status, profile, isPremium]);

    const joinQueue = (premium = false) => {
        if (!profile) return;
        setIsPremium(premium);

        if (premium) {
            handlePremiumScan();
        } else {
            setStatus('finding');
            const qRef = ref(rtdb, `queue/1on1/${profile.customId}`);
            onDisconnect(qRef).remove();
            set(qRef, {
                id: profile.customId,
                name: profile.displayName,
                photo: profile.photoURL,
                gender: profile.gender || 'unknown',
                timestamp: Date.now()
            });
        }
    };

    const handlePremiumScan = async () => {
        setPaymentLoading(true);
        setStatus('finding');

        try {
            await processPayment(10); // Mock payment

            // Scan for 3 candidates
            const snapshot = await get(ref(rtdb, 'queue/1on1'));
            const queue = snapshot.val() || {};

            const candidates = Object.values(queue)
                .filter(p => p.id !== profile.customId && !p.matchedWith)
                .sort((a, b) => {
                    // Logic: Prefer opposite gender
                    const opposite = profile.gender === 'male' ? 'female' : 'male';
                    if (a.gender === opposite && b.gender !== opposite) return -1;
                    if (b.gender === opposite && a.gender !== opposite) return 1;
                    return b.timestamp - a.timestamp;
                })
                .slice(0, 3);

            if (candidates.length > 0) {
                setChoices(candidates);
                setStatus('matching');
                startChoiceTimer();
            } else {
                alert("No premium candidates found. Entering standard queue.");
                setIsPremium(false);
                joinQueue(false);
            }
        } catch (e) {
            alert("Payment Failed");
            setStatus('idle');
        } finally {
            setPaymentLoading(false);
        }
    };

    const startChoiceTimer = () => {
        setChoiceTimer(15);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setChoiceTimer(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    setStatus('idle');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const selectPartner = (pId) => {
        if (timerRef.current) clearInterval(timerRef.current);
        const rid = `1v1_premium_${Math.random().toString(36).substr(2, 9)}`;

        // Match them instantly
        update(ref(rtdb, `queue/1on1/${pId}`), { matchedWith: profile.customId, roomId: rid });

        setChatRoomId(rid);
        setStatus('chatting');
        setupChatRoom(rid);
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
            photo: profile.photoURL,
            gender: profile.gender
        });

        onValue(membersRef, (snap) => {
            if (snap.exists()) {
                const m = snap.val();
                for (let id in m) {
                    if (id !== profile.customId) setPartner({ id, ...m[id] });
                }
            }
        });

        push(mRef, {
            type: 'system',
            text: 'Connection established. Keep it respectful.',
            timestamp: serverTimestamp()
        });

        onDisconnect(ref(rtdb, `chats/${rid}/members/${profile.customId}`)).update({ status: 'offline' });
    };

    const handleExit = () => {
        if (chatRoomId) {
            update(ref(rtdb, `chats/${chatRoomId}/members/${profile.customId}`), { status: 'left' });
            push(ref(rtdb, `chats/${chatRoomId}/messages`), {
                type: 'system',
                text: `${profile.displayName} disconnected.`,
                timestamp: serverTimestamp()
            });
        }
    };

    const nextChat = () => {
        handleExit();
        setChatRoomId(null);
        setMessages([]);
        setPartner(null);
        joinQueue(isPremium);
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
                    <div className="inline-flex p-4 bg-purple-500/10 rounded-full text-purple-500 animate-bounce">
                        <Zap className="w-12 h-12" />
                    </div>
                    <h2 className="text-4xl font-black">Match Portal</h2>
                    <p className="text-gray-500 max-w-sm mx-auto font-medium">Find your pulse in the digital web.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl px-6">
                    <button onClick={() => joinQueue(false)} className="group p-10 bg-gray-900 border border-gray-800 rounded-[2.5rem] hover:border-purple-500/50 transition-all text-left space-y-4">
                        <RefreshCw className="w-8 h-8 text-gray-700 group-hover:text-purple-400 group-hover:rotate-180 transition-all duration-500" />
                        <div>
                            <h3 className="text-xl font-bold">Standard Find</h3>
                            <p className="text-xs text-gray-500">Free, fast, totally random match.</p>
                        </div>
                    </button>

                    <button onClick={() => joinQueue(true)} disabled={paymentLoading} className="group p-10 bg-purple-600/10 border border-purple-500/30 rounded-[2.5rem] hover:bg-purple-600 transition-all text-left space-y-4 shadow-2xl shadow-purple-900/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Heart className="w-20 h-20" />
                        </div>
                        {paymentLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : <DollarSign className="w-8 h-8 text-yellow-300 group-hover:text-white" />}
                        <div>
                            <h3 className="text-xl font-bold group-hover:text-white">Premium Filter</h3>
                            <p className="text-xs text-purple-400 group-hover:text-purple-200 uppercase font-black tracking-widest">Opposite Focus</p>
                        </div>
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'finding') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen">
                <div className="w-32 h-32 rounded-full border-[12px] border-gray-900 border-t-purple-600 animate-spin mb-8" />
                <h3 className="text-2xl font-black uppercase tracking-widest">Scanning Waves...</h3>
                <p className="text-gray-500 mt-2 font-mono">CALIBRATING GENDER PREFERENCES</p>
            </div>
        );
    }

    if (status === 'matching') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 animate-in slide-in-from-bottom-8 duration-500">
                <div className="max-w-4xl w-full space-y-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-4xl font-black text-white">Target Your Pulse</h2>
                            <p className="text-purple-400 font-bold uppercase tracking-[0.2em] text-xs">Pick one of these 3 active users</p>
                        </div>
                        <div className="bg-gray-900 px-6 py-3 rounded-2xl border border-gray-800 flex items-center gap-3">
                            <Timer className="w-5 h-5 text-red-500 animate-pulse" />
                            <span className="text-2xl font-black font-mono">{choiceTimer}s</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {choices.map((c) => (
                            <button
                                key={c.id}
                                onClick={() => selectPartner(c.id)}
                                className="bg-gray-900 hover:bg-purple-600 border border-gray-800 hover:border-transparent p-8 rounded-[3rem] transition-all group relative overflow-hidden text-center flex flex-col items-center gap-6"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-purple-500/20 group-hover:bg-white/20" />
                                <div className="relative">
                                    <img src={c.photo} className="w-32 h-32 rounded-[2rem] bg-gray-950 border-4 border-gray-800 shadow-xl" />
                                    <div className={`absolute -bottom-2 -right-2 p-2 rounded-xl shadow-xl flex items-center justify-center ${c.gender === 'female' ? 'bg-pink-500' : c.gender === 'male' ? 'bg-blue-500' : 'bg-gray-600'}`}>
                                        <span className="text-white text-xs font-bold">{c.gender === 'female' ? '♀' : c.gender === 'male' ? '♂' : '?'}</span>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-black text-xl leading-tight group-hover:text-white uppercase tracking-tight">{c.name}</h4>
                                    <p className="text-[10px] text-gray-500 group-hover:text-purple-200 uppercase font-black tracking-widest">{c.gender || 'Unknown'}</p>
                                </div>
                                <div className="w-full py-3 bg-gray-950 rounded-2xl text-[10px] font-black uppercase tracking-widest group-hover:bg-white group-hover:text-purple-600 transition-colors">Select Partner</div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#050505]">
            <header className="flex items-center justify-between p-6 bg-gray-900/40 backdrop-blur-xl border-b border-gray-800/50">
                <div className="flex items-center gap-4">
                    <img
                        src={partner?.photo || generateAvatar('placeholder')}
                        className="w-12 h-12 rounded-2xl bg-gray-800 border-2 border-purple-500/50"
                    />
                    <div>
                        <h2 className="font-black text-lg flex items-center gap-2">
                            {partner?.name || 'Stranger'}
                            {partner?.gender === 'female' ? <span className="text-pink-500">♀</span> : partner?.gender === 'male' ? <span className="text-blue-500">♂</span> : null}
                        </h2>
                        <span className={`text-[10px] uppercase font-bold tracking-widest ${partner?.status === 'online' ? 'text-green-500' : 'text-red-500'}`}>{partner?.status || 'Searching'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={nextChat} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-all group">
                        Next <ChevronRight className="w-4 h-4 group-hover:translate-x-1" />
                    </button>
                    <button onClick={() => { handleExit(); setStatus('idle'); setChatRoomId(null); }} className="p-2.5 bg-gray-800 hover:bg-red-500 text-gray-400 hover:text-white rounded-xl transition-all"><LogOut className="w-5 h-5" /></button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {messages.map((msg, i) => {
                    if (msg.type === 'system') return <div key={i} className="text-center my-6 text-[10px] font-black text-gray-600 uppercase tracking-widest border-y border-gray-900 py-2">{msg.text}</div>;
                    const isMe = msg.senderId === profile.customId;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                            <div className={`max-w-[80%] rounded-3xl px-6 py-4 shadow-xl ${isMe ? 'bg-purple-600 text-white rounded-tr-none' : 'bg-gray-900 text-gray-200 rounded-tl-none border border-gray-800'}`}>
                                <p className="text-sm md:text-base font-medium leading-relaxed">{msg.text}</p>
                                <div className="text-[8px] mt-2 opacity-40 font-bold uppercase text-right italic">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-6 bg-gray-950 border-t border-gray-900">
                <div className="max-w-4xl mx-auto flex gap-3">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Broadcast your pulse..."
                        className="flex-1 bg-gray-900 border border-gray-800 px-6 py-5 rounded-3xl outline-none focus:border-purple-500 transition-all font-medium"
                    />
                    <button type="submit" disabled={!inputText.trim()} className="p-6 bg-purple-600 hover:bg-purple-500 text-white rounded-3xl transition-all shadow-lg active:scale-95 disabled:grayscale">
                        <Send className="w-6 h-6" />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Chat1on1;
