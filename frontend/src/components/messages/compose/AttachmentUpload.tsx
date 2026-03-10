
import React, { useRef } from 'react';
import { Box, Button, Chip, CircularProgress } from '@mui/material';
import { AttachFile } from '@mui/icons-material';
import { messageService } from '../../../services';
import type { MessageAttachment } from '../../../types';

interface AttachmentUploadProps {
  attachments: MessageAttachment[];
  onChange: (attachments: MessageAttachment[]) => void;
}

const AttachmentUpload: React.FC<AttachmentUploadProps> = ({ attachments, onChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploaded = await messageService.uploadAttachment(file);
      onChange([...attachments, uploaded]);
    } catch (error) {
      console.error('Upload failed:', error);
      // Show error snackbar
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (index: number) => {
    const newAttachments = [...attachments];
    newAttachments.splice(index, 1);
    onChange(newAttachments);
  };

  return (
    <Box>
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <Button
        startIcon={uploading ? <CircularProgress size={20} /> : <AttachFile />}
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        size="small"
      >
        Прикрепить файл
      </Button>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
        {attachments.map((att, index) => (
          <Chip
            key={index}
            label={att.fileName}
            onDelete={() => handleRemove(index)}
            variant="outlined"
            size="small"
            icon={<AttachFile />}
          />
        ))}
      </Box>
    </Box>
  );
};

export default AttachmentUpload;
