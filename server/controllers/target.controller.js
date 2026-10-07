const targetService = require('../services/target.service');
const targetRepository = require('../repositories/target.repository'); 
const kintoneService = require('../services/kintone.service');

const getTargets = async (req, res) => {
  try {
    const activeUserId = req.user?.userId || req.user?.id;
    if (!req.user || !activeUserId) return res.status(401).json({ message: 'Unauthorized. Invalid user context.' });
    const targets = await targetService.getDashboardTargets(req.user);
    return res.status(200).json(targets);
  } catch (error) {
    console.error('[Target Controller Error] Failed to fetch targets:', error.message, error.stack);
    return res.status(500).json({ message: 'Failed to fetch KPI targets.' });
  }
};

const createTarget = async (req, res) => {
  try {
    const newTarget = await targetService.proposeNewTarget(req.body, req.user);
    res.status(201).json(newTarget);
  } catch (error) {
    if (error.message.includes('required')) return res.status(400).json({ message: error.message });
    if (error.message.includes('Unauthorized')) return res.status(403).json({ message: error.message });
    res.status(500).json({ message: 'Internal server error while processing target proposal.' });
  }
};

const updateTargetStatus = async (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  const allowedRoleByStatus = {
    'Active': ['Administrator'],
    'Pending Final Activation': ['Top Management'],
    'Rejected': ['Top Management', 'Administrator'] 
  };

  if (!allowedRoleByStatus[status]) return res.status(400).json({ message: 'Invalid target state transition requested.' });
  if (!allowedRoleByStatus[status].includes(req.user?.role)) return res.status(403).json({ message: `Forbidden.` });

  try {
    const updatedTarget = await targetService.changeTargetStatus(id, status, remarks, req.user);

    if (status === 'Active') {
      targetRepository.findById(id).then(fullTargetRecord => {
        if (fullTargetRecord) {
          kintoneService.postTargetToMasterKpi(fullTargetRecord).catch(err => {
            console.error("[Kintone Error] Failed to post to Master KPI app:", err);
          });
        }
      }).catch(err => console.error("Post-Approval DB Fetch Failed:", err));
    }

    res.status(200).json(updatedTarget);
  } catch (error) {
    console.error('[Target Controller Error] Failed status transition:', error);
    if (error.message.includes('Unauthorized')) return res.status(403).json({ message: error.message });
    res.status(500).json({ message: 'Failed to update target status.' });
  }
};

module.exports = { getTargets, createTarget, updateTargetStatus };