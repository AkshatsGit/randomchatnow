import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    rtdb, ref, push, set, onValue, update,
    remove, onDisconnect, serverTimestamp, get
} from '../services/firebase';
import {
    Send, LogOut, Loader2, DollarSign, RefreshCw,
    MessageSquare, ChevronRight, Heart, Zap, HelpCircle, Timer
} from 'lucide-react';
import { processPayment, generateAvatar } from '../utils/helpers';

const Chat1on1 = () => {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const [status, setStatus] = useState('idle'); // idle | finding | matching | chatting
    const [chatRoomId, setChatRoomId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [partner, setPartner] = useState(null);
    const [isPremium, setIsPremium] = useState(false);
    const [choices, setChoices] = useState([]);
    const [choiceTimer, setChoiceTimer] = useState(15);
    const [paymentLoading, setPaymentLoading] = useState(false);

    const messagesEndRef = useRef(null);
    const timerRef = useRef(null);
    const msgListenerRef = useRef(null);
    const memberListenerRef = useRef(null);
    const queueListenerRef = useRef(null);
    const currentRoomId = useRef(null);

    // Cleanup all listeners
    const cleanupListeners = useCallback(() => {
        if (msgListenerRef.current) { msgListenerRef.current(); msgListenerRef.current = null; }
        if (memberListenerRef.current) { memberListenerRef.current(); memberListenerRef.current = null; }
        if (queueListenerRef.current) { queueListenerRef.current(); queueListenerRef.current = null; }
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanupListeners();
            if (currentRoomId.current && profile?.customId) {
                update(ref(rtdb, `chats/${currentRoomId.current}/members/${profile.customId}`), { status: 'left' }).catch(() => { });
            }
            if (profile?.customId) {
                remove(ref(rtdb, `queue/1on1/${profile.customId}`)).catch(() => { });
            }
        };
    }, [profile?.customId, cleanupListeners]);

    const joinQueue = useCallback((premium = false) => {
        if (!profile) return;
        setIsPremium(premium);
        setPartner(null);
        setMessages([]);

        if (premium) {
            handlePremiumScan();
        } else {
            startStandardSearch();
        }
    }, [profile]);

    // ─────────────────────────────────────────────────────────────────
    // STANDARD MATCHING - bulletproof single-writer approach
    // Only the OLDER user in queue triggers the match.
    // The newer user just watches for a 'roomId' to appear on their entry.
    // ─────────────────────────────────────────────────────────────────
    const startStandardSearch = useCallback(() => {
        if (!profile) return;
        cleanupListeners();
        setStatus('finding');

        const myQueueRef = ref(rtdb, `queue/1on1/${profile.customId}`);
        const myEntry = {
            id: profile.customId,
            name: profile.displayName,
            photo: profile.photoURL,
            gender: profile.gender || 'unknown',
            timestamp: Date.now()
        };

        // Remove self from queue on disconnect
        onDisconnect(myQueueRef).remove();

        set(myQueueRef, myEntry).then(() => {
            // Listen to the ENTIRE queue
            const qRef = ref(rtdb, 'queue/1on1');
            const unsub = onValue(qRef, async (snapshot) => {
                if (!snapshot.exists()) return;
                const queue = snapshot.val();
                const me = queue[profile.customId];
                if (!me) return;

                // ✅ CASE 1: Someone already matched ME (I'm the "newer" user)
                if (me.roomId) {
                    unsub(); // stop listening
                    queueListenerRef.current = null;
                    remove(myQueueRef);
                    enterRoom(me.roomId);
                    return;
                }

                // ✅ CASE 2: I am the OLDER user - I do the matching
                const candidates = Object.entries(queue).filter(([id, entry]) => {
                    return (
                        id !== profile.customId &&
                        !entry.roomId &&          // not already matched
                        !entry.matchLock          // not being matched by someone else
                    );
                });

                if (candidates.length === 0) return;

                // Pick the oldest waiting candidate
                candidates.sort((a, b) => a[1].timestamp - b[1].timestamp);
                const [partnerId, partnerEntry] = candidates[0];

                // I was in queue first? Only match if I'm older
                if (me.timestamp > partnerEntry.timestamp) return;

                const roomId = `1v1_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

                // Write atomically - set roomId on BOTH entries
                try {
                    await update(ref(rtdb, 'queue/1on1'), {
                        [`${profile.customId}/roomId`]: roomId,
                        [`${partnerId}/roomId`]: roomId,
                        [`${profile.customId}/matchLock`]: true,
                        [`${partnerId}/matchLock`]: true,
                    });
                    // Enter the room myself
                    unsub();
                    queueListenerRef.current = null;
                    remove(myQueueRef);
                    enterRoom(roomId);
                } catch (e) {
                    console.error('Match write failed:', e);
                }
            });
            queueListenerRef.current = unsub;
        });
    }, [profile, cleanupListeners]);

    const enterRoom = useCallback((roomId) => {
        if (!profile) return;
        currentRoomId.current = roomId;
        setChatRoomId(roomId);
        setStatus('chatting');

        const mRef = ref(rtdb, `chats/${roomId}/messages`);
        const membersRef = ref(rtdb, `chats/${roomId}/members`);

        // Write self as member
        set(ref(rtdb, `chats/${roomId}/members/${profile.customId}`), {
            status: 'online',
            name: profile.displayName,
            photo: profile.photoURL,
            gender: profile.gender || 'unknown',
            joinedAt: Date.now()
        });

        // On disconnect, mark as offline
        onDisconnect(ref(rtdb, `chats/${roomId}/members/${profile.customId}`))
            .update({ status: 'offline' });

        // Listen to messages
        const msgUnsub = onValue(mRef, (snap) => {
            const msgs = [];
            snap.forEach(c => msgs.push({ id: c.key, ...c.val() }));
            setMessages(msgs);
        });
        msgListenerRef.current = msgUnsub;

        // Listen to members (detect partner joining/leaving)
        const memUnsub = onValue(membersRef, (snap) => {
            if (!snap.exists()) return;
            const members = snap.val();
            for (const [id, data] of Object.entries(members)) {
                if (id !== profile.customId) {
                    setPartner({ id, ...data });
                }
            }
        });
        memberListenerRef.current = memUnsub;

        // Post system message
        push(mRef, {
            type: 'system',
            text: '🔗 Connected! Say hello 👋',
            timestamp: Date.now()
        });
    }, [profile]);

    // ─────────────────────────────────────────────────────────────────
    // PREMIUM MATCHING
    // ─────────────────────────────────────────────────────────────────
    const handlePremiumScan = async () => {
        setPaymentLoading(true);
        setStatus('finding');

        try {
            await processPayment(10);
            const snapshot = await get(ref(rtdb, 'queue/1on1'));
            const queue = snapshot.val() || {};

            const candidates = Object.values(queue)
                .filter(p => p.id && p.id !== profile.customId && !p.roomId)
                .sort((a, b) => {
                    const opposite = profile.gender === 'male' ? 'female' : 'male';
                    if (a.gender === opposite && b.gender !== opposite) return -1;
                    if (b.gender === opposite && a.gender !== opposite) return 1;
                    return a.timestamp - b.timestamp;
                })
                .slice(0, 3);

            if (candidates.length > 0) {
                setChoices(candidates);
                setStatus('matching');
                startChoiceTimer();
            } else {
                setIsPremium(false);
                startStandardSearch();
            }
        } catch (e) {
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

    const selectPartner = async (partnerId) => {
        if (timerRef.current) clearInterval(timerRef.current);
        const roomId = `1v1_premium_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        // Tell partner they are matched
        await update(ref(rtdb, `queue/1on1/${partnerId}`), { roomId });
        enterRoom(roomId);
    };

    // ─────────────────────────────────────────────────────────────────
    // CHAT ACTIONS
    // ─────────────────────────────────────────────────────────────────
    const handleExit = useCallback(() => {
        const rid = currentRoomId.current;
        if (rid && profile?.customId) {
            update(ref(rtdb, `chats/${rid}/members/${profile.customId}`), { status: 'left' });
            push(ref(rtdb, `chats/${rid}/messages`), {
                type: 'system',
                text: `${profile.displayName} has left the chat.`,
                timestamp: Date.now()
            });
        }
        cleanupListeners();
        currentRoomId.current = null;
        setChatRoomId(null);
        setMessages([]);
        setPartner(null);
    }, [profile, cleanupListeners]);

    const nextChat = useCallback(() => {
        handleExit();
        setStatus('idle');
        setTimeout(() => joinQueue(isPremium), 100);
    }, [handleExit, joinQueue, isPremium]);

    const sendMessage = (e) => {
        e.preventDefault();
        const rid = currentRoomId.current;
        if (!inputText.trim() || !rid) return;
        push(ref(rtdb, `chats/${rid}/messages`), {
            senderId: profile.customId,
            senderName: profile.displayName,
            text: inputText,
            timestamp: Date.now()
        });
        setInputText('');
    };

    // ─────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────
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
                    <button onClick={() => joinQueue(false)} className="group p-10 bg-gray-900 border border-gray-800 rounded-[2.5rem] hover:border-purple-500/50 transition-all text-left space-y-4 shadow-xl">
                        <RefreshCw className="w-8 h-8 text-gray-700 group-hover:text-purple-400 group-hover:rotate-180 transition-all duration-500" />
                        <div>
                            <h3 className="text-xl font-bold">Standard Find</h3>
                            <p className="text-xs text-gray-500">Free, fast, totally random match.</p>
                        </div>
                    </button>

                    <button onClick={() => joinQueue(true)} disabled={paymentLoading} className="group p-10 bg-purple-600/10 border border-purple-500/30 rounded-[2.5rem] hover:bg-purple-600 transition-all text-left space-y-4 shadow-2xl shadow-purple-900/40 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20"><Heart className="w-20 h-20" /></div>
                        {paymentLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : <DollarSign className="w-8 h-8 text-yellow-300 group-hover:text-white" />}
                        <div>
                            <h3 className="text-xl font-bold group-hover:text-white">Premium Filter</h3>
                            <p className="text-xs text-purple-400 group-hover:text-purple-200 uppercase font-black tracking-widest">Opposite Focus ♀♂</p>
                        </div>
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'finding') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-8">
                <div className="relative">
                    <div className="w-32 h-32 rounded-full border-[12px] border-gray-900 border-t-purple-600 animate-spin" />
                    <div className="w-32 h-32 rounded-full border-[12px] border-transparent border-b-indigo-700 animate-spin absolute inset-0" style={{ animationDuration: '1.5s', animationDirection: 'reverse' }} />
                </div>
                <div className="text-center space-y-3">
                    <h3 className="text-2xl font-black uppercase tracking-widest">Scanning Waves...</h3>
                    <p className="text-gray-600 font-mono text-xs uppercase tracking-widest">Connecting to global servers</p>
                </div>
                <button onClick={() => { cleanupListeners(); remove(ref(rtdb, `queue/1on1/${profile?.customId}`)); setStatus('idle'); }} className="px-8 py-3 bg-gray-800 hover:bg-gray-700 rounded-2xl font-bold text-sm transition-all border border-gray-700">
                    Cancel
                </button>
            </div>
        );
    }

    if (status === 'matching') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 pb-32 animate-in slide-in-from-bottom-8 duration-500">
                <div className="max-w-4xl w-full space-y-10">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h2 className="text-4xl font-black text-white">Target Your Pulse</h2>
                            <p className="text-purple-400 font-bold uppercase tracking-[0.2em] text-xs mt-1">Pick one of these active users</p>
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
                                    <img src={c.photo || generateAvatar(c.id)} className="w-32 h-32 rounded-[2rem] bg-gray-950 border-4 border-gray-800 shadow-xl" />
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

    // ──── CHAT VIEW ────
    return (
        <div className="flex flex-col h-screen bg-[#050505]">
            <header className="flex items-center justify-between p-4 bg-gray-900/60 backdrop-blur-xl border-b border-gray-800/50 z-10">
                <div className="flex items-center gap-3">
                    <img
                        src={partner?.photo || generateAvatar('stranger')}
                        className="w-11 h-11 rounded-2xl bg-gray-800 border-2 border-purple-500/50 shrink-0"
                    />
                    <div>
                        <h2 className="font-black text-base flex items-center gap-1">
                            {partner?.name || 'Connecting...'}
                            {partner?.gender === 'female' ? <span className="text-pink-500 text-xs">♀</span> : partner?.gender === 'male' ? <span className="text-blue-500 text-xs">♂</span> : null}
                        </h2>
                        <div className={`text-[10px] uppercase font-black tracking-widest flex items-center gap-1.5 ${partner?.status === 'online' ? 'text-green-500' : partner?.status === 'left' ? 'text-red-500' : 'text-gray-500'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${partner?.status === 'online' ? 'bg-green-500 animate-pulse' : partner?.status === 'left' ? 'bg-red-500' : 'bg-gray-600 animate-pulse'}`} />
                            {partner?.status === 'online' ? 'Connected' : partner?.status === 'left' ? 'Left the chat' : 'Waiting...'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={nextChat} className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-all text-sm group">
                        Next <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                    <button onClick={() => { handleExit(); setStatus('idle'); }} className="p-2.5 bg-gray-800 hover:bg-red-500 text-gray-400 hover:text-white rounded-xl transition-all">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-gray-700 gap-3 opacity-40">
                        <MessageSquare className="w-12 h-12" />
                        <p className="text-xs font-black uppercase tracking-widest">Say hello!</p>
                    </div>
                )}
                {messages.map((msg, i) => {
                    if (msg.type === 'system') return (
                        <div key={i} className="text-center my-4 text-[10px] font-black text-gray-600 uppercase tracking-widest border-y border-gray-900/80 py-2">{msg.text}</div>
                    );
                    const isMe = msg.senderId === profile?.customId;
                    return (
                        <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-200`}>
                            <div className={`max-w-[85%] md:max-w-[75%] rounded-3xl px-5 py-3.5 shadow-lg ${isMe ? 'bg-purple-600 text-white rounded-tr-sm' : 'bg-gray-900 text-gray-200 rounded-tl-sm border border-gray-800'}`}>
                                <p className="text-sm md:text-base font-medium leading-relaxed break-words">{msg.text}</p>
                                <div className="text-[8px] mt-1.5 opacity-40 font-bold uppercase text-right italic">
                                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-4 bg-gray-950 border-t border-gray-900 safe-area-bottom">
                <div className="max-w-4xl mx-auto flex gap-3">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type a message..."
                        autoComplete="off"
                        className="flex-1 bg-gray-900 border border-gray-800 px-5 py-4 rounded-3xl outline-none focus:border-purple-500 transition-all font-medium text-sm"
                    />
                    <button type="submit" disabled={!inputText.trim()} className="p-4 bg-purple-600 hover:bg-purple-500 text-white rounded-3xl transition-all shadow-lg active:scale-95 disabled:grayscale shrink-0">
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Chat1on1;
