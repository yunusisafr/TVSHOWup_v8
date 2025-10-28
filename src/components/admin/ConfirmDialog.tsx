import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmStyle?: 'primary' | 'danger';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmStyle = 'primary'
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const confirmButtonClass = confirmStyle === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-primary-500 hover:bg-primary-600';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 text-white rounded-lg transition-colors ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <div className="flex items-start space-x-4">
        <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
        <p className="text-gray-300">{message}</p>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
