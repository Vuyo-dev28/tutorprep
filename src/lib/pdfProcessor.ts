// PDF text extraction and AI regeneration service
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Extract text from PDF file
 * Note: This is a simplified version. For production, you may want to use:
 * - pdf.js for client-side extraction
 * - A server-side service for better accuracy
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        // For now, we'll use a simple approach
        // In production, use pdf.js or a server-side service
        const arrayBuffer = e.target?.result as ArrayBuffer;
        
        // Try to use Gemini's file API if available, or fallback to text extraction
        // For now, we'll show an alert that full PDF processing needs server-side implementation
        // This is a placeholder - actual PDF text extraction requires pdf.js or similar
        
        // Simulated extraction (replace with actual PDF parsing)
        resolve('PDF text extraction requires pdf.js library or server-side processing. Please implement PDF text extraction using pdf.js or a backend service.');
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Regenerate past paper content using AI
 */
export async function regeneratePastPaper(
  originalText: string,
  subject: string,
  grade: number,
  curriculum: 'CAPS' | 'IEB',
  term: number,
  year: number
): Promise<string> {
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

  const prompt = `You are an expert educational content creator for South African ${curriculum} curriculum.

I will provide you with a past exam paper for ${subject}, Grade ${grade}, Term ${term}, Year ${year}.

Your task is to:
1. Analyze the original past paper content thoroughly
2. Regenerate it in a COMPLETELY NEW format while maintaining:
   - The same difficulty level and cognitive demands
   - The same curriculum alignment (${curriculum})
   - The same subject matter and topics covered
   - The same number and types of questions
   - The same mark allocation structure
3. Create fresh questions that test the same concepts but with:
   - Completely different wording and phrasing
   - Different numbers, values, and data
   - Different contexts, scenarios, or real-world applications
   - New problem setups and approaches
   - Different examples and illustrations
4. Maintain the same structure:
   - Same sections and organization
   - Same question types (multiple choice, short answer, essay, etc.)
   - Same mark allocations per question
   - Same overall format and layout
5. Ensure all mathematical formulas, equations, and scientific concepts are accurate and correct
6. Format the output clearly with:
   - Proper headings and section titles
   - Clear question numbering
   - Appropriate spacing and organization
   - Professional exam paper appearance
7. Preserve any references to diagrams, figures, or visual elements (describe what should be there)
8. Make sure the regenerated paper is ready for use as a practice exam

Original Past Paper Content:
${originalText}

Please regenerate this past paper in a completely new format with fresh questions that test the same learning outcomes. The output should be a complete, professional exam paper ready for students to use.`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error regenerating past paper:', error);
    throw new Error('Failed to regenerate past paper. Please try again.');
  }
}

/**
 * Convert regenerated text to PDF format
 * Note: This would typically be done server-side or using a library like pdf-lib
 */
export async function textToPDF(text: string, filename: string): Promise<Blob> {
  // This is a placeholder - actual PDF generation requires pdf-lib or server-side processing
  // For now, we'll create a simple text blob that can be converted to PDF
  const blob = new Blob([text], { type: 'text/plain' });
  return blob;
}
