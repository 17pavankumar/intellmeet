const { OpenAI } = require('openai');

/**
 * AI Service Module
 * Handles generating text summaries and extracting tasks from meeting transcripts.
 * Connects to OpenAI API if a valid key is provided in environment variables,
 * otherwise falls back to a mock summary generator for safety.
 */

/**
 * Simulates or calls OpenAI service to process meeting transcript text.
 * @param {string} transcriptText - The raw text of all chat/speech in the meeting.
 * @returns {Promise<Object>} An object containing the AI summary, key points, and action items.
 */
const generateMeetingSummary = async (transcriptText) => {
  const apiKey = process.env.OPENAI_API_KEY;
  
  // Check if API key exists and is not a placeholder
  const isMock = !apiKey || apiKey === 'your_openai_api_key_here' || apiKey.startsWith('YOUR_');

  if (isMock) {
    console.log('⚠️ OpenAI API Key is not configured in .env. Returning simulated AI summary.');
    return getMockSummary(transcriptText);
  }

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant that analyzes meeting transcripts to generate concise summaries, key points discussed, and actionable tasks/action items. Return the response as a JSON object with the following structure:\n{\n  "summary": "Short paragraph summary of the meeting",\n  "keyPoints": ["Key point 1", "Key point 2"],\n  "actionItems": ["Action item 1", "Action item 2"]\n}'
        },
        {
          role: 'user',
          content: `Here is the meeting transcript:\n\n${transcriptText}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content);
    return {
      summary: result.summary || 'No summary generated.',
      keyPoints: result.keyPoints || [],
      actionItems: result.actionItems || []
    };
  } catch (error) {
    console.error('❌ OpenAI API call failed. Falling back to mock summary:', error.message);
    return getMockSummary(transcriptText);
  }
};

/**
 * Fallback function returning simulated structured meeting summaries.
 */
const getMockSummary = (transcriptText) => {
  // Prepend prefix to show it's mock
  const truncatedText = transcriptText.length > 100 ? `${transcriptText.slice(0, 100)}...` : transcriptText;
  
  return {
    summary: `[Simulated Summary] Discussion based on transcript: "${truncatedText}"`,
    actionItems: [
      'Follow up on discussed topics',
      'Schedule next sprint review',
      'Assign tasks to corresponding developers'
    ],
    keyPoints: [
      'Project requirements and architecture layout review',
      'Real-time communication setup details',
      'Task assignments and status checklist updates'
    ]
  };
};

// Export the service helper functions
module.exports = { generateMeetingSummary };
