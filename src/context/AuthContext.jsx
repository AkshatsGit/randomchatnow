import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    auth, signInAnonymously, onAuthStateChanged, signInWithPopup, googleProvider, signOut,
    rtdb, ref, set, update, onValue, onDisconnect, serverTimestamp, remove
} from '../services/firebase';
import { generateUserId, generateRandomName, generateAvatar, fetchGeoDetails } from '../utils/helpers';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                let storedProfile = JSON.parse(localStorage.getItem('randomchat_profile'));
                const geo = await fetchGeoDetails();

                if (!storedProfile || (storedProfile.uid !== firebaseUser.uid && !firebaseUser.isAnonymous)) {
                    storedProfile = {
                        uid: firebaseUser.uid,
                        customId: storedProfile?.customId || generateUserId(),
                        displayName: firebaseUser.displayName || generateRandomName(),
                        photoURL: firebaseUser.photoURL || generateAvatar(firebaseUser.uid),
                        gender: storedProfile?.gender || 'unknown',
                        isPremium: storedProfile?.isPremium || false,
                        isGoogle: !firebaseUser.isAnonymous,
                        geo: geo,
                        joinedAt: Date.now()
                    };
                    localStorage.setItem('randomchat_profile', JSON.stringify(storedProfile));
                } else {
                    storedProfile.geo = geo;
                }

                const userStatusRef = ref(rtdb, `/status/${storedProfile.customId}`);
                const activeUserRef = ref(rtdb, `/activeUsers/${storedProfile.customId}`);

                const statusData = {
                    state: 'online',
                    last_changed: serverTimestamp(),
                    name: storedProfile.displayName,
                    id: storedProfile.customId,
                    photo: storedProfile.photoURL,
                    geo: geo,
                    isGoogle: storedProfile.isGoogle,
                    gender: storedProfile.gender
                };

                onDisconnect(userStatusRef).set({ state: 'offline', last_changed: serverTimestamp() });
                onDisconnect(activeUserRef).remove();

                set(userStatusRef, statusData);
                set(activeUserRef, statusData);

                setUser(firebaseUser);
                setProfile(storedProfile);
            } else {
                signInAnonymously(auth).catch(e => console.error("Anonymous auth failed", e));
                setUser(null);
                setProfile(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const loginWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Google login failed", error);
            throw error;
        }
    };

    const logout = async () => {
        if (profile) {
            await remove(ref(rtdb, `/activeUsers/${profile.customId}`));
            await set(ref(rtdb, `/status/${profile.customId}`), { state: 'offline', last_changed: serverTimestamp() });
        }
        await signOut(auth);
        localStorage.removeItem('randomchat_profile');
    };

    const updateProfile = (updates) => {
        const newProfile = { ...profile, ...updates };
        setProfile(newProfile);
        localStorage.setItem('randomchat_profile', JSON.stringify(newProfile));

        if (profile?.customId) {
            update(ref(rtdb, `/activeUsers/${profile.customId}`), updates);
            update(ref(rtdb, `/status/${profile.customId}`), updates);
        }
    };

    const randomizeName = () => {
        if (!profile) return;
        const newName = generateRandomName();
        const newAvatar = generateAvatar(newName + profile.uid);
        updateProfile({ displayName: newName, photoURL: newAvatar });
    };

    const value = {
        user,
        profile,
        loading,
        loginWithGoogle,
        logout,
        updateProfile,
        randomizeName
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
