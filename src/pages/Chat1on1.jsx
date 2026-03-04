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

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const PREMIUM_CODE = 'AKSHAT';
const MAX_MESSAGES = 200; // Cap messages to prevent memory bloat

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM MODAL
// ─────────────────────────────────────────────────────────────────────────────
const PremiumModal = ({ onClose, onUnlock }) => {
    const [code, setCode] = useState('');
    const [codeError, setCodeError] = useState('');
    const [codeSuccess, setCodeSuccess] = useState(false);

    const handleCodeSubmit = (e) => {
        e.preventDefault();
        if (code.trim().toUpperCase() === PREMIUM_CODE) {
            setCodeSuccess(true);
            setCodeError('');
            setTimeout(() => onUnlock(), 800);
        } else {
            setCodeError('Invalid code. Try again.');
            setCode('');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="w-full max-w-md bg-gray-950 border border-gray-800 rounded-[2.5rem] p-8 space-y-8 relative overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* Glow */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

                <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-gray-900 rounded-xl text-gray-500 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="p-5 bg-yellow-500/10 rounded-3xl">
                        <Crown className="w-12 h-12 text-yellow-400" />
                    </div>
                    <h2 className="text-3xl font-black">Premium Filter</h2>
                    <p className="text-gray-500 text-sm font-medium leading-relaxed max-w-xs">
                        Connect with people of the <span className="text-purple-400 font-bold">opposite gender</span> first. Pick from 3 live users before connecting.
                    </p>
                </div>

                {/* Buy Now */}
                <a
                    href="https://rzp.io/l/randomchatnow"
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full py-5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 rounded-2xl font-black text-center text-black uppercase tracking-widest text-sm transition-all shadow-xl active:scale-95"
                >
                    ⚡ Buy Premium — ₹10
                </a>

                <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-800" />
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Or enter code</span>
                    <div className="flex-1 h-px bg-gray-800" />
                </div>

                {/* Code Input */}
                <form onSubmit={handleCodeSubmit} className="space-y-3">
                    <div className="relative">
                        <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                        <input
                            type="text"
                            value={code}
                            onChange={e => { setCode(e.target.value); setCodeError(''); }}
                            placeholder="Enter premium code..."
                            className="w-full bg-gray-900 border border-gray-800 rounded-2xl py-4 pl-12 pr-5 outline-none focus:border-purple-500 transition-all font-mono text-center tracking-widest uppercase font-bold placeholder:normal-case placeholder:tracking-normal placeholder:font-normal"
                        />
                    </div>
                    {codeError && (
                        <p className="text-red-500 text-xs font-bold text-center flex items-center justify-center gap-1">
                            <X className="w-3 h-3" /> {codeError}
                        </p>
                    )}
                    {codeSuccess && (
                        <p className="text-green-500 text-xs font-bold text-center flex items-center justify-center gap-1">
                            <Check className="w-3 h-3" /> Code accepted! Unlocking...
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={!code.trim() || codeSuccess}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-500 rounded-2xl font-black uppercase tracking-widest text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    >
                        {codeSuccess ? '✓ Unlocked!' : 'Activate Code'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const Chat1on1 = () => {
    const { profile } = useAuth();

    const [status, setStatus] = useState('idle');
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [partner, setPartner] = useState(null);
    const [isPremiumUnlocked, setIsPremiumUnlocked] = useState(
        () => localStorage.getItem('rch_premium') === 'true'
    );
    const [showPremiumModal, setShowPremiumModal] = useState(false);
    const [choices, setChoices] = useState([]);
    const [choiceTimer, setChoiceTimer] = useState(15);

    const messagesEndRef = useRef(null);
    const timerRef = useRef(null);
    const roomIdRef = useRef(null);
    const unsubsRef = useRef([]); // track all onValue unsubs

    // ── Scroll to bottom ──
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Cleanup everything on unmount ──
    useEffect(() => {
        return () => {
            doCleanup(true);
        };
        // eslint-disable-next-line
    }, []);

    const doCleanup = useCallback((unmounting = false) => {
        // Stop all listeners
        unsubsRef.current.forEach(u => { try { u(); } catch (_) { } });
        unsubsRef.current = [];
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

        if (profile?.customId) {
            remove(ref(rtdb, `queue/1on1/${profile.customId}`)).catch(() => { });
        }
        if (roomIdRef.current && profile?.customId) {
            update(ref(rtdb, `chats/${roomIdRef.current}/members/${profile.customId}`), { status: 'left' }).catch(() => { });
        }
        if (!unmounting) {
            roomIdRef.current = null;
            setPartner(null);
            setMessages([]);
            setChoices([]);
        }
    }, [profile?.customId]);

    // ─────────────────────────────────────────────────────────────────
    // MATCHING ENGINE - race-condition free
    // ─────────────────────────────────────────────────────────────────
    const startSearch = useCallback((premium = false) => {
        if (!profile?.customId) return;
        doCleanup();
        setStatus('finding');

        const myId = profile.customId;
        const myRef = ref(rtdb, `queue/1on1/${myId}`);
        const myEntry = {
            id: myId,
            name: profile.displayName,
            photo: profile.photoURL || generateAvatar(myId),
            gender: profile.gender || 'unknown',
            ts: Date.now(),
            premium: premium ? 1 : 0
        };

        onDisconnect(myRef).remove();
        set(myRef, myEntry).then(() => {
            // ── Listen to MY OWN entry only for a roomId signal ──
            const selfUnsub = onValue(myRef, async (snap) => {
                if (!snap.exists()) return;
                const me = snap.val();

                // Partner has matched me → enter room
                if (me.roomId) {
                    selfUnsub();
                    unsubsRef.current = unsubsRef.current.filter(u => u !== selfUnsub);
                    remove(myRef).catch(() => { });
                    enterRoom(me.roomId);
                    return;
                }

                // I am the matchmaker (older or lower id as tiebreaker)
                // Read queue snapshot to find a partner
                try {
                    const snap2 = await get(ref(rtdb, 'queue/1on1'));
                    if (!snap2.exists()) return;
                    const queue = snap2.val();

                    // Filter valid candidates
                    const candidates = Object.entries(queue).filter(([id, entry]) =>
                        id !== myId &&
                        !entry.roomId &&       // not already matched
                        !entry.claiming        // not being claimed
                    );

                    if (candidates.length === 0) return;

                    if (premium) {
                        // Premium: sort opposite gender first
                        candidates.sort(([, a], [, b]) => {
                            const opp = profile.gender === 'male' ? 'female' : 'male';
                            if (a.gender === opp && b.gender !== opp) return -1;
                            if (b.gender === opp && a.gender !== opp) return 1;
                            return a.ts - b.ts;
                        });
                        const top3 = candidates.slice(0, 3).map(([, v]) => v);
                        setChoices(top3);
                        setStatus('matching');
                        startChoiceTimer();
                        selfUnsub();
                        unsubsRef.current = unsubsRef.current.filter(u => u !== selfUnsub);
                        return;
                    }

                    // Standard: pick oldest candidate
                    candidates.sort(([, a], [, b]) => a.ts - b.ts);
                    const [partnerId] = candidates[0];

                    // Tiebreaker: only the user with the LOWER ID initiates when timestamps differ by <500ms
                    const partnerTs = queue[partnerId].ts;
                    const tsDiff = Math.abs(me.ts - partnerTs);
                    if (me.ts > partnerTs + 500) return; // I'm clearly newer, wait
                    if (tsDiff < 500 && myId > partnerId) return; // Similar time, higher ID waits

                    const roomId = `1v1_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

                    // Claim partner atomically
                    await update(ref(rtdb, 'queue/1on1'), {
                        [`${myId}/roomId`]: roomId,
                        [`${partnerId}/roomId`]: roomId,
                        [`${myId}/claiming`]: true,
                        [`${partnerId}/claiming`]: true,
                    });

                } catch (err) {
                    console.error('Queue read error:', err);
                }
            });
            unsubsRef.current.push(selfUnsub);
        });
    }, [profile, doCleanup]);

    const startChoiceTimer = () => {
        setChoiceTimer(15);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setChoiceTimer(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    setStatus('idle');
                    if (profile?.customId) remove(ref(rtdb, `queue/1on1/${profile.customId}`)).catch(() => { });
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const selectPartner = async (partnerId) => {
        if (timerRef.current) clearInterval(timerRef.current);
        const roomId = `1v1_p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        // Signal partner
        await update(ref(rtdb, `queue/1on1/${partnerId}`), { roomId }).catch(() => { });
        remove(ref(rtdb, `queue/1on1/${profile.customId}`)).catch(() => { });
        enterRoom(roomId);
    };

    // ─────────────────────────────────────────────────────────────────
    // ENTER ROOM
    // ─────────────────────────────────────────────────────────────────
    const enterRoom = useCallback((roomId) => {
        if (!profile?.customId) return;
        roomIdRef.current = roomId;
        setStatus('chatting');
        setMessages([]);

        const myMemberRef = ref(rtdb, `chats/${roomId}/members/${profile.customId}`);
        set(myMemberRef, {
            status: 'online',
            name: profile.displayName,
            photo: profile.photoURL || generateAvatar(profile.customId),
            gender: profile.gender || 'unknown',
            joinedAt: Date.now()
        });
        onDisconnect(myMemberRef).update({ status: 'offline' });

        // Listen members
        const memUnsub = onValue(ref(rtdb, `chats/${roomId}/members`), (snap) => {
            if (!snap.exists()) return;
            Object.entries(snap.val()).forEach(([id, data]) => {
                if (id !== profile.customId) setPartner({ id, ...data });
            });
        });
        unsubsRef.current.push(memUnsub);

        // Listen messages — cap at MAX_MESSAGES
        const msgUnsub = onValue(ref(rtdb, `chats/${roomId}/messages`), (snap) => {
            const msgs = [];
            snap.forEach(c => msgs.push({ id: c.key, ...c.val() }));
            setMessages(msgs.slice(-MAX_MESSAGES));
        });
        unsubsRef.current.push(msgUnsub);

        // System: connected
        push(ref(rtdb, `chats/${roomId}/messages`), {
            type: 'system',
            text: '🔗 Connected! Say hello 👋',
            ts: Date.now()
        });
    }, [profile]);

    // ─────────────────────────────────────────────────────────────────
    // CHAT ACTIONS
    // ─────────────────────────────────────────────────────────────────
    const handleExit = useCallback(() => {
        const rid = roomIdRef.current;
        if (rid && profile?.customId) {
            push(ref(rtdb, `chats/${rid}/messages`), {
                type: 'system',
                text: `${profile.displayName} left the chat.`,
                ts: Date.now()
            });
            update(ref(rtdb, `chats/${rid}/members/${profile.customId}`), { status: 'left' }).catch(() => { });
        }
        doCleanup();
        setStatus('idle');
    }, [profile, doCleanup]);

    const nextChat = useCallback(() => {
        const rid = roomIdRef.current;
        if (rid && profile?.customId) {
            push(ref(rtdb, `chats/${rid}/messages`), {
                type: 'system',
                text: `${profile.displayName} skipped to next.`,
                ts: Date.now()
            });
            update(ref(rtdb, `chats/${rid}/members/${profile.customId}`), { status: 'left' }).catch(() => { });
        }
        doCleanup();
        setTimeout(() => startSearch(false), 150);
    }, [profile, doCleanup, startSearch]);

    const sendMessage = (e) => {
        e.preventDefault();
        const rid = roomIdRef.current;
        if (!inputText.trim() || !rid || !profile?.customId) return;
        push(ref(rtdb, `chats/${rid}/messages`), {
            senderId: profile.customId,
            text: inputText.trim(),
            ts: Date.now()
        });
        setInputText('');
    };

    const handlePremiumUnlock = () => {
        setIsPremiumUnlocked(true);
        localStorage.setItem('rch_premium', 'true');
        setShowPremiumModal(false);
        startSearch(true);
    };

    // ─────────────────────────────────────────────────────────────────
    // RENDER — IDLE
    // ─────────────────────────────────────────────────────────────────
    if (status === 'idle') {
        return (
            <>
                {showPremiumModal && (
                    <PremiumModal
                        onClose={() => setShowPremiumModal(false)}
                        onUnlock={handlePremiumUnlock}
                    />
                )}
                <div className="flex flex-col items-center justify-center min-h-screen px-4 pb-32 animate-in fade-in duration-500">
                    <div className="text-center space-y-4 mb-14">
                        <div className="inline-flex p-5 bg-purple-500/10 rounded-full text-purple-500 animate-bounce">
                            <Zap className="w-14 h-14" />
                        </div>
                        <h2 className="text-5xl font-black tracking-tight">Match Portal</h2>
                        <p className="text-gray-500 max-w-xs mx-auto font-medium text-sm">
                            {profile?.displayName ? `Ready, ${profile.displayName}?` : 'Find your random connection.'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-xl">
                        {/* Standard */}
                        <button
                            onClick={() => startSearch(false)}
                            className="group p-8 bg-gray-900 border border-gray-800 rounded-[2rem] hover:border-purple-500/60 hover:bg-gray-800/60 transition-all text-left space-y-5 active:scale-[0.98]"
                        >
                            <RefreshCw className="w-7 h-7 text-gray-600 group-hover:text-purple-400 group-hover:rotate-180 transition-all duration-500" />
                            <div>
                                <h3 className="text-lg font-black">Standard Find</h3>
                                <p className="text-xs text-gray-500 mt-1 font-medium">Free · fast · random match.</p>
                            </div>
                        </button>

                        {/* Premium */}
                        <button
                            onClick={() => {
                                if (isPremiumUnlocked) startSearch(true);
                                else setShowPremiumModal(true);
                            }}
                            className="group p-8 bg-yellow-500/5 border border-yellow-500/30 rounded-[2rem] hover:bg-yellow-500/10 hover:border-yellow-400/60 transition-all text-left space-y-5 active:scale-[0.98] relative overflow-hidden"
                        >
                            <div className="absolute -top-4 -right-4 opacity-10 group-hover:opacity-20">
                                <Heart className="w-24 h-24 text-yellow-400" />
                            </div>
                            <div className="flex items-center gap-2">
                                <Crown className="w-7 h-7 text-yellow-400" />
                                {isPremiumUnlocked && (
                                    <span className="text-[9px] font-black text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full uppercase tracking-widest">Active</span>
                                )}
                            </div>
                            <div>
                                <h3 className="text-lg font-black">Premium Filter</h3>
                                <p className="text-xs text-yellow-500/70 mt-1 font-black uppercase tracking-widest">♀♂ Opposite Focus</p>
                            </div>
                        </button>
                    </div>

                    {isPremiumUnlocked && (
                        <p className="mt-6 text-xs text-green-500/60 font-bold uppercase tracking-widest flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" /> Premium Unlocked
                        </p>
                    )}
                </div>
            </>
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // RENDER — FINDING
    // ─────────────────────────────────────────────────────────────────
    if (status === 'finding') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-10">
                <div className="relative w-28 h-28">
                    <div className="absolute inset-0 rounded-full border-[10px] border-gray-900 border-t-purple-600 animate-spin" />
                    <div className="absolute inset-2 rounded-full border-[6px] border-transparent border-b-indigo-600 animate-spin" style={{ animationDuration: '0.8s', animationDirection: 'reverse' }} />
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-xl font-black uppercase tracking-[0.2em]">Scanning...</h3>
                    <p className="text-gray-600 text-xs font-mono uppercase tracking-widest">Searching for a match</p>
                </div>
                <button
                    onClick={() => { doCleanup(); setStatus('idle'); }}
                    className="px-8 py-3 bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-2xl font-bold text-sm transition-all"
                >
                    Cancel
                </button>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // RENDER — MATCHING (premium pick)
    // ─────────────────────────────────────────────────────────────────
    if (status === 'matching') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-6 pb-32">
                <div className="max-w-3xl w-full space-y-8">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h2 className="text-3xl font-black">Pick Your Match</h2>
                            <p className="text-purple-400 text-xs font-black uppercase tracking-widest mt-1">Opposite gender priority</p>
                        </div>
                        <div className="bg-gray-900 px-5 py-3 rounded-2xl border border-gray-800 flex items-center gap-3">
                            <Timer className="w-4 h-4 text-red-500 animate-pulse" />
                            <span className="text-xl font-black font-mono tabular-nums">{choiceTimer}s</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {choices.map((c, i) => (
                            <button
                                key={i}
                                onClick={() => selectPartner(c.id)}
                                className="bg-gray-900 hover:bg-purple-600 border border-gray-800 hover:border-transparent p-6 rounded-[2rem] transition-all group flex flex-col items-center gap-5 active:scale-95"
                            >
                                <div className="relative">
                                    <img src={c.photo || generateAvatar(c.id)} className="w-24 h-24 rounded-[1.5rem] bg-gray-950 border-4 border-gray-800 shadow-xl" />
                                    <div className={`absolute -bottom-2 -right-2 px-2.5 py-1 rounded-xl shadow-xl text-xs font-black ${c.gender === 'female' ? 'bg-pink-500' : c.gender === 'male' ? 'bg-blue-500' : 'bg-gray-600'}`}>
                                        {c.gender === 'female' ? '♀' : c.gender === 'male' ? '♂' : '?'}
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="font-black text-base group-hover:text-white">{c.name}</p>
                                    <p className="text-[10px] text-gray-500 group-hover:text-purple-200 uppercase font-bold tracking-widest">{c.gender || '—'}</p>
                                </div>
                                <div className="w-full py-2.5 bg-gray-950 group-hover:bg-white group-hover:text-purple-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors">
                                    Connect
                                </div>
                            </button>
                        ))}
                    </div>

                    <button onClick={() => { doCleanup(); setStatus('idle'); }} className="w-full py-3 bg-gray-900 border border-gray-800 rounded-2xl font-bold text-sm text-gray-500 hover:text-white transition-all">
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────
    // RENDER — CHATTING
    // ─────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-screen overflow-hidden bg-[#050505]">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 bg-gray-950/90 backdrop-blur border-b border-gray-900 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <img
                        src={partner?.photo || generateAvatar('stranger')}
                        className="w-10 h-10 rounded-xl bg-gray-900 border border-gray-800 shrink-0"
                        loading="lazy"
                    />
                    <div className="min-w-0">
                        <div className="font-black text-sm truncate flex items-center gap-1">
                            {partner?.name || 'Connecting...'}
                            {partner?.gender === 'female' && <span className="text-pink-500 text-xs shrink-0">♀</span>}
                            {partner?.gender === 'male' && <span className="text-blue-500 text-xs shrink-0">♂</span>}
                        </div>
                        <div className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${partner?.status === 'online' ? 'text-green-500' : partner?.status === 'left' ? 'text-red-500' : 'text-gray-600'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${partner?.status === 'online' ? 'bg-green-500 animate-pulse' : partner?.status === 'left' ? 'bg-red-500' : 'bg-gray-700'}`} />
                            {partner?.status === 'online' ? 'Online' : partner?.status === 'left' ? 'Left' : 'Waiting...'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={nextChat}
                        className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-xs transition-all active:scale-95 group"
                    >
                        Next <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                    <button
                        onClick={handleExit}
                        className="p-2 bg-gray-900 hover:bg-red-600 text-gray-500 hover:text-white rounded-xl transition-all"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-700 opacity-30 pointer-events-none">
                        <MessageSquare className="w-10 h-10" />
                        <p className="text-xs font-black uppercase tracking-widest">Start the conversation</p>
                    </div>
                )}
                {messages.map((msg, i) => {
                    if (msg.type === 'system') return (
                        <div key={msg.id || i} className="text-center py-3 text-[9px] font-black text-gray-700 uppercase tracking-widest">
                            — {msg.text} —
                        </div>
                    );
                    const isMe = msg.senderId === profile?.customId;
                    return (
                        <div key={msg.id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isMe ? 'bg-purple-600 text-white rounded-tr-sm' : 'bg-gray-900 text-gray-200 border border-gray-800 rounded-tl-sm'}`}>
                                <p className="text-sm font-medium leading-relaxed break-words">{msg.text}</p>
                                <p className="text-[9px] mt-1 opacity-40 text-right font-mono">
                                    {msg.ts ? new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
                onSubmit={sendMessage}
                className="px-3 py-3 bg-gray-950 border-t border-gray-900 shrink-0"
                style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
            >
                <div className="flex gap-2 max-w-3xl mx-auto">
                    <input
                        type="text"
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        placeholder="Type a message..."
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                        maxLength={500}
                        className="flex-1 bg-gray-900 border border-gray-800 px-4 py-3.5 rounded-2xl outline-none focus:border-purple-500 transition-colors text-sm font-medium min-w-0"
                    />
                    <button
                        type="submit"
                        disabled={!inputText.trim()}
                        className="p-3.5 bg-purple-600 hover:bg-purple-500 rounded-2xl transition-all active:scale-95 disabled:opacity-40 shrink-0"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Chat1on1;
