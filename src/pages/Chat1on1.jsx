import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { rtdb, ref, push, set, onValue, onChildAdded, update, remove, onDisconnect, get } from '../services/firebase';
import { Send, LogOut, RefreshCw, MessageSquare, ChevronRight, Heart, Zap, Timer, Lock, Crown, Check, X, Sparkles } from 'lucide-react';
import { generateAvatar } from '../utils/helpers';

const PREMIUM_CODE = 'AKSHAT';
const MAX_MSGS = 150;

// ─── Premium Modal ─────────────────────────────────────────────────────────────
const PremiumModal = ({ onClose, onUnlock }) => {
    const [code, setCode] = useState('');
    const [err, setErr] = useState('');
    const [ok, setOk] = useState(false);
    const submit = (e) => {
        e.preventDefault();
        if (code.trim().toUpperCase() === PREMIUM_CODE) { setOk(true); setTimeout(onUnlock, 700); }
        else { setErr('Invalid code.'); setCode(''); }
    };
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
            <div className="w-full max-w-sm bg-gray-950 border border-gray-800 rounded-[2rem] p-7 space-y-6 relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-5 right-5 text-gray-600 hover:text-white"><X className="w-5 h-5" /></button>
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="p-4 bg-yellow-500/10 rounded-2xl"><Crown className="w-10 h-10 text-yellow-400" /></div>
                    <h2 className="text-2xl font-black">Premium Filter</h2>
                    <p className="text-gray-500 text-xs leading-relaxed">Pick from <span className="text-purple-400 font-bold">3 live people</span>. Opposite gender first.</p>
                </div>
                <a href="#" className="block w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl font-black text-center text-black text-sm uppercase tracking-widest">⚡ Buy Premium — ₹10</a>
                <div className="flex items-center gap-3"><div className="flex-1 h-px bg-gray-800" /><span className="text-[9px] text-gray-600 font-black uppercase tracking-widest whitespace-nowrap">or enter code</span><div className="flex-1 h-px bg-gray-800" /></div>
                <form onSubmit={submit} className="space-y-3">
                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                        <input value={code} onChange={e => { setCode(e.target.value); setErr(''); }} placeholder="Enter code..." autoComplete="off"
                            className="w-full bg-gray-900 border border-gray-800 focus:border-purple-500 rounded-xl py-3.5 pl-11 pr-4 outline-none text-center font-mono uppercase tracking-widest text-sm transition-colors" />
                    </div>
                    {err && <p className="text-red-500 text-xs text-center font-bold">{err}</p>}
                    {ok && <p className="text-green-500 text-xs text-center font-bold flex items-center justify-center gap-1"><Check className="w-3 h-3" />Unlocked!</p>}
                    <button type="submit" disabled={!code.trim() || ok} className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 rounded-xl font-black uppercase tracking-widest text-sm transition-all disabled:opacity-40 active:scale-95">
                        {ok ? '✓ Unlocked!' : 'Activate'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function Chat1on1() {
    const { profile } = useAuth();

    const [status, setStatus] = useState('idle');
    const [chatRoomId, setChatRoomId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [partner, setPartner] = useState(null);
    const [choices, setChoices] = useState([]);
    const [choiceTimer, setChoiceTimer] = useState(15);
    const [isPremium, setIsPremium] = useState(() => localStorage.getItem('rch_premium') === 'true');
    const [showModal, setShowModal] = useState(false);
    const [scanError, setScanError] = useState('');

    const endRef = useRef(null);
    const myIdRef = useRef(null); // always set BEFORE setChatRoomId / enterRoom
    const roomIdRef = useRef(null);
    const queueUnsubRef = useRef(null);
    const timerRef = useRef(null);
    const isActiveRef = useRef(false);

    // Auto-scroll on new messages
    useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // ── Room effect: driven by chatRoomId state. React auto-cleans on exit. ──
    // IMPORTANT: only reads refs (myIdRef) — never reads 'profile' to avoid stale closure.
    useEffect(() => {
        const roomId = chatRoomId;
        const uid = myIdRef.current;
        if (!roomId || !uid) {
            console.log('[Room effect] skipped — roomId:', roomId, 'uid:', uid);
            return;
        }
        console.log('[Room effect] setting up listeners for room:', roomId, 'uid:', uid);

        // Register as member
        const myMemberRef = ref(rtdb, `chats/${roomId}/members/${uid}`);
        set(myMemberRef, {
            status: 'online',
            name: profile?.displayName || 'Stranger',
            photo: profile?.photoURL || generateAvatar(uid),
            gender: profile?.gender || 'unknown',
            joinedAt: Date.now()
        }).catch(e => console.error('[Room effect] set member failed:', e));
        onDisconnect(myMemberRef).update({ status: 'offline' });

        // System connected message
        push(ref(rtdb, `chats/${roomId}/messages`), {
            type: 'system', text: '🔗 Connected! Say hello 👋', ts: Date.now()
        }).catch(e => console.error('[Room effect] push system msg failed:', e));

        // Member listener (who is in the room)
        const memUnsub = onValue(ref(rtdb, `chats/${roomId}/members`), snap => {
            if (!snap.exists()) return;
            Object.entries(snap.val()).forEach(([id, data]) => {
                if (id !== uid) setPartner(prev => ({ ...prev, id, ...data }));
            });
        });

        // Message listener — use onChildAdded so messages APPEND to array
        // This is the correct Firebase pattern for chat; it never clears existing messages
        const msgUnsub = onChildAdded(ref(rtdb, `chats/${roomId}/messages`), child => {
            const msg = { id: child.key, ...child.val() };
            console.log('[msg onChildAdded] new msg:', msg.type || 'chat', msg.text?.slice(0, 20));
            setMessages(prev => {
                // avoid duplicates
                if (prev.some(m => m.id === msg.id)) return prev;
                const next = [...prev, msg];
                return next.length > MAX_MSGS ? next.slice(-MAX_MSGS) : next;
            });
        });

        return () => {
            console.log('[Room effect] cleanup for room:', roomId);
            memUnsub();
            msgUnsub();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatRoomId]);

    // Unmount: stop everything
    useEffect(() => {
        return () => {
            isActiveRef.current = false;
            if (queueUnsubRef.current) { queueUnsubRef.current(); queueUnsubRef.current = null; }
            if (timerRef.current) clearInterval(timerRef.current);
            if (myIdRef.current) remove(ref(rtdb, `queue/1on1/${myIdRef.current}`)).catch(() => { });
        };
    }, []);

    // ── Stop just the queue listener + timer (not the room) ──
    const stopQueue = () => {
        if (queueUnsubRef.current) { queueUnsubRef.current(); queueUnsubRef.current = null; }
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (myIdRef.current) { remove(ref(rtdb, `queue/1on1/${myIdRef.current}`)).catch(() => { }); }
    };

    // ─────────────────────────────────────────────────────────────────
    // STANDARD SEARCH
    // ─────────────────────────────────────────────────────────────────
    const startStandardSearch = () => {
        const uid = profile?.customId;
        console.log('[startStandardSearch] uid:', uid);
        if (!uid) { console.error('No uid — profile not ready'); return; }

        stopQueue();
        isActiveRef.current = true;
        myIdRef.current = uid;  // MUST be set before enterRoom
        setStatus('finding');
        setPartner(null);
        setMessages([]);
        setChoices([]);
        setScanError('');

        const qRef = ref(rtdb, `queue/1on1/${uid}`);
        onDisconnect(qRef).remove();

        set(qRef, {
            id: uid,
            name: profile.displayName || 'Stranger',
            photo: profile.photoURL || generateAvatar(uid),
            gender: profile.gender || 'unknown',
            ts: Date.now()
        }).then(() => {
            if (!isActiveRef.current) return;

            // Watch queue — fires on every change, waits as long as needed
            queueUnsubRef.current = onValue(ref(rtdb, 'queue/1on1'), snap => {
                if (!isActiveRef.current) return;
                if (!snap.exists()) return;

                const queue = snap.val();
                const me = queue[uid];
                if (!me) return;

                // Someone matched me → enter room
                if (me.roomId) {
                    isActiveRef.current = false;
                    const rid = me.roomId;
                    if (queueUnsubRef.current) { queueUnsubRef.current(); queueUnsubRef.current = null; }
                    remove(qRef).catch(() => { });
                    enterRoom(rid);
                    return;
                }

                // Am I the oldest user in queue? Only then do I initiate match.
                const others = Object.entries(queue).filter(([id, e]) =>
                    id !== uid && !e.roomId
                );
                if (!others.length) return;

                const myTs = me.ts;
                const amOldest = others.every(([oid, oe]) =>
                    myTs < oe.ts || (myTs === oe.ts && uid < oid)
                );
                if (!amOldest) return; // wait for the older user to match me

                // Match with newest waiter
                others.sort(([, a], [, b]) => b.ts - a.ts);
                const [partnerId] = others[0];
                const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

                isActiveRef.current = false;
                update(ref(rtdb, 'queue/1on1'), {
                    [`${uid}/roomId`]: roomId,
                    [`${partnerId}/roomId`]: roomId,
                }).then(() => {
                    if (queueUnsubRef.current) { queueUnsubRef.current(); queueUnsubRef.current = null; }
                    remove(qRef).catch(() => { });
                    enterRoom(roomId);
                }).catch(() => { isActiveRef.current = true; }); // retry
            });
        }).catch(() => setStatus('idle'));
    };

    // ─────────────────────────────────────────────────────────────────
    // PREMIUM SCAN (snapshot only — never joins queue)
    // ─────────────────────────────────────────────────────────────────
    const startPremiumScan = async () => {
        const uid = profile?.customId;
        console.log('[startPremiumScan] uid:', uid);
        stopQueue();
        myIdRef.current = uid || null;
        setScanError('');
        setStatus('finding');
        setChoices([]);

        try {
            const snap = await get(ref(rtdb, 'queue/1on1'));
            if (!snap.exists()) { setScanError('No one online right now. Try Standard Find or wait.'); setStatus('idle'); return; }

            const queue = snap.val();
            const candidates = Object.entries(queue)
                .filter(([id, e]) => id !== uid && !e.roomId)
                .sort(([, a], [, b]) => {
                    const opp = profile?.gender === 'male' ? 'female' : 'male';
                    if (a.gender === opp && b.gender !== opp) return -1;
                    if (b.gender === opp && a.gender !== opp) return 1;
                    return a.ts - b.ts;
                })
                .slice(0, 3).map(([, v]) => v);

            console.log('[startPremiumScan] candidates found:', candidates.length);
            if (!candidates.length) { setScanError('No one in queue yet. Try Standard Find.'); setStatus('idle'); return; }
            setChoices(candidates);
            setStatus('matching');
            startChoiceTimer();
        } catch (e) { console.error('[startPremiumScan] error:', e); setScanError('Scan failed. Try again.'); setStatus('idle'); }
    };

    const startChoiceTimer = () => {
        setChoiceTimer(15);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setChoiceTimer(p => {
                if (p <= 1) { clearInterval(timerRef.current); timerRef.current = null; setStatus('idle'); return 0; }
                return p - 1;
            });
        }, 1000);
    };

    const selectPartner = async (partnerId) => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        const uid = profile?.customId;
        if (!uid || !partnerId) return;
        setStatus('finding');
        try {
            const snap = await get(ref(rtdb, `queue/1on1/${partnerId}`));
            if (!snap.exists() || snap.val()?.roomId) {
                setScanError('That person just matched. Rescanning...');
                setTimeout(() => startPremiumScan(), 1000);
                return;
            }
            const roomId = `room_p_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            await update(ref(rtdb, 'queue/1on1'), { [`${partnerId}/roomId`]: roomId });
            myIdRef.current = uid;
            enterRoom(roomId);
        } catch { setStatus('idle'); }
    };

    // ─────────────────────────────────────────────────────────────────
    // ENTER ROOM — sets refs, then triggers useEffect via setChatRoomId
    // ─────────────────────────────────────────────────────────────────
    const enterRoom = (roomId) => {
        const uid = myIdRef.current; // must already be set by caller
        console.log('[enterRoom] roomId:', roomId, 'uid:', uid);
        if (!uid || !roomId) {
            console.error('[enterRoom] ABORT — missing uid or roomId', { uid, roomId });
            return;
        }
        roomIdRef.current = roomId;
        setMessages([]);
        setPartner(null);
        setStatus('chatting');
        setChatRoomId(roomId); // ← triggers useEffect
    };

    // ─────────────────────────────────────────────────────────────────
    // EXIT / NEXT
    // ─────────────────────────────────────────────────────────────────
    const doExit = (msg = true) => {
        const rid = roomIdRef.current;
        const uid = myIdRef.current || profile?.customId;
        if (rid && uid) {
            if (msg) push(ref(rtdb, `chats/${rid}/messages`), {
                type: 'system', text: `${profile?.displayName || 'Stranger'} left.`, ts: Date.now()
            }).catch(() => { });
            update(ref(rtdb, `chats/${rid}/members/${uid}`), { status: 'left' }).catch(() => { });
        }
        stopQueue();
        isActiveRef.current = false;
        roomIdRef.current = null;
        myIdRef.current = null;
        setChatRoomId(null); // triggers useEffect cleanup
        setPartner(null);
        setMessages([]);
    };

    const handleLeave = () => { doExit(); setStatus('idle'); };
    const handleNext = () => { doExit(); setTimeout(() => startStandardSearch(), 100); };

    const sendMessage = (e) => {
        e.preventDefault();
        const rid = roomIdRef.current;
        const uid = myIdRef.current || profile?.customId;
        const text = inputText.trim();
        if (!text || !rid || !uid) return;
        push(ref(rtdb, `chats/${rid}/messages`), {
            senderId: uid,
            senderName: profile?.displayName || 'Stranger',
            text, ts: Date.now()
        }).catch(err => console.error('Send msg failed:', err));
        setInputText('');
    };

    const handlePremiumUnlock = () => {
        setIsPremium(true);
        localStorage.setItem('rch_premium', 'true');
        setShowModal(false);
        setTimeout(() => startPremiumScan(), 100);
    };

    // ─────────────────────────────────────────────────────────────────
    // IDLE
    // ─────────────────────────────────────────────────────────────────
    if (status === 'idle') return (
        <>
            {showModal && <PremiumModal onClose={() => setShowModal(false)} onUnlock={handlePremiumUnlock} />}
            <div className="flex flex-col items-center justify-center min-h-screen px-4 gap-10">
                <div className="text-center space-y-4">
                    <div className="inline-flex p-5 bg-purple-500/10 rounded-full animate-bounce">
                        <Zap className="w-12 h-12 text-purple-500" />
                    </div>
                    <h2 className="text-4xl font-black">Match Portal</h2>
                    <p className="text-gray-500 text-sm">{profile?.displayName ? `Ready, ${profile.displayName}?` : 'Find your random match.'}</p>
                    {scanError && <p className="text-yellow-500 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-2">{scanError}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                    <button onClick={startStandardSearch}
                        className="group p-8 bg-gray-900 border border-gray-800 hover:border-purple-500/50 rounded-[1.5rem] text-left space-y-4 transition-all active:scale-[0.97]">
                        <RefreshCw className="w-7 h-7 text-gray-600 group-hover:text-purple-400 group-hover:rotate-180 transition-all duration-500" />
                        <div><h3 className="text-lg font-black">Standard Find</h3><p className="text-xs text-gray-500 mt-1">Waits for people to come online.</p></div>
                    </button>
                    <button onClick={() => { if (isPremium) startPremiumScan(); else setShowModal(true); }}
                        className="group p-8 bg-yellow-500/5 border border-yellow-500/20 hover:border-yellow-400/50 rounded-[1.5rem] text-left space-y-4 transition-all active:scale-[0.97] relative overflow-hidden">
                        <div className="flex items-center gap-2">
                            <Crown className="w-7 h-7 text-yellow-400" />
                            {isPremium && <span className="text-[9px] text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Active</span>}
                        </div>
                        <div><h3 className="text-lg font-black">Premium Filter</h3><p className="text-xs text-yellow-600 font-black uppercase tracking-widest mt-1">♀♂ Opposite Focus</p></div>
                    </button>
                </div>
                {isPremium && <p className="text-xs text-green-500/50 font-bold flex items-center gap-1"><Sparkles className="w-3 h-3" />Premium Active</p>}
            </div>
        </>
    );

    // ─────────────────────────────────────────────────────────────────
    // FINDING
    // ─────────────────────────────────────────────────────────────────
    if (status === 'finding') return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-8">
            <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-[8px] border-gray-900 border-t-purple-600 animate-spin" />
                <div className="absolute inset-2 rounded-full border-[5px] border-transparent border-b-indigo-700 animate-spin" style={{ animationDuration: '0.7s', animationDirection: 'reverse' }} />
            </div>
            <div className="text-center">
                <h3 className="text-xl font-black uppercase tracking-widest">Scanning...</h3>
                <p className="text-gray-600 text-xs mt-2 font-mono">Waiting for someone to come online</p>
            </div>
            <button onClick={() => { stopQueue(); isActiveRef.current = false; setStatus('idle'); }}
                className="px-6 py-2.5 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-xl font-bold text-sm transition-all active:scale-95">
                Cancel
            </button>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────
    // MATCHING (premium picker)
    // ─────────────────────────────────────────────────────────────────
    if (status === 'matching') return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="max-w-2xl w-full space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h2 className="text-2xl font-black">Pick Your Match</h2>
                        <p className="text-purple-400 text-xs font-bold uppercase tracking-widest mt-0.5">Opposite gender shown first</p>
                    </div>
                    <div className="bg-gray-900 border border-gray-800 px-4 py-2 rounded-xl flex items-center gap-2">
                        <Timer className="w-4 h-4 text-red-500 animate-pulse" />
                        <span className="text-xl font-black font-mono tabular-nums">{choiceTimer}s</span>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {choices.map((c, i) => (
                        <button key={c.id || i} onClick={() => selectPartner(c.id)}
                            className="bg-gray-900 hover:bg-purple-700 border border-gray-800 hover:border-purple-500 p-5 rounded-[1.5rem] transition-all flex flex-col items-center gap-4 active:scale-95 group">
                            <div className="relative">
                                <img src={c.photo || generateAvatar(c.id || String(i))} className="w-20 h-20 rounded-2xl bg-gray-950 border-2 border-gray-800" />
                                <div className={`absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-lg text-xs font-black ${c.gender === 'female' ? 'bg-pink-500' : c.gender === 'male' ? 'bg-blue-500' : 'bg-gray-700'}`}>
                                    {c.gender === 'female' ? '♀' : c.gender === 'male' ? '♂' : '?'}
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="font-black text-sm group-hover:text-white">{c.name}</p>
                                <p className="text-[10px] text-gray-600 group-hover:text-purple-200 uppercase font-bold">{c.gender || '—'}</p>
                            </div>
                            <div className="w-full py-2 bg-gray-950 group-hover:bg-white group-hover:text-purple-700 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors">Connect</div>
                        </button>
                    ))}
                </div>
                <button onClick={() => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } setStatus('idle'); }}
                    className="w-full py-3 bg-gray-900 border border-gray-800 rounded-xl font-bold text-sm text-gray-500 hover:text-white hover:bg-gray-800 transition-all">Cancel</button>
            </div>
        </div>
    );

    // ─────────────────────────────────────────────────────────────────
    // CHATTING
    // ─────────────────────────────────────────────────────────────────
    const myId = myIdRef.current || profile?.customId;

    return (
        <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-base,#050505)' }}>
            {/* Header */}
            <div style={{ flexShrink: 0, borderBottom: '1px solid #111', background: 'rgba(5,5,5,0.97)', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <img src={partner?.photo || generateAvatar('x')} style={{ width: 38, height: 38, borderRadius: 12, border: '2px solid #222', flexShrink: 0, background: '#111' }} loading="lazy" />
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {partner?.name || 'Connecting...'}
                            {partner?.gender === 'female' && <span style={{ color: '#f472b6', fontSize: 11, flexShrink: 0 }}>♀</span>}
                            {partner?.gender === 'male' && <span style={{ color: '#60a5fa', fontSize: 11, flexShrink: 0 }}>♂</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: partner?.status === 'online' ? '#22c55e' : partner?.status === 'left' ? '#ef4444' : '#444' }} />
                            <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: partner?.status === 'online' ? '#22c55e' : partner?.status === 'left' ? '#ef4444' : '#555' }}>
                                {partner?.status === 'online' ? 'Online' : partner?.status === 'left' ? 'Left chat' : 'Joining...'}
                            </span>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 8 }}>
                    <button onClick={handleNext} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px', background: 'var(--accent,#7c3aed)', borderRadius: 12, fontWeight: 900, fontSize: 12, border: 'none', color: '#fff', cursor: 'pointer' }}>
                        Next <ChevronRight style={{ width: 13, height: 13 }} />
                    </button>
                    <button onClick={handleLeave} style={{ padding: 8, background: '#111', border: '1px solid #222', borderRadius: 12, cursor: 'pointer', color: '#666', display: 'flex', alignItems: 'center' }}>
                        <LogOut style={{ width: 16, height: 16 }} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, WebkitOverflowScrolling: 'touch' }}>
                {messages.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0.15 }}>
                        <MessageSquare style={{ width: 44, height: 44, color: '#555' }} />
                        <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#555' }}>Say hello!</p>
                    </div>
                )}
                {messages.map((msg, i) => {
                    if (msg.type === 'system') return (
                        <div key={msg.id || i} style={{ textAlign: 'center', padding: '8px 0', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#7c6a9a' }}>
                            ── {msg.text} ──
                        </div>
                    );
                    const isMe = msg.senderId === myId;
                    return (
                        <div key={msg.id || i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                            <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isMe ? 'var(--accent,#7c3aed)' : '#1a1a1a', border: isMe ? 'none' : '1px solid #2a2a2a', color: '#ffffff', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                                <p style={{ fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word', margin: 0, color: '#fff' }}>{msg.text}</p>
                                <p style={{ fontSize: 9, marginTop: 4, opacity: 0.5, textAlign: 'right', fontFamily: 'monospace', color: '#fff' }}>
                                    {msg.ts ? new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={endRef} style={{ height: 1 }} />
            </div>

            {/* Input */}
            <div style={{ flexShrink: 0, padding: '10px 12px', paddingBottom: 'max(10px,env(safe-area-inset-bottom,10px))', background: '#0a0a0a', borderTop: '1px solid #111' }}>
                <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8, maxWidth: 720, margin: '0 auto' }}>
                    <input type="text" value={inputText} onChange={e => setInputText(e.target.value)}
                        placeholder="Type a message..." autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={500}
                        style={{ flex: 1, minWidth: 0, background: '#111', border: '1px solid #222', borderRadius: 18, padding: '12px 16px', fontSize: 14, color: '#fff', outline: 'none', fontFamily: 'inherit' }}
                        onFocus={e => e.target.style.borderColor = 'var(--accent,#7c3aed)'}
                        onBlur={e => e.target.style.borderColor = '#222'}
                    />
                    <button type="submit" disabled={!inputText.trim()}
                        style={{ padding: '12px 16px', background: 'var(--accent,#7c3aed)', border: 'none', borderRadius: 18, cursor: 'pointer', color: '#fff', flexShrink: 0, opacity: inputText.trim() ? 1 : 0.4, display: 'flex', alignItems: 'center' }}>
                        <Send style={{ width: 18, height: 18 }} />
                    </button>
                </form>
            </div>
        </div>
    );
}
