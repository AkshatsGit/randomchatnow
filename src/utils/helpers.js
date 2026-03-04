// Generate a secure random 5-character alphanumeric ID
export const generateUserId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Generate a random fun display name
export const generateRandomName = () => {
    const adjectives = ['Happy', 'Silly', 'Brave', 'Clever', 'Swift', 'Lucky', 'Quiet', 'Fierce'];
    const nouns = ['Panda', 'Tiger', 'Eagle', 'Dolphin', 'Fox', 'Wolf', 'Bear', 'Owl'];

    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];

    return `${adj}${noun}`;
};

// Generate a random avatar URL using DiceBear
export const generateAvatar = (seed) => {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
};

// Fetch user IP address (approximate via public API)
export const fetchIP = async () => {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error("IP Fetch failed:", error);
        return "unknown";
    }
};

// Mock payment gateway for INR 10 gender filter
export const processPayment = async (amountInINR) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Mock a successful payment always
            resolve({ success: true, transactionId: `TXN${generateUserId()}${generateUserId()}` });
        }, 1500); // simulate 1.5 seconds payment delay
    });
};
