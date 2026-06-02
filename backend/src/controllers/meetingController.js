// Import the Meeting model to create, find, update, and delete meeting documents in MongoDB
const Meeting = require('../models/meetingModel');

/**
 * @route   POST /api/meetings
 * @desc    Create a new meeting session
 * @access  Private (Requires JWT token authentication)
 */
const createMeeting = async (req, res) => {
  // Extract meeting fields from request body
  const { title, description, startTime } = req.body;

  try {
    // Create new meeting entry in MongoDB. 
    // Host is set to currently logged-in user (req.user._id set by protect middleware).
    // The host is also automatically added to the participants list.
    const meeting = await Meeting.create({
      title,
      description,
      startTime,
      host: req.user._id,
      participants: [req.user._id]
    });

    // Return the created meeting document with 201 Created status
    return res.status(201).json(meeting);
  } catch (error) {
    // Return server error code 500 if database creation fails
    return res.status(500).json({ message: error.message });
  }
};

/**
 * @route   GET /api/meetings
 * @desc    Fetch all meetings that the authenticated user is participating in
 * @access  Private (Requires JWT token authentication)
 */
const getMyMeetings = async (req, res) => {
  try {
    // Query database for all meetings where participants array contains the user's ID
    const meetings = await Meeting.find({
      participants: req.user._id
    })
      // Populate fields: replace User IDs in host/participants with user name, email, and avatar details
      .populate('host', 'name email avatar')
      .populate('participants', 'name email avatar')
      // Sort meeting results descending (newest meetings first) based on scheduled start date
      .sort({ startTime: -1 });

    // Return list of meeting objects
    return res.json(meetings);
  } catch (error) {
    // Return server error if query fails
    return res.status(500).json({ message: error.message });
  }
};

/**
 * @route   GET /api/meetings/:id
 * @desc    Retrieve detailed information of a single meeting by its ID
 * @access  Private (Requires JWT token authentication)
 */
const getMeetingById = async (req, res) => {
  try {
    // Find meeting by ID parameters
    const meeting = await Meeting.findById(req.params.id)
      // Populate related user references
      .populate('host', 'name email avatar')
      .populate('participants', 'name email avatar')
      .populate('actionItems.assignedTo', 'name email')
      .populate('messages.sender', 'name avatar');

    // If meeting is not found in database, return 404 Not Found error
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Access control check for restricted meetings
    if (meeting.accessType === 'restricted') {
      if (!req.user) {
        return res.status(403).json({
          message: 'This meeting is restricted. You must be signed in and invited to join.',
          isRestricted: true
        });
      }

      const hostId = meeting.host._id ? meeting.host._id.toString() : meeting.host.toString();
      const userId = req.user._id.toString();
      const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : '';

      const isHost = hostId === userId;
      const isInvited = meeting.invitedEmails && meeting.invitedEmails.some(
        email => email.toLowerCase().trim() === userEmail
      );
      const isParticipant = meeting.participants && meeting.participants.some(
        p => (p._id ? p._id.toString() : p.toString()) === userId
      );

      if (!isHost && !isInvited && !isParticipant) {
        return res.status(403).json({
          message: 'This meeting is restricted. Only invited guests are permitted to join.',
          isRestricted: true
        });
      }
    }

    // Return meeting document
    return res.json(meeting);
  } catch (error) {
    // Return server error if query fails
    return res.status(500).json({ message: error.message });
  }
};

/**
 * @route   PATCH /api/meetings/:id/access
 * @desc    Update meeting access control settings (accessType and invitedEmails)
 * @access  Private (Only meeting host can change settings)
 */
const updateMeetingAccess = async (req, res) => {
  const { accessType, invitedEmails } = req.body;

  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Authorization check: Only host user has permission to change settings
    const hostId = meeting.host._id ? meeting.host._id.toString() : meeting.host.toString();
    if (hostId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the host can modify meeting access control settings' });
    }

    if (accessType) {
      meeting.accessType = accessType;
    }

    if (invitedEmails !== undefined) {
      meeting.invitedEmails = Array.isArray(invitedEmails)
        ? invitedEmails.map(email => email.toLowerCase().trim())
        : [];
    }

    await meeting.save();

    // Populate and return updated meeting document
    const updatedMeeting = await Meeting.findById(meeting._id)
      .populate('host', 'name email avatar')
      .populate('participants', 'name email avatar')
      .populate('actionItems.assignedTo', 'name email')
      .populate('messages.sender', 'name avatar');

    return res.json(updatedMeeting);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * @route   PATCH /api/meetings/:id/status
 * @desc    Update the current status of a meeting (e.g., set to ongoing or completed)
 * @access  Private (Only meeting host can change status)
 */
const updateMeetingStatus = async (req, res) => {
  // Extract new status value from request body
  const { status } = req.body;

  try {
    // Find meeting by ID parameters
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Authorization check: Compare host ID with logged-in user ID
    if (meeting.host.toString() !== req.user._id.toString()) {
      // If not host, deny with 403 Forbidden status
      return res.status(403).json({ message: 'Only the host can update this meeting' });
    }

    // Update status
    meeting.status = status;
    
    // If meeting status is changing to 'completed', record the current timestamp as endTime and run AI pipeline
    if (status === 'completed') {
      meeting.endTime = Date.now();

      // Compile transcript from stored chat messages
      let transcriptText = '';
      if (meeting.messages && meeting.messages.length > 0) {
        // Populate sender names to give context to the AI
        const populatedMeeting = await meeting.populate('messages.sender', 'name');
        transcriptText = populatedMeeting.messages
          .map((msg) => {
            const senderName = msg.sender ? msg.sender.name : (msg.senderName || 'Participant');
            return `${senderName}: ${msg.text}`;
          })
          .join('\n');
      } else {
        transcriptText = 'No chat messages were recorded during the meeting.';
      }

      console.log(`🤖 Compiling transcript for AI. Character count: ${transcriptText.length}`);

      try {
        const { generateMeetingSummary } = require('../services/aiService');
        const Task = require('../models/taskModel');

        // Call the AI summarizer service
        const aiData = await generateMeetingSummary(transcriptText);
        
        meeting.summary = aiData.summary;
        
        // Populate meeting action items array
        meeting.actionItems = aiData.actionItems.map((item) => ({
          text: item,
          assignedTo: meeting.host,
          done: false
        }));

        // Automatically create Kanban tasks in the database for each action item
        for (const item of aiData.actionItems) {
          await Task.create({
            title: item,
            description: `Action item automatically extracted by AI from meeting: "${meeting.title}"`,
            assignedTo: meeting.host,
            createdBy: meeting.host,
            meeting: meeting._id,
            status: 'todo'
          });
        }
        
        console.log(`✅ Successfully generated AI summary and created ${aiData.actionItems.length} tasks for meeting: ${meeting.title}`);
      } catch (aiErr) {
        console.error('❌ AI summarization or task generation failed:', aiErr.message);
        meeting.summary = `AI pipeline warning: Failed to run summarizer (${aiErr.message}).`;
      }
    }

    // Save updated meeting details into database
    await meeting.save();
    
    // Return updated meeting object
    return res.json(meeting);
  } catch (error) {
    // Return server error
    return res.status(500).json({ message: error.message });
  }
};

/**
 * @route   PATCH /api/meetings/:id/summary
 * @desc    Save the AI-generated discussion summary and action items list for a meeting
 * @access  Private (Requires JWT token authentication)
 */
const saveMeetingSummary = async (req, res) => {
  // Extract summary text and action items from request body
  const { summary, actionItems } = req.body;

  try {
    // Find and update the meeting details in database
    // { new: true } option ensures we receive the updated document back instead of the old one
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      { summary, actionItems },
      { new: true }
    );

    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Return the updated meeting object
    return res.json(meeting);
  } catch (error) {
    // Return server error
    return res.status(500).json({ message: error.message });
  }
};

/**
 * @route   DELETE /api/meetings/:id
 * @desc    Remove a meeting entry from the database
 * @access  Private (Only meeting host can delete)
 */
const deleteMeeting = async (req, res) => {
  try {
    // Look up the meeting
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Authorization check: Only host user has permission to delete the meeting
    if (meeting.host.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the host can delete this meeting' });
    }

    // Delete the meeting document from MongoDB collection
    await meeting.deleteOne();
    
    // Return success confirmation message
    return res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    // Return server error
    return res.status(500).json({ message: error.message });
  }
};

// Export all controller functions for router mapping
module.exports = {
  createMeeting,
  getMyMeetings,
  getMeetingById,
  updateMeetingAccess,
  updateMeetingStatus,
  saveMeetingSummary,
  deleteMeeting
};
