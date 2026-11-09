import { useEffect, useState } from 'react';
import { Edit, Send, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import TargetListTable from './TargetListTable';
import TargetProposalForm from './TargetProposalForm';

const loadDrafts = (storageKey) => {
  try {
    const storedDrafts = localStorage.getItem(storageKey);
    if (!storedDrafts) return { drafts: [], error: null };

    const drafts = JSON.parse(storedDrafts);
    if (!Array.isArray(drafts)) throw new Error('Stored target drafts are not a list.');

    return { drafts, error: null };
  } catch (error) {
    console.error('Failed to load saved target drafts:', error);
    return { drafts: [], error };
  }
};

const TargetProposalWorkspace = ({ targets, onSubmit, isSubmitting }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const userId = user?.id || user?.userId || user?.email || 'unknown';
  const storageKey = `kpi-system:target-drafts:v1:${userId}`;
  const [initialDraftState] = useState(() => loadDrafts(storageKey));
  const [drafts, setDrafts] = useState(initialDraftState.drafts);
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const editingDraft = drafts.find(draft => draft.id === editingDraftId) || null;

  useEffect(() => {
    if (initialDraftState.error) {
      addToast('Saved target drafts could not be loaded from this browser.', 'error');
    }
  }, [initialDraftState.error, addToast]);

  const saveDraftList = (nextDrafts, keepInMemoryOnStorageError = false) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(nextDrafts));
    } catch (error) {
      console.error('Failed to save target drafts in this browser:', error);
      addToast('Could not save target drafts in this browser.', 'error');
      if (!keepInMemoryOnStorageError) return false;
    }

    setDrafts(nextDrafts);
    return true;
  };

  const handleSaveDraft = (data) => {
    const now = new Date().toISOString();
    const nextDrafts = editingDraft
      ? drafts.map(draft => draft.id === editingDraft.id
        ? { ...draft, data, updatedAt: now }
        : draft)
      : [...drafts, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        data,
        updatedAt: now
      }];

    if (!saveDraftList(nextDrafts)) return false;

    setEditingDraftId(null);
    addToast(editingDraft ? 'Target draft updated in this browser.' : 'Target draft saved in this browser.', 'success');
    return true;
  };

  const handleSubmitDraft = async (draft) => {
    const requiredFields = [
      ['plant', 'Plant'],
      ['department', 'Department'],
      ['section', 'Section'],
      ['target_year', 'Target year'],
      ['process_category', 'Process category'],
      ['process_type', 'Process type'],
      ['metric_name', 'KPI'],
      ['objective', 'Objective'],
      ['target_value', 'Target value']
    ];
    const missingFields = requiredFields
      .filter(([field]) => !String(draft.data[field] ?? '').trim())
      .map(([, label]) => label);

    if (missingFields.length > 0) {
      addToast(`Complete these fields before submitting: ${missingFields.join(', ')}.`, 'error');
      return;
    }

    if (!await onSubmit(draft.data)) return;

    const nextDrafts = drafts.filter(item => item.id !== draft.id);
    saveDraftList(nextDrafts, true);
    if (editingDraftId === draft.id) {
      setEditingDraftId(null);
      setFormResetKey(key => key + 1);
    }
  };

  const handleSubmitForm = async (data) => {
    if (!await onSubmit(data)) return false;

    if (editingDraft) {
      saveDraftList(drafts.filter(draft => draft.id !== editingDraft.id), true);
      setEditingDraftId(null);
      setFormResetKey(key => key + 1);
    }
    return true;
  };

  const handleDeleteDraft = (draft) => {
    const nextDrafts = drafts.filter(item => item.id !== draft.id);
    if (!saveDraftList(nextDrafts)) return;
    if (editingDraftId === draft.id) {
      setEditingDraftId(null);
      setFormResetKey(key => key + 1);
    }
    addToast('Target draft deleted from this browser.', 'info');
  };

  return (
    <div className="flex flex-col space-y-8">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sm:p-8 w-full transition-colors duration-300">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {editingDraft ? 'Edit Saved Target Draft' : 'Propose Department KPI Target'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            Drafts are stored in this browser only and are not submitted until you choose Route for Approval.
          </p>
        </div>
        <TargetProposalForm
          key={editingDraft?.id || `new-${formResetKey}`}
          onSubmit={handleSubmitForm}
          onSaveDraft={handleSaveDraft}
          draftData={editingDraft?.data || null}
          isSubmitting={isSubmitting}
        />
      </div>

      {drafts.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Saved Target Drafts <span className="ml-2 text-sm text-slate-500">({drafts.length})</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-bold">Target</th>
                  <th className="px-6 py-4 font-bold">Department / Section</th>
                  <th className="px-6 py-4 font-bold">Plant</th>
                  <th className="px-6 py-4 font-bold">Year</th>
                  <th className="px-6 py-4 font-bold">Last Saved</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {drafts.map(draft => (
                  <tr key={draft.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <td className="px-6 py-4 font-semibold text-slate-800 dark:text-slate-100">
                      {draft.data.metric_name || 'Untitled target'}
                    </td>
                    <td className="px-6 py-4">
                      {draft.data.department || '--'} / {draft.data.section || '--'}
                    </td>
                    <td className="px-6 py-4">{draft.data.plant || '--'}</td>
                    <td className="px-6 py-4">{draft.data.target_year || '--'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {new Date(draft.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingDraftId(draft.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700"
                        >
                          <Edit size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSubmitDraft(draft)}
                          disabled={isSubmitting}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                        >
                          <Send size={14} /> Submit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(draft)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-900/30"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <TargetListTable targets={targets} />
    </div>
  );
};

export default TargetProposalWorkspace;
