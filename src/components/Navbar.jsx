import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Home, MessageSquare, Users, LogOut,
    RefreshCw, LogIn, Sun, Zap
} from 'lucide-react';

// ── Theme persistence ──────────────────────────────────────────────────────
const getTheme = () => localStorage.getItem('rch_theme') || 'dark';
const applyTheme = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('rch_theme', t);
};

// Apply on first load (before React hydrates)
applyTheme(getTheme());

const Navbar = () => {
    const { profile, logout, loginWithGoogle, randomizeName } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [theme, setTheme] = useState(getTheme);

    const toggleTheme = () => {
        const next = theme === 'dark' ? 'neon' : 'dark';
        setTheme(next);
        applyTheme(next);
    };

    const isNeon = theme === 'neon';
    const accent = isNeon ? '#ff6b00' : '#7c3aed';
    const activeBg = isNeon ? '#ff6b00' : '#7c3aed';
    const navBg = isNeon ? 'rgba(0,0,0,0.92)' : 'rgba(5,5,5,0.85)';
    const border = isNeon ? '#2a1800' : 'rgba(255,255,255,0.06)';

    return (
        <nav style={{
            position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 50, display: 'flex', alignItems: 'stretch',
            background: navBg,
            border: `1px solid ${border}`,
            borderRadius: 28,
            boxShadow: isNeon
                ? '0 0 40px rgba(255,107,0,0.2), 0 20px 60px rgba(0,0,0,0.8)'
                : '0 20px 60px rgba(0,0,0,0.6)',
            padding: '6px 8px',
            gap: 4,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            maxWidth: 'calc(100vw - 24px)',
        }}>

            {/* Profile */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 4px 6px', borderRight: `1px solid ${border}`, marginRight: 4 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                        src={profile?.photoURL}
                        style={{ width: 36, height: 36, borderRadius: 12, border: `2px solid ${border}`, background: '#111', display: 'block' }}
                        alt=""
                    />
                    <button
                        onClick={randomizeName}
                        title="New name & avatar"
                        style={{
                            position: 'absolute', bottom: -4, right: -4,
                            width: 18, height: 18, borderRadius: 6,
                            background: accent, border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
                        }}
                    >
                        <RefreshCw style={{ width: 10, height: 10, color: '#fff' }} />
                    </button>
                </div>
                <div style={{ display: 'none', flexDirection: 'column', gap: 1 }} className="sm-show">
                    <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', lineHeight: 1, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {profile?.displayName}
                        {profile?.gender === 'female' && <span style={{ color: '#f472b6', marginLeft: 3 }}>♀</span>}
                        {profile?.gender === 'male' && <span style={{ color: '#60a5fa', marginLeft: 3 }}>♂</span>}
                    </span>
                    <span style={{ fontSize: 8, fontWeight: 700, color: isNeon ? '#a06020' : '#555', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        UC-{profile?.customId}
                    </span>
                </div>
            </div>

            {/* Nav links */}
            {[
                { path: '/', Icon: Home, label: 'Home' },
                { path: '/chat', Icon: MessageSquare, label: '1v1' },
                { path: '/groups', Icon: Users, label: 'Hubs' },
            ].map(({ path, Icon, label }) => {
                const active = location.pathname === path;
                return (
                    <button
                        key={path}
                        onClick={() => navigate(path)}
                        style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            gap: 3, padding: '8px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                            background: active ? activeBg : 'transparent',
                            color: active ? '#fff' : (isNeon ? '#a06020' : '#666'),
                            boxShadow: active && isNeon ? `0 0 14px rgba(255,107,0,0.4)` : active ? `0 0 14px rgba(124,58,237,0.35)` : 'none',
                            transition: 'all 0.2s',
                            minWidth: 48,
                        }}
                    >
                        <Icon style={{ width: 16, height: 16 }} />
                        <span style={{ fontSize: 8, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
                    </button>
                );
            })}

            {/* Theme toggle */}
            <button
                onClick={toggleTheme}
                title={isNeon ? 'Switch to Dark' : 'Switch to Neon'}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 40, height: 40, borderRadius: 16, border: `1px solid ${border}`,
                    background: 'transparent', cursor: 'pointer',
                    color: isNeon ? '#ff6b00' : '#7c3aed',
                    transition: 'all 0.2s', flexShrink: 0,
                    boxShadow: isNeon ? '0 0 10px rgba(255,107,0,0.2)' : 'none',
                }}
            >
                {isNeon ? <Sun style={{ width: 16, height: 16 }} /> : <Zap style={{ width: 16, height: 16 }} />}
            </button>

            {/* Auth */}
            <div style={{ paddingLeft: 4, borderLeft: `1px solid ${border}`, marginLeft: 4, display: 'flex', alignItems: 'center' }}>
                {profile?.isGoogle ? (
                    <button
                        onClick={logout}
                        title="Sign out"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 40, height: 40, borderRadius: 16, border: '1px solid rgba(239,68,68,0.2)',
                            background: 'rgba(239,68,68,0.08)', cursor: 'pointer', color: '#ef4444',
                        }}
                    >
                        <LogOut style={{ width: 16, height: 16 }} />
                    </button>
                ) : (
                    <button
                        onClick={loginWithGoogle}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 14px', borderRadius: 16, border: 'none',
                            background: '#fff', color: '#000', cursor: 'pointer',
                            fontWeight: 900, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase',
                            flexShrink: 0,
                        }}
                    >
                        <LogIn style={{ width: 13, height: 13 }} />
                        <span className="sm-show-inline">Google</span>
                    </button>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
