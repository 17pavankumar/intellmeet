// Import the Team and User models to query and modify database documents
const Team = require('../models/teamModel');
const User = require('../models/userModel');

/**
 * @route   GET /api/teams
 * @desc    Get the current user's team workspace (create one if it doesn't exist)
 * @access  Private (Requires JWT token authentication)
 */
const getMyTeam = async (req, res) => {
  try {
    // Look for a team owned by the authenticated user
    let team = await Team.findOne({ owner: req.user._id })
      .populate('members', 'name email avatar role');

    // If no team workspace exists for this user, create one automatically
    if (!team) {
      team = await Team.create({
        name: `${req.user.name}'s Workspace`,
        owner: req.user._id,
        members: [req.user._id] // Include owner as the initial member
      });
      // Populate members for the fresh team
      team = await team.populate('members', 'name email avatar role');
    }

    return res.json(team);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * @route   POST /api/teams/members
 * @desc    Add a user to the current team workspace by email
 * @access  Private (Requires JWT token authentication)
 */
const addTeamMember = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email is required to invite team members' });
  }

  try {
    // Find the user to add by email
    const userToAdd = await User.findOne({ email: email.toLowerCase().trim() });
    if (!userToAdd) {
      return res.status(404).json({ message: 'User not found. They must register an IntellMeet account first.' });
    }

    // Find the team workspace owned by the current user
    let team = await Team.findOne({ owner: req.user._id });
    if (!team) {
      team = await Team.create({
        name: `${req.user.name}'s Workspace`,
        owner: req.user._id,
        members: [req.user._id]
      });
    }

    // Check if the user is already a member of the team workspace
    const isAlreadyMember = team.members.some(
      (memberId) => memberId.toString() === userToAdd._id.toString()
    );

    if (isAlreadyMember) {
      return res.status(400).json({ message: 'User is already a member of your team workspace' });
    }

    // Add member to workspace members array
    team.members.push(userToAdd._id);
    await team.save();

    // Populate and return updated team workspace
    const updatedTeam = await Team.findById(team._id)
      .populate('members', 'name email avatar role');

    return res.json(updatedTeam);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * @route   DELETE /api/teams/members/:userId
 * @desc    Remove a member from the team workspace
 * @access  Private (Requires JWT token authentication)
 */
const removeTeamMember = async (req, res) => {
  const { userId } = req.params;

  try {
    // Find the team workspace owned by the current user
    const team = await Team.findOne({ owner: req.user._id });
    if (!team) {
      return res.status(404).json({ message: 'Team workspace not found' });
    }

    // Owner cannot remove themselves from their own workspace
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot remove yourself (the workspace owner)' });
    }

    // Filter out the specified member ID from the team members list
    team.members = team.members.filter(
      (memberId) => memberId.toString() !== userId
    );

    await team.save();

    // Populate and return updated team workspace
    const updatedTeam = await Team.findById(team._id)
      .populate('members', 'name email avatar role');

    return res.json(updatedTeam);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMyTeam,
  addTeamMember,
  removeTeamMember
};
