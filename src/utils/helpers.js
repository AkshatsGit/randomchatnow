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

// Generate a random avatar URL using DiceBear (adventurer-neutral for cute fun characters)
export const generateAvatar = (seed) => {
    // We use 'adventurer' style for cute animated characters as requested
    return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&scale=110&flip=true&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
};

// Available avatar seeds for the slider
export const AVATAR_SEEDS = [
    'Buddy', 'Lucky', 'Mittens', 'Coco', 'Pepper',
    'Shadow', 'Luna', 'Oliver', 'Milo', 'Leo',
    'Tiger', 'Brave', 'Sparky', 'Jasper', 'Felix'
];

// Fetch user IP and Geography details
export const fetchGeoDetails = async () => {
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        return {
            ip: data.ip,
            city: data.city || 'Unknown',
            country: data.country_name || 'Earth',
            flag: `https://flagcdn.com/w40/${data.country_code?.toLowerCase()}.png`,
            countryCode: data.country_code
        };
    } catch (error) {
        console.error("Geo Fetch failed:", error);
        return { ip: 'unknown', city: 'Cloud', country: 'Digital', flag: '', countryCode: '' };
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
