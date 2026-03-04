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

// Mock payment gateway for INR 10 gender filter
export const processPayment = async (amountInINR) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            // Mock a successful payment always
            resolve({ success: true, transactionId: `TXN${generateUserId()}${generateUserId()}` });
        }, 1500); // simulate 1.5 seconds payment delay
    });
};
