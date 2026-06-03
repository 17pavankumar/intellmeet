// Import the Meeting model to interact with the database
const Meeting = require('../models/meetingModel');

// Handler to create a new meeting
const createMeeting = async (req, res) => {
  // Extract title, description, and start time from request body
  const title = req.body.title;
  const description = req.body.description;
  const startTime = req.body.startTime;

  try {
    // Get the currently authenticated user's ID
    const currentUserId = req.user._id;

    // Create a new meeting document in MongoDB
    const meeting = await Meeting.create({
      title: title,
      description: description,
      startTime: startTime,
      host: currentUserId,
      participants: [currentUserId]
    });

    // Send the created meeting back to client with status 201
    return res.status(201).json(meeting);
  } catch (error) {
    // Return a 500 error if something fails during creation
    return res.status(500).json({ message: error.message });
  }
};

// Handler to fetch all meetings for the logged-in user
const getMyMeetings = async (req, res) => {
  try {
    // Get the current user's ID
    const currentUserId = req.user._id;

    // Query for meetings where the current user is in the participants list
    const meetings = await Meeting.find({
      participants: currentUserId
    })
      // Populate host name, email, and avatar
      .populate('host', 'name email avatar')
      // Populate participants names, emails, and avatars
      .populate('participants', 'name email avatar')
      // Sort meetings in descending order of start time
      .sort({ startTime: -1 });

    // Send the list of meetings back to client
    return res.json(meetings);
  } catch (error) {
    // Return a 500 server error on failure
    return res.status(500).json({ message: error.message });
  }
};

// Handler to get a single meeting details by its ID
const getMeetingById = async (req, res) => {
  try {
    // Extract meeting ID from URL parameters
    const meetingId = req.params.id;

    // Find the meeting document in database
    const meeting = await Meeting.findById(meetingId)
      // Populate host fields
      .populate('host', 'name email avatar')
      // Populate participants fields
      .populate('participants', 'name email avatar')
      // Populate assignedTo user details inside actionItems array
      .populate('actionItems.assignedTo', 'name email')
      // Populate sender user details inside chat messages array
      .populate('messages.sender', 'name avatar');

    // If meeting does not exist, return 404
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Check if the meeting has access restrictions
    if (meeting.accessType === 'restricted') {
      // User must be logged in to access a restricted meeting
      if (!req.user) {
        return res.status(403).json({
          message: 'This meeting is restricted. You must be signed in and invited to join.',
          isRestricted: true
        });
      }

      // Convert current user details to string variables for easy comparison
      const currentUserId = req.user._id.toString();
      const currentUserEmail = req.user.email ? req.user.email.toLowerCase().trim() : '';

      // Get host user ID as a string
      let meetingHostId = '';
      if (meeting.host && meeting.host._id) {
        meetingHostId = meeting.host._id.toString();
      } else if (meeting.host) {
        meetingHostId = meeting.host.toString();
      }

      // Check if current user is the host
      const isHost = meetingHostId === currentUserId;

      // Check if current user's email is in the invited guest emails list using a simple loop
      let isInvited = false;
      if (meeting.invitedEmails) {
        for (let i = 0; i < meeting.invitedEmails.length; i++) {
          const invitedEmail = meeting.invitedEmails[i].toLowerCase().trim();
          if (invitedEmail === currentUserEmail) {
            isInvited = true;
            break;
          }
        }
      }

      // Check if current user is already an active participant using a simple loop
      let isParticipant = false;
      if (meeting.participants) {
        for (let i = 0; i < meeting.participants.length; i++) {
          const participant = meeting.participants[i];
          let participantId = '';
          if (participant && participant._id) {
            participantId = participant._id.toString();
          } else if (participant) {
            participantId = participant.toString();
          }
          if (participantId === currentUserId) {
            isParticipant = true;
            break;
          }
        }
      }

      // If user is neither host, invited guest, nor existing participant, deny access
      if (!isHost && !isInvited && !isParticipant) {
        return res.status(403).json({
          message: 'This meeting is restricted. Only invited guests are permitted to join.',
          isRestricted: true
        });
      }
    }

    // Send the meeting document to the client
    return res.json(meeting);
  } catch (error) {
    // Return a 500 error if something fails
    return res.status(500).json({ message: error.message });
  }
};

// Handler to update access control configuration (host only)
const updateMeetingAccess = async (req, res) => {
  // Extract parameters from request body
  const accessType = req.body.accessType;
  const invitedEmails = req.body.invitedEmails;
  const meetingId = req.params.id;

  try {
    // Find the meeting document
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Check host authority
    let meetingHostId = '';
    if (meeting.host && meeting.host._id) {
      meetingHostId = meeting.host._id.toString();
    } else if (meeting.host) {
      meetingHostId = meeting.host.toString();
    }
    const currentUserId = req.user._id.toString();

    // Only host can modify access restrictions
    if (meetingHostId !== currentUserId) {
      return res.status(403).json({ message: 'Only the host can modify meeting access control settings' });
    }

    // Update access type if provided
    if (accessType) {
      meeting.accessType = accessType;
    }

    // Update guest list if provided
    if (invitedEmails !== undefined) {
      const emailList = [];
      if (Array.isArray(invitedEmails)) {
        for (let i = 0; i < invitedEmails.length; i++) {
          const email = invitedEmails[i];
          if (email) {
            emailList.push(email.toLowerCase().trim());
          }
        }
      }
      meeting.invitedEmails = emailList;
    }

    // Save changes to database
    await meeting.save();

    // Query updated meeting to send populated response
    const updatedMeeting = await Meeting.findById(meeting._id)
      .populate('host', 'name email avatar')
      .populate('participants', 'name email avatar')
      .populate('actionItems.assignedTo', 'name email')
      .populate('messages.sender', 'name avatar');

    // Return the updated meeting document
    return res.json(updatedMeeting);
  } catch (error) {
    // Return a 500 error if save or query fails
    return res.status(500).json({ message: error.message });
  }
};

// Handler to transition meeting status (e.g. from ongoing to completed)
const updateMeetingStatus = async (req, res) => {
  // Extract new status and meeting ID parameters
  const status = req.body.status;
  const meetingId = req.params.id;

  try {
    // Find the meeting document
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Get meeting host ID
    const hostId = meeting.host.toString();
    const currentUserId = req.user._id.toString();

    // Ensure the requester is the host
    if (hostId !== currentUserId) {
      return res.status(403).json({ message: 'Only the host can update this meeting' });
    }

    // Assign the new status
    meeting.status = status;
    
    // Perform finalization tasks when meeting status transitions to 'completed'
    if (status === 'completed') {
      // Record completion timestamp
      meeting.endTime = Date.now();

      // Compile the meeting chat history into a transcript text string
      let transcriptText = '';
      if (meeting.messages && meeting.messages.length > 0) {
        // Populate sender names on messages
        const populatedMeeting = await meeting.populate('messages.sender', 'name');
        const linesArray = [];
        
        // Loop through each message explicitly to form standard chat transcripts
        for (let i = 0; i < populatedMeeting.messages.length; i++) {
          const msg = populatedMeeting.messages[i];
          let senderName = 'Participant';
          
          if (msg.sender && msg.sender.name) {
            senderName = msg.sender.name;
          } else if (msg.senderName) {
            senderName = msg.senderName;
          }
          
          linesArray.push(senderName + ': ' + msg.text);
        }
        
        // Join messages with double newlines for readability
        transcriptText = linesArray.join('\n');
      } else {
        // Default text if no messages exist
        transcriptText = 'No chat messages were recorded during the meeting.';
      }

      console.log('🤖 Compiling transcript for AI. Character count: ' + transcriptText.length);

      try {
        // Load the AI service and task model dynamically
        const aiService = require('../services/aiService');
        const Task = require('../models/taskModel');

        // Call helper function to generate AI analysis summary
        const aiData = await aiService.generateMeetingSummary(transcriptText);
        
        // Save summary to meeting document
        meeting.summary = aiData.summary;
        
        // Convert extracted actions list into MongoDB objects assigned to host
        const actionItemsList = [];
        for (let i = 0; i < aiData.actionItems.length; i++) {
          const actionText = aiData.actionItems[i];
          actionItemsList.push({
            text: actionText,
            assignedTo: meeting.host,
            done: false
          });
        }
        meeting.actionItems = actionItemsList;

        // Automatically create todo tasks on Kanban board for each action item
        for (let i = 0; i < aiData.actionItems.length; i++) {
          const taskTitle = aiData.actionItems[i];
          await Task.create({
            title: taskTitle,
            description: 'Action item automatically extracted by AI from meeting: "' + meeting.title + '"',
            assignedTo: meeting.host,
            createdBy: meeting.host,
            meeting: meeting._id,
            status: 'todo'
          });
        }
        
        console.log('✅ Successfully generated AI summary and created ' + aiData.actionItems.length + ' tasks for meeting: ' + meeting.title);
      } catch (aiErr) {
        // Capture AI failure gracefully
        console.error('❌ AI summarization or task generation failed:', aiErr.message);
        meeting.summary = 'AI pipeline warning: Failed to run summarizer (' + aiErr.message + ').';
      }
    }

    // Save modifications to meeting details
    await meeting.save();
    
    // Return updated meeting document
    return res.json(meeting);
  } catch (error) {
    // Return server error
    return res.status(500).json({ message: error.message });
  }
};

// Handler to update meeting summary and action items explicitly
const saveMeetingSummary = async (req, res) => {
  const summary = req.body.summary;
  const actionItems = req.body.actionItems;
  const meetingId = req.params.id;

  try {
    // Update meeting details and query updated record
    const meeting = await Meeting.findByIdAndUpdate(
      meetingId,
      { summary: summary, actionItems: actionItems },
      { new: true }
    );

    // If meeting not found, return 404
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Return the updated meeting object
    return res.json(meeting);
  } catch (error) {
    // Return a 500 error if db operation fails
    return res.status(500).json({ message: error.message });
  }
};

// Handler to remove a meeting
const deleteMeeting = async (req, res) => {
  const meetingId = req.params.id;

  try {
    // Find meeting document
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    // Check host authorization
    const hostId = meeting.host.toString();
    const currentUserId = req.user._id.toString();

    // Only host can delete meetings
    if (hostId !== currentUserId) {
      return res.status(403).json({ message: 'Only the host can delete this meeting' });
    }

    // Delete meeting document from MongoDB
    await meeting.deleteOne();
    
    // Send confirmation message
    return res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    // Return error on database failure
    return res.status(500).json({ message: error.message });
  }
};

// Export all handlers for routes configuration mapping
module.exports = {
  createMeeting: createMeeting,
  getMyMeetings: getMyMeetings,
  getMeetingById: getMeetingById,
  updateMeetingAccess: updateMeetingAccess,
  updateMeetingStatus: updateMeetingStatus,
  saveMeetingSummary: saveMeetingSummary,
  deleteMeeting: deleteMeeting
};

