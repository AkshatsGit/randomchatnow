import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, signInAnonymously, onAuthStateChanged, rtdb, ref, set, onDisconnect } from '../services/firebase';
import { generateUserId, generateRandomName } from '../utils/helpers';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        // Authenticate anonymously
        signInAnonymously(auth).catch((error) => {
            console.error("Anonymous auth failed:", error);
        });

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                // Check if profile exists in local storage
                let storedProfile = JSON.parse(localStorage.getItem('randomchat_profile'));

                if (!storedProfile) {
                    storedProfile = {
                        uid: firebaseUser.uid,
                        customId: generateUserId(),
                        displayName: generateRandomName(),
                        gender: null, // to be set if they use premium features or edit profile
                        isPremium: false
                    };
                    localStorage.setItem('randomchat_profile', JSON.stringify(storedProfile));
                }

                // Update presence in realtime database
                const userStatusRef = ref(rtdb, `/status/${storedProfile.customId}`);
                const isOfflineForDatabase = {
                    state: 'offline',
                    last_changed: new Date().getTime(),
                };
                const isOnlineForDatabase = {
                    state: 'online',
                    last_changed: new Date().getTime(),
                };

                // Remove user status on disconnect
                onDisconnect(userStatusRef).set(isOfflineForDatabase).then(() => {
                    set(userStatusRef, isOnlineForDatabase);
                });

                setUser(firebaseUser);
                setProfile(storedProfile);
            } else {
                setUser(null);
                setProfile(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const updateProfile = (updates) => {
        const newProfile = { ...profile, ...updates };
        setProfile(newProfile);
        localStorage.setItem('randomchat_profile', JSON.stringify(newProfile));
    };

    const value = {
        user,
        profile,
        updateProfile,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
