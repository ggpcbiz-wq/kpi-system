const targetRepository = require('../repositories/target.repository');
const submissionRepository = require('../repositories/submission.repository');

const getAnnualObjectives = async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const [targets, submissions] = await Promise.all([
      targetRepository.findActiveForAnnualObjectives(),
      submissionRepository.findApprovedForAnnualObjectives()
    ]);
    res.status(200).json({ targets, submissions });
  } catch (error) {
    console.error('Error fetching annual objectives:', error);
    res.status(500).json({ message: 'Failed to fetch annual objectives.' });
  }
};

module.exports = { getAnnualObjectives };
