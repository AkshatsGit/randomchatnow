import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { rtdb, ref, push, set, onValue, update, remove, onDisconnect } from '../services/firebase';
import { Send, LogOut, Loader2, DollarSign, RefreshCw } from 'lucide-react';
import { processPayment } from '../utils/helpers';

const Chat1on1 = () => {
    const { profile, user } = useAuth();
    const navigate = useNavigate();

    const [status, setStatus] = useState('idle'); // idle, finding, chatting
    const [chatRoomId, setChatRoomId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [partnerStatus, setPartnerStatus] = useState(null); // 'online', 'typing', 'disconnected'
    const [paymentLoading, setPaymentLoading] = useState(false);

    const messagesEndRef = useRef(null);
    const queueRef = ref(rtdb, 'queue/1on1');

    useEffect(() => {
        if (!profile) return;

        // Clean up on unmount
        return () => {
            if (chatRoomId) {
                // Inform partner we left
                update(ref(rtdb, `chats/${chatRoomId}/${profile.customId}`), { status: 'disconnected' });
            }
        };
    }, [profile, chatRoomId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const joinQueue = (premium = false) => {
        if (!profile) return;
        setStatus('finding');

        const myQueueRef = ref(rtdb, `queue/1on1/${profile.customId}`);
        const queueData = {
            id: profile.customId,
            name: profile.displayName,
            timestamp: Date.now(),
            premium,
            gender: profile.gender || 'unknown'
        };

        // If disconnect while queuing, remove from queue
        onDisconnect(myQueueRef).remove();
        set(myQueueRef, queueData);

        // Listen for match
        const matchListener = onValue(myQueueRef, (snapshot) => {
            const data = snapshot.val();
            if (data && data.matchedWith) {
                // Matched!
                setChatRoomId(data.roomId);
                setStatus('chatting');
                setupChatRoom(data.roomId);
                // Clean up queue
                remove(myQueueRef);
            }
        });

        // Background worker will match us, but let's implement naive matching here for pure client-side prototype
        const allQueueListener = onValue(ref(rtdb, 'queue/1on1'), (snapshot) => {
            const queue = snapshot.val();
            if (queue && status === 'finding') {
                for (const potentialPartnerId in queue) {
                    if (potentialPartnerId !== profile.customId) {
                        const potentialPartner = queue[potentialPartnerId];

                        // Very naive match execution (race condition prone, but works for demo)
                        // In a real app, use Firebase Cloud Functions

                        // Create room
                        const newRoomId = `${profile.customId}_${potentialPartnerId}_${Date.now()}`;

                        // Set match on both queue profiles to alert them
                        update(ref(rtdb, `queue/1on1/${profile.customId}`), { matchedWith: potentialPartnerId, roomId: newRoomId });
                        update(ref(rtdb, `queue/1on1/${potentialPartnerId}`), { matchedWith: profile.customId, roomId: newRoomId });

                        break; // matched
                    }
                }
            }
        }, { onlyOnce: true }); // Just read once when joining to see if anyone is waiting

    };

    const handlePremiumJoin = async () => {
        setPaymentLoading(true);
        try {
            const result = await processPayment(10);
            if (result.success) {
                // Premium join
                joinQueue(true);
            }
        } catch (error) {
            alert('Payment failed.');
        } finally {
            setPaymentLoading(false);
        }
    };

    const setupChatRoom = (roomId) => {
        const messagesRef = ref(rtdb, `chats/${roomId}/messages`);
        const statusRef = ref(rtdb, `chats/${roomId}/status`);

        // Listen for new messages
        onValue(messagesRef, (snapshot) => {
            if (snapshot.exists()) {
                const msgs = [];
                snapshot.forEach((child) => {
                    msgs.push({ id: child.key, ...child.val() });
                });
                setMessages(msgs);
            } else {
                setMessages([]);
            }
        });

        // Initialize my status
        update(ref(rtdb, `chats/${roomId}/members/${profile.customId}`), { status: 'online', name: profile.displayName });

        // Listen for partner status
        onValue(ref(rtdb, `chats/${roomId}/members`), (snapshot) => {
            if (snapshot.exists()) {
                const members = snapshot.val();
                for (let id in members) {
                    if (id !== profile.customId) {
                        setPartnerStatus(members[id].status);
                    }
                }
            }
        });
    };

    const sendMessage = (e) => {
        e.preventDefault();
        if (!inputText.trim() || !chatRoomId) return;

        const messagesRef = ref(rtdb, `chats/${chatRoomId}/messages`);
        const newMessageRef = push(messagesRef);
        set(newMessageRef, {
            senderId: profile.customId,
            senderName: profile.displayName,
            text: inputText,
            timestamp: Date.now()
        });

        setInputText('');
    };

    const leaveChat = () => {
        if (chatRoomId) {
            update(ref(rtdb, `chats/${chatRoomId}/members/${profile.customId}`), { status: 'left' });
        }
        setChatRoomId(null);
        setMessages([]);
        setStatus('idle');
        setPartnerStatus(null);
    };

    if (status === 'idle') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 space-y-8">
                <div className="text-center space-y-4">
                    <h2 className="text-4xl font-extrabold pb-1 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-500">
                        1-on-1 Random Chat
                    </h2>
                    <p className="text-gray-400 max-w-md mx-auto">
                        Connect instantly. Keep conversations respectful.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-6">
                    <button
                        onClick={() => joinQueue(false)}
                        className="px-8 py-4 bg-gray-800 hover:bg-gray-700 transition border border-gray-600 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-3 w-64"
                    >
                        <RefreshCw className="w-5 h-5 text-gray-300" /> Free Chat
                    </button>

                    <button
                        onClick={handlePremiumJoin}
                        disabled={paymentLoading}
                        className="relative px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition rounded-2xl font-bold shadow-xl shadow-purple-900/40 flex items-center justify-center gap-3 w-64 disabled:opacity-70"
                    >
                        {paymentLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <DollarSign className="w-5 h-5 text-yellow-300" />}
                        {paymentLoading ? 'Processing...' : 'Filter (INR 10)'}
                        <div className="absolute -top-3 -right-3 px-2 py-0.5 bg-yellow-400 text-black text-xs font-bold rounded-full shadow">PRO</div>
                    </button>
                </div>

                <div className="mt-8 text-center text-sm text-gray-500">
                    <button onClick={() => navigate('/')} className="hover:text-purple-400 transition underline">Back to home</button>
                </div>
            </div>
        );
    }

    if (status === 'finding') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 space-y-6">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-gray-700 border-t-purple-500 animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-purple-500 animate-pulse" />
                    </div>
                </div>
                <h3 className="text-2xl font-bold text-gray-200">Finding someone awesome...</h3>
                <p className="text-gray-500">Scanning the queue.</p>
                <button onClick={() => { setStatus('idle'); remove(ref(rtdb, `queue/1on1/${profile?.customId}`)); }} className="mt-8 text-gray-400 hover:text-white underline">Cancel</button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen max-w-4xl mx-auto bg-gray-950">
            {/* Header */}
            <header className="flex items-center justify-between p-4 bg-gray-900 border-b border-gray-800 shadow-xl z-10 px-6 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg font-bold text-lg">
                        ?
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-100 leading-tight">Anonymous Partner</h2>
                        <span className={`text-xs flex items-center gap-1 ${partnerStatus === 'left' ? 'text-red-400' : 'text-green-400'}`}>
                            <span className={`w-2 h-2 rounded-full ${partnerStatus === 'left' ? 'bg-red-400' : 'bg-green-400'}`}></span>
                            {partnerStatus === 'left' ? 'Disconnected' : 'Online'}
                        </span>
                    </div>
                </div>
                <button
                    onClick={leaveChat}
                    className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
                    title="Leave Chat"
                >
                    <LogOut className="w-5 h-5" />
                </button>
            </header>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3 opacity-60">
                        <MessageSquare className="w-12 h-12" />
                        <p>Say hi to your random partner!</p>
                    </div>
                )}
                {messages.map((msg) => {
                    const isMe = msg.senderId === profile.customId;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-md ${isMe ? 'bg-purple-600 text-white rounded-tr-sm' : 'bg-gray-800 text-gray-200 rounded-tl-sm border border-gray-700'}`}>
                                {!isMe && <div className="text-xs text-purple-400 font-medium mb-1">{msg.senderName}</div>}
                                <p className="leading-relaxed break-words">{msg.text}</p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={sendMessage} className="p-4 bg-gray-900 border-t border-gray-800">
                <div className="flex gap-2 p-1 bg-gray-800 rounded-2xl">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type a message..."
                        disabled={partnerStatus === 'left'}
                        className="flex-1 bg-transparent px-4 py-3 outline-none text-gray-100 placeholder-gray-500 disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={partnerStatus === 'left' || !inputText.trim()}
                        className="p-3 m-1 rounded-xl bg-purple-600 text-white hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:hover:bg-purple-600 shadow-md flex items-center justify-center aspect-square"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Chat1on1;
