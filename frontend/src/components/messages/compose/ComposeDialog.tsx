
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  IconButton,
  FormControlLabel,
  Checkbox,
  Collapse,
} from '@mui/material';
import { Close, Delete, ExpandMore, ExpandLess } from '@mui/icons-material';
import { useMessageStore } from '../../../store/messageStore';
import { messageService } from '../../../services';
import type { MessageAttachment } from '../../../types';
import RichTextEditor from './RichTextEditor';
import RecipientInput from './RecipientInput';
import AttachmentUpload from './AttachmentUpload';

function formatQuotedSender(firstName: string, lastName: string, email: string): string {
  const fullName = `${firstName} ${lastName}`.trim();
  return email ? `${fullName} &lt;${email}&gt;` : fullName;
}

const ComposeDialog: React.FC = () => {
  const { composeOpen, replyToMessage, forwardMessage, saveDraft, presetRecipientIds, editingDraft, resetComposeContext } = useMessageStore();
  const [subject, setSubject] = useState('');
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [ccIds, setCcIds] = useState<string[]>([]);
  const [bccIds, setBccIds] = useState<string[]>([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [isImportant, setIsImportant] = useState(false);
  const [sending, setSending] = useState(false);

  const closeCompose = () => {
    resetComposeContext();
  };

  // Initialize form when opening
  useEffect(() => {
    if (composeOpen) {
      if (editingDraft) {
        // Editing existing draft
        setSubject(editingDraft.subject || '');
        setRecipientIds(editingDraft.recipientIds || []);
        setCcIds(editingDraft.ccIds || []);
        setBccIds(editingDraft.bccIds || []);
        setContent(editingDraft.content || '');
        setAttachments(editingDraft.attachments || []);
        setIsImportant(editingDraft.isImportant || false);
        setShowCcBcc((editingDraft.ccIds?.length || 0) > 0 || (editingDraft.bccIds?.length || 0) > 0);
      } else if (replyToMessage) {
        setSubject(replyToMessage.subject.startsWith('Re:') ? replyToMessage.subject : `Re: ${replyToMessage.subject}`);
        setRecipientIds(presetRecipientIds.length > 0 ? presetRecipientIds : [replyToMessage.sender.id]);
        setCcIds([]);
        setBccIds([]);
        setContent(
          `<p><br><br></p><blockquote>От кого: ${formatQuotedSender(
            replyToMessage.sender.firstName,
            replyToMessage.sender.lastName,
            replyToMessage.sender.email
          )}<br>Дата: ${new Date(replyToMessage.createdAt).toLocaleString()}<br><br>${replyToMessage.content}</blockquote>`
        );
        setAttachments([]);
      } else if (forwardMessage) {
        setSubject(forwardMessage.subject.startsWith('Fwd:') ? forwardMessage.subject : `Fwd: ${forwardMessage.subject}`);
        setRecipientIds([]);
        setCcIds([]);
        setBccIds([]);
        setContent(
          `<p><br><br></p><blockquote>---------- Пересылаемое сообщение ----------<br>От кого: ${formatQuotedSender(
            forwardMessage.sender.firstName,
            forwardMessage.sender.lastName,
            forwardMessage.sender.email
          )}<br>Дата: ${new Date(forwardMessage.createdAt).toLocaleString()}<br>Тема: ${forwardMessage.subject}<br><br>${forwardMessage.content}</blockquote>`
        );
        setAttachments(forwardMessage.attachments || []); // Copy attachments? Usually yes but separate files
        // Ideally we should clone attachments or download and re-upload logic, 
        // but simple link might not work if permissions are strict. 
        // For prototype, let's just ignore attachments for now or implementing backend "forward" logic.
        // Let's just keep attachments empty for now to avoid complexity with file duplication.
        setAttachments([]); 
      } else if (presetRecipientIds && presetRecipientIds.length > 0) {
        // New message with preset recipients (from contacts)
        setSubject('');
        setRecipientIds(presetRecipientIds);
        setCcIds([]);
        setBccIds([]);
        setContent('');
        setAttachments([]);
      } else {
        // New message
        setSubject('');
        setRecipientIds([]);
        setCcIds([]);
        setBccIds([]);
        setContent('');
        setAttachments([]);
      }
      if (!editingDraft) {
        setShowCcBcc(false);
      }
      setIsImportant(editingDraft?.isImportant || false);
    }
  }, [composeOpen, replyToMessage, forwardMessage, presetRecipientIds, editingDraft]);

  const handleClose = async () => {
    // Ask to save draft if there's content
    const hasContent = subject.trim() || content.trim() || recipientIds.length > 0 || ccIds.length > 0 || bccIds.length > 0 || attachments.length > 0;
    
    if (hasContent) {
      const shouldSave = window.confirm('Сохранить черновик?');
      if (shouldSave) {
        await handleSaveDraft();
        return; // handleSaveDraft already closes the dialog
      }
    }

    closeCompose();
  };

  const handleSend = async () => {
    if (recipientIds.length === 0) {
      alert('Укажите получателя');
      return;
    }

    setSending(true);
    try {
      await messageService.send({
        subject,
        content,
        recipientIds,
        ccIds: ccIds.length > 0 ? ccIds : undefined,
        bccIds: bccIds.length > 0 ? bccIds : undefined,
        isImportant,
        attachments,
        replyToId: replyToMessage?.id,
        forwardedFromId: forwardMessage?.id,
      });
      closeCompose();
    } catch (error) {
      console.error('Failed to send:', error);
      alert('Ошибка отправки');
    } finally {
      setSending(false);
    }
  };

  const handleSaveDraft = async () => {
    setSending(true);
    try {
        await saveDraft({
            subject,
            content,
            recipientIds,
            ccIds,
            bccIds,
            isImportant,
            attachments,
            replyToId: replyToMessage?.id,
            forwardFromId: forwardMessage?.id,
        });
        // Refresh folders to update drafts count
        useMessageStore.getState().fetchFolders();
        // Refresh drafts list if we're in drafts folder
        const { currentFolderType } = useMessageStore.getState();
        if (currentFolderType === 'drafts') {
          useMessageStore.getState().fetchMessages();
        }
        closeCompose();
      } catch (_error) {
        console.error(_error);
        alert('Ошибка сохранения черновика');
    } finally {
        setSending(false);
    }
  };

  const handleDelete = async () => {
    // In draft mode "Удалить" should remove the draft from backend.
    if (editingDraft) {
      const shouldDelete = window.confirm('Удалить черновик навсегда? Он не попадет в корзину.');
      if (!shouldDelete) return;

      setSending(true);
      try {
        await messageService.deleteDraft(editingDraft.id);
        useMessageStore.getState().fetchFolders();
        if (useMessageStore.getState().currentFolderType === 'drafts') {
          await useMessageStore.getState().fetchMessages();
        }
        closeCompose();
      } catch (error) {
        console.error('Failed to delete draft:', error);
        alert('Ошибка удаления черновика');
      } finally {
        setSending(false);
      }
      return;
    }

    // For new message "Удалить" means discard without draft prompt.
    closeCompose();
  };

  return (
    <Dialog
      open={composeOpen}
      onClose={handleClose}
      fullWidth
      maxWidth="md"
      scroll="paper"
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {editingDraft ? 'Редактирование черновика' : 'Новое сообщение'}
        <IconButton onClick={handleClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, height: '60vh' }}>
        {/* To field with CC/BCC toggle */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
          <Box sx={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
            <RecipientInput
              value={recipientIds}
              onChange={setRecipientIds}
              label="Кому"
            />
          </Box>
          <Button 
            size="small" 
            onClick={() => setShowCcBcc(!showCcBcc)}
            endIcon={showCcBcc ? <ExpandLess /> : <ExpandMore />}
            sx={{ mt: { xs: 0, sm: 1 }, ml: 'auto', minWidth: 'auto', whiteSpace: 'nowrap' }}
          >
            Копия
          </Button>
        </Box>
        
        {/* CC/BCC fields */}
        <Collapse in={showCcBcc}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <RecipientInput
              value={ccIds}
              onChange={setCcIds}
              label="Копия (CC)"
            />
            <RecipientInput
              value={bccIds}
              onChange={setBccIds}
              label="Скрытая копия (BCC)"
            />
          </Box>
        </Collapse>
        
        <TextField
          label="Тема"
          fullWidth
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          size="small"
        />
        
        <Box sx={{ flexGrow: 1, minHeight: 200 }}>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Напишите ваше сообщение здесь..."
          />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <AttachmentUpload 
                attachments={attachments}
                onChange={setAttachments}
            />
            <FormControlLabel
                control={<Checkbox checked={isImportant} onChange={(e) => setIsImportant(e.target.checked)} />}
                label="Важное"
            />
        </Box>

      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="inherit">
            Отмена
        </Button>
         <Button onClick={handleDelete} color="inherit" startIcon={<Delete />} disabled={sending}>
            {editingDraft ? 'Удалить навсегда' : 'Удалить'}
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={handleSaveDraft} disabled={sending}>
            Сохранить черновик
        </Button>
        <Button onClick={handleSend} variant="contained" disabled={sending}>
            {sending ? 'Отправка...' : 'Отправить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ComposeDialog;
