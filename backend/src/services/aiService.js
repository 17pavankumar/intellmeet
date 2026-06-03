// Load the OpenAI client library from dependencies
const OpenAIConnection = require('openai');
const OpenAI = OpenAIConnection.OpenAI;

/**
 * Service to compile a text summary of the meeting and detect tasks/action items.
 * If OpenAI keys are not configured properly, it falls back gracefully to mock simulated summaries.
 */
const generateMeetingSummary = async (transcriptText) => {
  // Retrieve the OpenAI API Key from environment variables
  const apiKey = process.env.OPENAI_API_KEY;
  
  // Flag indicating whether to use mock data instead of calling external OpenAI servers
  let isMock = false;

  // If apiKey is undefined, empty, or set to placeholder string, enable mock fallback mode
  if (!apiKey) {
    isMock = true;
  } else if (apiKey === 'your_openai_api_key_here') {
    isMock = true;
  } else if (apiKey.indexOf('YOUR_') === 0) {
    isMock = true;
  }

  // If mock mode is true, call mock summarizer helper directly
  if (isMock) {
    console.log('⚠️ OpenAI API Key is not configured in .env. Returning simulated AI summary.');
    const mockResult = getMockSummary(transcriptText);
    return mockResult;
  }

  try {
    // Instantiate the OpenAI SDK client object using local api key
    const openai = new OpenAI({ apiKey: apiKey });

    // Request text analysis completion from GPT model using structural JSON response format
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant that analyzes meeting transcripts to generate concise summaries, key points discussed, and actionable tasks/action items. Return the response as a JSON object with the following structure:\n{\n  "summary": "Short paragraph summary of the meeting",\n  "keyPoints": ["Key point 1", "Key point 2"],\n  "actionItems": ["Action item 1", "Action item 2"]\n}'
        },
        {
          role: 'user',
          content: 'Here is the meeting transcript:\n\n' + transcriptText
        }
      ],
      response_format: { type: 'json_object' }
    });

    // Parse the string message content from GPT JSON response
    const jsonContent = response.choices[0].message.content;
    const result = JSON.parse(jsonContent);

    // Extract fields safely, defaulting to empty placeholders if any key is missing
    const summary = result.summary || 'No summary generated.';
    const keyPoints = result.keyPoints || [];
    const actionItems = result.actionItems || [];

    // Return the formatted object
    return {
      summary: summary,
      keyPoints: keyPoints,
      actionItems: actionItems
    };
  } catch (error) {
    // If the external network request fails, print log and return simulated summary instead
    console.error('❌ OpenAI API call failed. Falling back to mock summary:', error.message);
    const mockResult = getMockSummary(transcriptText);
    return mockResult;
  }
};

/**
 * Returns a simulated meeting summary and tasks list for fallback safety.
 */
const getMockSummary = (transcriptText) => {
  // Truncate the transcript text to prevent huge logs
  let truncatedText = '';
  if (transcriptText.length > 100) {
    truncatedText = transcriptText.slice(0, 100) + '...';
  } else {
    truncatedText = transcriptText;
  }
  
  // Return the mock summary layout object
  return {
    summary: '[Simulated Summary] Discussion based on transcript: "' + truncatedText + '"',
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

// Export the meeting summary generation helper function
module.exports = { 
  generateMeetingSummary: generateMeetingSummary 
};

