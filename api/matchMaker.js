// Vercel Serverless Function Example
// This could be used for advanced matching logic, paid transaction verification, or cleaning up dead users in the queue

export default function handler(request, response) {
    if (request.method === 'GET') {
        return response.status(200).json({
            success: true,
            message: "Matchmaker API is running. Advanced matching logic will be processed here.",
            timestamp: Date.now()
        });
    }

    return response.status(405).json({
        success: false,
        message: "Method Not Allowed"
    });
}
