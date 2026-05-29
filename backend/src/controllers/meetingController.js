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

    // Return meeting document
    return res.json(meeting);
  } catch (error) {
    // Return server error if query fails
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
    
    // If meeting status is changing to 'completed', record the current timestamp as endTime
    if (status === 'completed') {
      meeting.endTime = Date.now();
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
  updateMeetingStatus,
  saveMeetingSummary,
  deleteMeeting
};
