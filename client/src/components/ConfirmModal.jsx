import { useState } from 'react';
import { AlertCircle, MessageSquare } from 'lucide-react';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Action", 
  message = "Are you sure you want to proceed?", 
  confirmText = "Confirm",
  isDestructive = false,
  showCommentInput = false 
}) => {
  const [comment, setComment] = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setComment(''); // Reset state on close
    onClose();
  };

  const handleConfirm = () => {
    onConfirm(comment); // Pass the comment string back to the parent
    setComment(''); // Reset state on confirm
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        <div className="p-6 text-center space-y-4 overflow-y-auto">
          <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full shrink-0 ${isDestructive ? 'bg-red-100' : 'bg-jira-success-bg'}`}>
            <AlertCircle size={24} className={isDestructive ? 'text-jira-danger' : 'text-jira-success'} />
          </div>
          
          <div>
            <h3 className="text-lg font-bold text-jira-text">{title}</h3>
            <p className="text-base text-jira-text-muted mt-2">{message}</p>
          </div>

          {showCommentInput && (
            <div className="text-left mt-6 pt-4 border-t border-jira-border">
              <label className="flex items-center text-sm font-bold text-jira-text mb-2">
                <MessageSquare size={16} className="mr-1.5 text-brand-500" />
                Optional Remarks
              </label>
              <textarea 
                className="w-full px-3 py-2 border border-jira-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 h-24 text-sm text-jira-text resize-none bg-slate-50"
                placeholder="Leave a comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 bg-slate-50 flex justify-end space-x-3 border-t border-jira-border shrink-0">
          <button 
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-jira-text bg-white border border-jira-border rounded hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded transition-colors ${
              isDestructive ? 'bg-jira-danger hover:bg-red-700' : 'bg-jira-success hover:bg-green-700'
            }`}
          >
            {confirmText}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ConfirmModal;