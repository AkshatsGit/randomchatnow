import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
    auth, signInAnonymously, onAuthStateChanged, signInWithPopup,
    googleProvider, signOut,
    rtdb, ref, set, update, onDisconnect, serverTimestamp, remove
} from '../services/firebase';
import { generateUserId, generateRandomName, generateAvatar, fetchGeoDetails } from '../utils/helpers';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

// ── How long before an anonymous session expires (ms) ──
const ANON_INACTIVITY_TIMEOUT = 35_000; // 35 seconds

// ── Generate a completely fresh anonymous profile (no localStorage) ──
const makeFreshProfile = (uid, geo) => ({
    uid,
    customId: generateUserId(),
    displayName: generateRandomName(),
    photoURL: generateAvatar(generateRandomName()),
    gender: 'unknown',
    isPremium: false,
    isGoogle: false,
    geo,
    joinedAt: Date.now()
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);

    const inactivityTimerRef = useRef(null);
    const profileRef = useRef(null); // always current without stale closure

    // Keep ref in sync
    useEffect(() => { profileRef.current = profile; }, [profile]);

    // ── Wipe anonymous user's Firebase presence ──
    const wipeAnonPresence = (p) => {
        if (!p || p.isGoogle) return;
        remove(ref(rtdb, `/activeUsers/${p.customId}`)).catch(() => { });
        remove(ref(rtdb, `/status/${p.customId}`)).catch(() => { });
        remove(ref(rtdb, `/queue/1on1/${p.customId}`)).catch(() => { });
    };

    // ── Register presence in Firebase ──
    const registerPresence = (p) => {
        const statusRef = ref(rtdb, `/status/${p.customId}`);
        const activeRef = ref(rtdb, `/activeUsers/${p.customId}`);
        const payload = {
            state: 'online',
            last_changed: serverTimestamp(),
            name: p.displayName,
            id: p.customId,
            photo: p.photoURL,
            geo: p.geo || {},
            isGoogle: p.isGoogle,
            gender: p.gender,
            email: p.email || null,
            isPremium: p.isPremium || false
        };
        onDisconnect(statusRef).set({ state: 'offline', last_changed: serverTimestamp() });
        onDisconnect(activeRef).remove();
        set(statusRef, payload).catch(() => { });
        set(activeRef, payload).catch(() => { });
    };

    // ── Reset / reinitialise anonymous session ──
    const resetAnonSession = async (firebaseUid) => {
        const old = profileRef.current;
        wipeAnonPresence(old);

        // Clear ALL anonymous localStorage remnants
        localStorage.removeItem('randomchat_profile');
        localStorage.removeItem('rch_premium');

        const geo = await fetchGeoDetails().catch(() => ({}));
        const fresh = makeFreshProfile(firebaseUid, geo);
        profileRef.current = fresh;
        setProfile(fresh);
        registerPresence(fresh);
    };

    // ── Inactivity timer (anonymous only) ──
    const resetInactivityTimer = (firebaseUid) => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(() => {
            const p = profileRef.current;
            if (p && !p.isGoogle) {
                resetAnonSession(firebaseUid);
            }
        }, ANON_INACTIVITY_TIMEOUT);
    };

    const bindActivityListeners = (firebaseUid) => {
        const handler = () => resetInactivityTimer(firebaseUid);
        const events = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
        events.forEach(e => window.addEventListener(e, handler, { passive: true }));
        resetInactivityTimer(firebaseUid); // start immediately
        return () => events.forEach(e => window.removeEventListener(e, handler));
    };

    useEffect(() => {
        let unbindActivity = null;

        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (unbindActivity) { unbindActivity(); unbindActivity = null; }
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

            if (!firebaseUser) {
                // No user → sign in anonymously
                signInAnonymously(auth).catch(e => console.error('Anon auth failed:', e));
                setLoading(false);
                return;
            }

            if (!firebaseUser.isAnonymous) {
                // ── GOOGLE USER — persist normally ──
                const stored = (() => {
                    try { return JSON.parse(localStorage.getItem('randomchat_profile')); } catch { return null; }
                })();
                const geo = await fetchGeoDetails().catch(() => ({}));

                const p = (stored?.uid === firebaseUser.uid && stored?.isGoogle)
                    ? { ...stored, geo }
                    : {
                        uid: firebaseUser.uid,
                        customId: generateUserId(),
                        displayName: firebaseUser.displayName || generateRandomName(),
                        photoURL: firebaseUser.photoURL || generateAvatar(firebaseUser.uid),
                        gender: stored?.gender || 'unknown',
                        isPremium: stored?.isPremium || false,
                        isGoogle: true,
                        email: firebaseUser.email || null,
                        geo,
                        joinedAt: Date.now()
                    };

                localStorage.setItem('randomchat_profile', JSON.stringify(p));
                setUser(firebaseUser);
                setProfile(p);
                registerPresence(p);
            } else {
                // ── ANONYMOUS USER — NEVER use localStorage, always fresh ──
                localStorage.removeItem('randomchat_profile');
                const geo = await fetchGeoDetails().catch(() => ({}));
                const fresh = makeFreshProfile(firebaseUser.uid, geo);
                profileRef.current = fresh;
                setUser(firebaseUser);
                setProfile(fresh);
                registerPresence(fresh);

                // Start the 35-second inactivity reset
                unbindActivity = bindActivityListeners(firebaseUser.uid);
            }

            setLoading(false);
        });

        return () => {
            unsub();
            if (unbindActivity) unbindActivity();
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        };
        // eslint-disable-next-line
    }, []);

    // ── Public API ───────────────────────────────────────────────────

    const loginWithGoogle = async () => {
        try { await signInWithPopup(auth, googleProvider); }
        catch (e) { console.error('Google login failed:', e); throw e; }
    };

    const logout = async () => {
        const p = profileRef.current;
        if (p) {
            wipeAnonPresence(p);
            if (p.isGoogle) {
                remove(ref(rtdb, `/activeUsers/${p.customId}`)).catch(() => { });
                set(ref(rtdb, `/status/${p.customId}`), { state: 'offline', last_changed: serverTimestamp() }).catch(() => { });
            }
        }
        await signOut(auth).catch(() => { });
        localStorage.removeItem('randomchat_profile');
        localStorage.removeItem('rch_premium');
    };

    const updateProfile = (updates) => {
        const p = profileRef.current;
        if (!p) return;
        const next = { ...p, ...updates };
        profileRef.current = next;
        setProfile(next);
        if (p.isGoogle) {
            // Only persist Google users
            localStorage.setItem('randomchat_profile', JSON.stringify(next));
        }
        update(ref(rtdb, `/activeUsers/${p.customId}`), updates).catch(() => { });
        update(ref(rtdb, `/status/${p.customId}`), updates).catch(() => { });
    };

    const randomizeName = () => {
        const p = profileRef.current;
        if (!p) return;
        const name = generateRandomName();
        const photo = generateAvatar(name + Date.now());
        updateProfile({ displayName: name, photoURL: photo });
    };

    return (
        <AuthContext.Provider value={{ user, profile, loading, loginWithGoogle, logout, updateProfile, randomizeName }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
