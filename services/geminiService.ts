
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Game, PaymentStatus } from '../types';

/**
 * Generates a concise daily summary for the snooker club report.
 * Adheres to the latest Google GenAI SDK guidelines.
 */
export const generateDailySummaryText = async (games: Game[]): Promise<string> => {
    if (games.length === 0) {
        return "No games were played on this date.";
    }

    // Initialize with the provided environment variable
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const modelName = 'gemini-3-flash-preview';
    
    const totals = games.reduce(
        (acc, game) => {
            if(game.paymentStatus === PaymentStatus.PAID) acc.paid += game.finalPriceMAD || 0;
            if(game.paymentStatus === PaymentStatus.LOAN) acc.loan += game.finalPriceMAD || 0;
            acc.discount += game.discountMAD || 0;
            return acc;
        }, { paid: 0, loan: 0, discount: 0 });

    const prompt = `
        You are an assistant for a snooker club manager.
        Based on the following summary data for a specific day, write a short, professional summary paragraph for a PDF report.
        
        Your tone should be concise and informative.
        Start with a general statement about the day's activity.
        Mention the key financial figures: total income from paid games, any new loans, and total discounts.

        Daily Data:
        - Total Games Played: ${games.length}
        - Total Income (Paid): ${totals.paid.toFixed(2)} MAD
        - Total Outstanding (Loan): ${totals.loan.toFixed(2)} MAD
        - Total Discounts Given: ${totals.discount.toFixed(2)} MAD

        Generate only the summary paragraph.
    `;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
        });
        
        // Use property access .text as per guidelines
        return response.text || "Summary generation completed.";
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "An automated summary could not be generated at this time.";
    }
};
