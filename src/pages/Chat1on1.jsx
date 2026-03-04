import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    rtdb, ref, push, set, onValue, update,
    remove, onDisconnect, get
} from '../services/firebase';
import {
    Send, LogOut, RefreshCw,
    MessageSquare, ChevronRight, Heart, Zap,
    Timer, Lock, Crown, Check, X, Sparkles
} from 'lucide-react';
import { generateAvatar } from '../utils/helpers';

const PREMIUM_CODE = 'AKSHAT';
const MAX_MSGS = 150;

// ─── Premium Modal ──────────────────────────────────────────────────────────
const PremiumModal = ({ onClose, onUnlock }) => {
    const [code, setCode] = useState('');
    const [err, setErr] = useState('');
    const [ok, setOk] = useState(false);

    const submit = (e) => {
        e.preventDefault();
        if (code.trim().toUpperCase() === PREMIUM_CODE) {
            setOk(true);
            setTimeout(onUnlock, 700);
        } else {
            setErr('Invalid code.');
            setCode('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-sm bg-gray-950 border border-gray-800 rounded-[2rem] p-7 space-y-6 relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-5 right-5 text-gray-600 hover:text-white"><X className="w-5 h-5" /></button>
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="p-4 bg-yellow-500/10 rounded-2xl"><Crown className="w-10 h-10 text-yellow-400" /></div>
                    <h2 className="text-2xl font-black">Premium Filter</h2>
                    <p className="text-gray-500 text-xs leading-relaxed">Pick from 3 users. <span className="text-purple-400 font-bold">Opposite gender</span> shown first.</p>
                </div>
                <a href="#" className="block w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl font-black text-center text-black text-sm uppercase tracking-widest active:scale-95 transition-transform">
                    ⚡ Buy Premium — ₹10
                </a>
                <div className="flex items-center gap-3"><div className="flex-1 h-px bg-gray-800" /><span className="text-[9px] text-gray-600 font-black uppercase tracking-widest whitespace-nowrap">or enter code</span><div className="flex-1 h-px bg-gray-800" /></div>
                <form onSubmit={submit} className="space-y-3">
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                        <input value={code} onChange={e => { setCode(e.target.value); setErr(''); }} placeholder="Enter code..." className="w-full bg-gray-900 border border-gray-800 rounded-xl py-3.5 pl-11 pr-4 outline-none focus:border-purple-500 text-center font-mono uppercase tracking-widest text-sm transition-colors" />
                    </div>
                    {err && <p className="text-red-500 text-xs text-center font-bold">{err}</p>}
                    {ok && <p className="text-green-500 text-xs text-center font-bold flex items-center justify-center gap-1"><Check className="w-3 h-3" /> Unlocked!</p>}
                    <button type="submit" disabled={!code.trim() || ok} className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 rounded-xl font-black uppercase tracking-widest text-sm transition-all disabled:opacity-40 active:scale-95">
                        {ok ? 'Unlocked!' : 'Activate'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const Chat1on1 = () => {
    const { profile } = useAuth();

    const [status, setStatus] = useState('idle');
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [partner, setPartner] = useState(null);
    const [isPremium, setIsPremium] = useState(() => localStorage.getItem('rch_premium') === 'true');
    const [showModal, setShowModal] = useState(false);
    const [choices, setChoices] = useState([]);
    const [choiceTimer, setChoiceTimer] = useState(15);

    const endRef = useRef(null);
    const roomRef = useRef(null);         // current room ID string
    const activeRef = useRef(false);      // whether we are actively searching/chatting
    const listenersRef = useRef([]);      // all onValue unsubs
    const timerRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Hard cleanup on unmount
    useEffect(() => {
        return () => {
            activeRef.current = false;
            listenersRef.current.forEach(u => { try { u(); } catch (_) { } });
            if (timerRef.current) clearInterval(timerRef.current);
            if (profile?.customId) {
                remove(ref(rtdb, `queue/1on1/${profile.customId}`)).catch(() => { });
                if (roomRef.current) {
                    update(ref(rtdb, `chats/${roomRef.current}/members/${profile.customId}`), { status: 'offline' }).catch(() => { });
                }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stopAllListeners = () => {
        listenersRef.current.forEach(u => { try { u(); } catch (_) { } });
        listenersRef.current = [];
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };

    // ────────────────────────────────────────────────────────────────
    // START SEARCH
    // ────────────────────────────────────────────────────────────────
    const startSearch = useCallback((premium = false) => {
        if (!profile?.customId) return;

        stopAllListeners();
        activeRef.current = true;
        roomRef.current = null;
        setPartner(null);
        setMessages([]);
        setChoices([]);
        setStatus('finding');

        const myId = profile.customId;
        const qRef = ref(rtdb, `queue/1on1/${myId}`);

        // Auto-remove from queue if browser closes
        onDisconnect(qRef).remove();

        const myEntry = {
            id: myId,
            name: profile.displayName || 'Stranger',
            photo: profile.photoURL || generateAvatar(myId),
            gender: profile.gender || 'unknown',
            ts: Date.now()
        };

        set(qRef, myEntry).then(() => {
            if (!activeRef.current) return;

            // ── Poll the ENTIRE queue every time it changes ──
            const queueUnsub = onValue(ref(rtdb, 'queue/1on1'), (snapshot) => {
                if (!activeRef.current) return;
                if (!snapshot.exists()) return;

                const queue = snapshot.val();
                const me = queue[myId];
                if (!me) return;

                // ── I've been matched by someone else ──
                if (me.roomId) {
                    activeRef.current = false;
                    queueUnsub(); // stop watching queue
                    listenersRef.current = listenersRef.current.filter(u => u !== queueUnsub);
                    remove(qRef).catch(() => { });
                    enterRoom(me.roomId);
                    return;
                }

                // ── Find candidates ──
                const others = Object.entries(queue).filter(([id, entry]) =>
                    id !== myId && !entry.roomId
                );
                if (others.length === 0) return;

                if (premium) {
                    // Show top 3 for premium users to pick
                    const sorted = [...others].sort(([, a], [, b]) => {
                        const opp = profile.gender === 'male' ? 'female' : 'male';
                        const aMatch = a.gender === opp;
                        const bMatch = b.gender === opp;
                        if (aMatch && !bMatch) return -1;
                        if (bMatch && !aMatch) return 1;
                        return a.ts - b.ts;
                    });
                    const top3 = sorted.slice(0, 3).map(([, v]) => v);
                    if (top3.length > 0 && status !== 'matching') {
                        queueUnsub();
                        listenersRef.current = listenersRef.current.filter(u => u !== queueUnsub);
                        setChoices(top3);
                        setStatus('matching');
                        startTimer();
                    }
                    return;
                }

                // ── Standard: I am the oldest un-matched user → I do the match ──
                // Only match if I am the OLDEST in queue (lowest ts)
                const myTs = me.ts;
                const isOldest = others.every(([, e]) => myTs <= e.ts);
                // Tiebreak: if same ts, lower id wins
                const tieWinner = others.every(([id, e]) => myTs < e.ts || (myTs === e.ts && myId < id));
                if (!isOldest && !tieWinner) return;

                // Pick the newest waiter as partner (most recent joiner)
                others.sort(([, a], [, b]) => b.ts - a.ts);
                const [partnerId] = others[0];

                const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

                // Write roomId to both atomically — the other user's listener will pick it up
                activeRef.current = false;
                update(ref(rtdb, 'queue/1on1'), {
                    [`${myId}/roomId`]: roomId,
                    [`${partnerId}/roomId`]: roomId,
                }).then(() => {
                    queueUnsub();
                    listenersRef.current = listenersRef.current.filter(u => u !== queueUnsub);
                    remove(qRef).catch(() => { });
                    enterRoom(roomId);
                }).catch(err => {
                    console.error('Match write failed:', err);
                    activeRef.current = true; // retry
                });
            });

            listenersRef.current.push(queueUnsub);
        }).catch(err => {
            console.error('Queue join failed:', err);
            setStatus('idle');
        });
    }, [profile]);

    const startTimer = () => {
        setChoiceTimer(15);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setChoiceTimer(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    if (profile?.customId) remove(ref(rtdb, `queue/1on1/${profile.customId}`)).catch(() => { });
                    setStatus('idle');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const selectPartner = async (partnerId) => {
        if (timerRef.current) clearInterval(timerRef.current);
        const roomId = `room_p_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        try {
            await update(ref(rtdb, 'queue/1on1'), {
                [`${profile.customId}/roomId`]: roomId,
                [`${partnerId}/roomId`]: roomId,
            });
            remove(ref(rtdb, `queue/1on1/${profile.customId}`)).catch(() => { });
            enterRoom(roomId);
        } catch (e) {
            console.error('Select partner failed:', e);
            setStatus('idle');
        }
    };

    // ────────────────────────────────────────────────────────────────
    // ENTER ROOM
    // ────────────────────────────────────────────────────────────────
    const enterRoom = useCallback((roomId) => {
        if (!profile?.customId) return;
        stopAllListeners();
        roomRef.current = roomId;
        setStatus('chatting');

        const myMemberRef = ref(rtdb, `chats/${roomId}/members/${profile.customId}`);

        // Write self into room
        set(myMemberRef, {
            status: 'online',
            name: profile.displayName || 'Stranger',
            photo: profile.photoURL || generateAvatar(profile.customId),
            gender: profile.gender || 'unknown',
            joinedAt: Date.now()
        });

        // Auto-mark offline if tab closes
        onDisconnect(myMemberRef).update({ status: 'offline' });

        // Listen to partner
        const memUnsub = onValue(ref(rtdb, `chats/${roomId}/members`), (snap) => {
            if (!snap.exists()) return;
            Object.entries(snap.val()).forEach(([id, data]) => {
                if (id !== profile.customId) setPartner(p => ({ ...p, ...data, id }));
            });
        });
        listenersRef.current.push(memUnsub);

        // Listen to messages
        const msgUnsub = onValue(ref(rtdb, `chats/${roomId}/messages`), (snap) => {
            const msgs = [];
            snap.forEach(c => msgs.push({ id: c.key, ...c.val() }));
            setMessages(msgs.slice(-MAX_MSGS));
        });
        listenersRef.current.push(msgUnsub);

        // System message
        push(ref(rtdb, `chats/${roomId}/messages`), {
            type: 'system',
            text: '🔗 You are connected! Say hello 👋',
            ts: Date.now()
        });
    }, [profile]);

    // ────────────────────────────────────────────────────────────────
    // EXIT / NEXT
    // ────────────────────────────────────────────────────────────────
    const doExit = useCallback((leaveMsg = true) => {
        const rid = roomRef.current;
        if (rid && profile?.customId) {
            if (leaveMsg) {
                push(ref(rtdb, `chats/${rid}/messages`), {
                    type: 'system',
                    text: `${profile.displayName} left the chat.`,
                    ts: Date.now()
                }).catch(() => { });
            }
            update(ref(rtdb, `chats/${rid}/members/${profile.customId}`), { status: 'left' }).catch(() => { });
        }
        if (profile?.customId) remove(ref(rtdb, `queue/1on1/${profile.customId}`)).catch(() => { });
        activeRef.current = false;
        roomRef.current = null;
        stopAllListeners();
        setPartner(null);
        setMessages([]);
    }, [profile]);

    const handleLeave = () => { doExit(); setStatus('idle'); };
    const handleNext = () => { doExit(); setTimeout(() => startSearch(isPremium), 100); };

    const sendMessage = (e) => {
        e.preventDefault();
        const rid = roomRef.current;
        if (!inputText.trim() || !rid || !profile?.customId) return;
        push(ref(rtdb, `chats/${rid}/messages`), {
            senderId: profile.customId,
            text: inputText.trim(),
            ts: Date.now()
        });
        setInputText('');
    };

    const handlePremiumUnlock = () => {
        setIsPremium(true);
        localStorage.setItem('rch_premium', 'true');
        setShowModal(false);
        startSearch(true);
    };

    // ────────────────────────────────────────────────────────────────
    // RENDER — IDLE
    // ────────────────────────────────────────────────────────────────
    if (status === 'idle') return (
        <>
            {showModal && <PremiumModal onClose={() => setShowModal(false)} onUnlock={handlePremiumUnlock} />}
            <div className="flex flex-col items-center justify-center min-h-screen px-4 pb-28 animate-in fade-in duration-500">
                <div className="text-center space-y-4 mb-12">
                    <div className="inline-flex p-5 bg-purple-500/10 rounded-full animate-bounce">
                        <Zap className="w-12 h-12 text-purple-500" />
                    </div>
                    <h2 className="text-4xl font-black">Match Portal</h2>
                    <p className="text-gray-500 text-sm font-medium">{profile?.displayName ? `Ready, ${profile.displayName}?` : 'Find your random match.'}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                    <button onClick={() => startSearch(false)} className="group p-8 bg-gray-900 border border-gray-800 hover:border-purple-500/50 rounded-[1.5rem] text-left space-y-4 transition-all active:scale-[0.97]">
                        <RefreshCw className="w-7 h-7 text-gray-600 group-hover:text-purple-400 group-hover:rotate-180 transition-all duration-500" />
                        <div>
                            <h3 className="text-lg font-black">Standard Find</h3>
                            <p className="text-xs text-gray-500 mt-1">Free · instant · random.</p>
                        </div>
                    </button>

                    <button onClick={() => { if (isPremium) startSearch(true); else setShowModal(true); }} className="group p-8 bg-yellow-500/5 border border-yellow-500/20 hover:border-yellow-400/50 rounded-[1.5rem] text-left space-y-4 transition-all active:scale-[0.97] relative overflow-hidden">
                        <div className="absolute -top-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <Heart className="w-24 h-24 text-yellow-400" />
                        </div>
                        <div className="flex items-center gap-2">
                            <Crown className="w-7 h-7 text-yellow-400" />
                            {isPremium && <span className="text-[9px] text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Active</span>}
                        </div>
                        <div>
                            <h3 className="text-lg font-black">Premium Filter</h3>
                            <p className="text-xs text-yellow-600 font-black uppercase tracking-widest mt-1">♀♂ Opposite Focus</p>
                        </div>
                    </button>
                </div>

                {isPremium && <p className="mt-5 text-xs text-green-500/50 font-bold flex items-center gap-1"><Sparkles className="w-3 h-3" /> Premium Active</p>}
            </div>
        </>
    );

    // ────────────────────────────────────────────────────────────────
    // RENDER — FINDING
    // ────────────────────────────────────────────────────────────────
    if (status === 'finding') return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-8">
            <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-[8px] border-gray-900 border-t-purple-600 animate-spin" />
                <div className="absolute inset-2 rounded-full border-[5px] border-transparent border-b-indigo-700 animate-spin" style={{ animationDuration: '0.7s', animationDirection: 'reverse' }} />
            </div>
            <div className="text-center">
                <h3 className="text-xl font-black uppercase tracking-widest">Scanning...</h3>
                <p className="text-gray-600 text-xs mt-1 font-mono">Waiting for a match</p>
            </div>
            <button onClick={() => { doExit(false); setStatus('idle'); }} className="px-6 py-2.5 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl font-bold text-sm transition-all">
                Cancel
            </button>
        </div>
    );

    // ────────────────────────────────────────────────────────────────
    // RENDER — MATCHING (premium)
    // ────────────────────────────────────────────────────────────────
    if (status === 'matching') return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 pb-28">
            <div className="max-w-2xl w-full space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black">Pick Your Match</h2>
                        <p className="text-purple-400 text-xs font-bold uppercase tracking-widest mt-0.5">Opposite gender first</p>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 px-4 py-2 rounded-xl flex items-center gap-2">
                        <Timer className="w-4 h-4 text-red-500 animate-pulse" />
                        <span className="text-xl font-black font-mono tabular-nums">{choiceTimer}s</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {choices.map((c, i) => (
                        <button key={i} onClick={() => selectPartner(c.id)} className="bg-gray-900 hover:bg-purple-600 border border-gray-800 hover:border-purple-500 p-5 rounded-[1.5rem] transition-all flex flex-col items-center gap-4 active:scale-95 group">
                            <div className="relative">
                                <img src={c.photo || generateAvatar(c.id || i)} className="w-20 h-20 rounded-2xl bg-gray-950 border-2 border-gray-800" />
                                <div className={`absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-lg text-xs font-black ${c.gender === 'female' ? 'bg-pink-500' : c.gender === 'male' ? 'bg-blue-500' : 'bg-gray-600'}`}>
                                    {c.gender === 'female' ? '♀' : c.gender === 'male' ? '♂' : '?'}
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="font-black text-sm group-hover:text-white truncate max-w-[120px]">{c.name}</p>
                                <p className="text-[10px] text-gray-600 group-hover:text-purple-200 uppercase font-bold">{c.gender || '—'}</p>
                            </div>
                            <div className="w-full py-2 bg-gray-950 group-hover:bg-white group-hover:text-purple-700 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">Connect</div>
                        </button>
                    ))}
                </div>

                <button onClick={() => { doExit(false); setStatus('idle'); }} className="w-full py-3 bg-gray-900 border border-gray-800 rounded-xl font-bold text-sm text-gray-500 hover:text-white transition-all">
                    Cancel
                </button>
            </div>
        </div>
    );

    // ────────────────────────────────────────────────────────────────
    // RENDER — CHATTING
    // ────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col overflow-hidden bg-[#050505]" style={{ height: '100dvh' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-950/95 border-b border-gray-900 shrink-0 z-10">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img src={partner?.photo || generateAvatar('x')} className="w-9 h-9 rounded-xl bg-gray-900 border border-gray-800 shrink-0" loading="lazy" />
                    <div className="min-w-0">
                        <div className="font-black text-sm flex items-center gap-1 truncate">
                            {partner?.name || 'Connecting...'}
                            {partner?.gender === 'female' && <span className="text-pink-400 text-[10px] shrink-0">♀</span>}
                            {partner?.gender === 'male' && <span className="text-blue-400 text-[10px] shrink-0">♂</span>}
                        </div>
                        <div className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${partner?.status === 'online' ? 'text-green-500' : partner?.status === 'left' ? 'text-red-400' : 'text-gray-600'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${partner?.status === 'online' ? 'bg-green-500 animate-pulse' : partner?.status === 'left' ? 'bg-red-400' : 'bg-gray-700 animate-pulse'}`} />
                            {partner?.status === 'online' ? 'Online' : partner?.status === 'left' ? 'Left chat' : 'Joining...'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button onClick={handleNext} className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl font-black text-xs transition-all active:scale-95 group">
                        Next <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                    <button onClick={handleLeave} className="p-2 bg-gray-900 hover:bg-red-500/20 border border-gray-800 hover:border-red-500/50 text-gray-500 hover:text-red-400 rounded-xl transition-all">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 opacity-20 pointer-events-none select-none">
                        <MessageSquare className="w-12 h-12 text-gray-700" />
                        <p className="text-xs font-black uppercase tracking-widest text-gray-700">Say hello!</p>
                    </div>
                )}
                {messages.map((msg, i) => {
                    if (msg.type === 'system') return (
                        <div key={msg.id || i} className="text-center py-2.5 text-[9px] font-black text-gray-700 uppercase tracking-widest">
                            — {msg.text} —
                        </div>
                    );
                    const isMe = msg.senderId === profile?.customId;
                    return (
                        <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 shadow-lg ${isMe ? 'bg-purple-600 text-white rounded-tr-sm' : 'bg-gray-900 text-gray-100 border border-gray-800/80 rounded-tl-sm'}`}>
                                <p className="text-sm leading-relaxed break-words font-medium">{msg.text}</p>
                                <p className="text-[9px] mt-1 opacity-40 text-right font-mono tabular-nums">
                                    {msg.ts ? new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef} className="h-1" />
            </div>

            {/* Input */}
            <div className="shrink-0 px-3 py-2 bg-gray-950 border-t border-gray-900" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))' }}>
                <form onSubmit={sendMessage} className="flex gap-2 max-w-3xl mx-auto">
                    <input
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        placeholder="Type a message..."
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={500}
                        className="flex-1 min-w-0 bg-gray-900 border border-gray-800 px-4 py-3 rounded-2xl outline-none focus:border-purple-500 transition-colors text-sm font-medium"
                    />
                    <button type="submit" disabled={!inputText.trim()} className="p-3 bg-purple-600 hover:bg-purple-500 rounded-2xl transition-all active:scale-95 disabled:opacity-40 shrink-0">
                        <Send className="w-5 h-5" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Chat1on1;
