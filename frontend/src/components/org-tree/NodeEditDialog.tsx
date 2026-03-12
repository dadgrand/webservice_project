import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  Typography,
  Alert,
  Divider,
} from '@mui/material';
import { Close, Delete } from '@mui/icons-material';
import { orgTreeService, contactService } from '../../services';
import type { OrgTreeNode, Contact, Department } from '../../types';

type NodeType = 'department' | 'position' | 'custom';

interface NodeEditDialogProps {
  open: boolean;
  node: OrgTreeNode | null; // null for creating new node
  parentId?: string | null; // parent node id for new nodes
  allNodes: { id: string; label: string; parentId: string | null }[]; // available parent nodes
  onClose: () => void;
  onSave: () => void; // called after save to refresh tree
  onDelete?: () => void; // called after delete
}

const NodeEditDialog: React.FC<NodeEditDialogProps> = ({
  open,
  node,
  parentId,
  allNodes,
  onClose,
  onSave,
  onDelete,
}) => {
  const isEditing = !!node;
  
  // Form state
  const [type, setType] = useState<NodeType>('position');
  const [customTitle, setCustomTitle] = useState('');
  const [customSubtitle, setCustomSubtitle] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [linkedUserId, setLinkedUserId] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  
  // Data for autocompletes
  const [users, setUsers] = useState<Contact[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  
  // UI state
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Load departments on mount
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const depts = await contactService.getDepartments();
        setDepartments(depts);
      } catch (err) {
        console.error('Failed to load departments:', err);
      }
    };
    loadDepartments();
  }, []);
  
  // Search users
  useEffect(() => {
    if (!userSearch || userSearch.length < 2) {
      setUsers([]);
      return;
    }
    
    const searchUsers = async () => {
      setLoadingUsers(true);
      try {
        const response = await contactService.search(1, 20, userSearch);
        setUsers(response.data || []);
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    
    const timer = setTimeout(searchUsers, 300);
    return () => clearTimeout(timer);
  }, [userSearch]);
  
  // Initialize form when dialog opens or node changes
  useEffect(() => {
    if (open) {
      if (node) {
        // Editing existing node
        setType((node.type as NodeType) || 'position');
        setCustomTitle(node.customTitle || '');
        setCustomSubtitle(node.customSubtitle || '');
        setCustomImageUrl(node.customImageUrl || '');
        setLinkUrl(node.linkUrl || '');
        setSelectedParentId(node.parentId);
        setLinkedUserId(node.linkedUserId);
        setDepartmentId(node.departmentId);
        
        // If node has linked user, add to users list
        if (node.linkedUser) {
          setUsers([{
            id: node.linkedUser.id,
            firstName: node.linkedUser.firstName,
            lastName: node.linkedUser.lastName,
            position: node.linkedUser.position,
            avatarUrl: node.linkedUser.avatarUrl,
            middleName: null,
            phone: null,
            phoneInternal: null,
            email: '',
            bio: null,
            department: null,
            isActive: true,
          }]);
        }
      } else {
        // Creating new node
        setType('position');
        setCustomTitle('');
        setCustomSubtitle('');
        setCustomImageUrl('');
        setLinkUrl('');
        setSelectedParentId(parentId || null);
        setLinkedUserId(null);
        setDepartmentId(null);
      }
      setError(null);
      setShowDeleteConfirm(false);
    }
  }, [open, node, parentId]);
  
  const handleSave = async () => {
    setError(null);
    
    // Validation
    if (type === 'custom' && !customTitle.trim()) {
      setError('Введите название узла');
      return;
    }
    if (type === 'position' && !linkedUserId && !customTitle.trim()) {
      setError('Выберите сотрудника или введите название');
      return;
    }
    if (type === 'department' && !departmentId && !customTitle.trim()) {
      setError('Выберите отдел или введите название');
      return;
    }
    if (selectedParentId && invalidParentIds.has(selectedParentId)) {
      setError('Нельзя сделать дочерний узел родителем текущего узла');
      return;
    }
    
    setSaving(true);
    try {
      const data: Partial<OrgTreeNode> = {
        type,
        parentId: selectedParentId,
        customTitle: customTitle || null,
        customSubtitle: customSubtitle || null,
        customImageUrl: customImageUrl || null,
        linkUrl: linkUrl || null,
        linkedUserId: type === 'position' ? linkedUserId : null,
        departmentId: type === 'department' ? departmentId : null,
        isVisible: true,
      };
      
      if (isEditing && node) {
        await orgTreeService.updateNode(node.id, data);
      } else {
        await orgTreeService.createNode(data);
      }
      
      onSave();
      onClose();
     } catch (err: unknown) {
       console.error('Failed to save node:', err);
        const message = err && typeof err === 'object' && 'response' in err 
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message 
          : 'Ошибка сохранения';
        setError(message || null);
    } finally {
      setSaving(false);
    }
  };
  
  const handleDelete = async () => {
    if (!node) return;
    
    setDeleting(true);
    try {
      await orgTreeService.deleteNode(node.id);
      onDelete?.();
      onClose();
     } catch (err: unknown) {
       console.error('Failed to delete node:', err);
        const message = err && typeof err === 'object' && 'response' in err 
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message 
          : 'Ошибка удаления';
        setError(message || null);
    } finally {
      setDeleting(false);
    }
  };
  
  const selectedUser = users.find(u => u.id === linkedUserId);
  const selectedDepartment = departments.find(d => d.id === departmentId);
  const invalidParentIds = useMemo(() => {
    if (!node?.id) {
      return new Set<string>();
    }

    const childrenByParent = new Map<string, string[]>();
    allNodes.forEach((item) => {
      if (!item.parentId) {
        return;
      }

      const children = childrenByParent.get(item.parentId) || [];
      children.push(item.id);
      childrenByParent.set(item.parentId, children);
    });

    const invalidIds = new Set<string>([node.id]);
    const queue = [node.id];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) {
        continue;
      }

      const children = childrenByParent.get(currentId) || [];
      children.forEach((childId) => {
        if (invalidIds.has(childId)) {
          return;
        }

        invalidIds.add(childId);
        queue.push(childId);
      });
    }

    return invalidIds;
  }, [allNodes, node?.id]);
  const availableParentNodes = useMemo(
    () => allNodes.filter((item) => !invalidParentIds.has(item.id)),
    [allNodes, invalidParentIds]
  );
  
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {isEditing ? 'Редактирование узла' : 'Новый узел'}
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Node Type */}
          <FormControl fullWidth size="small">
            <InputLabel>Тип узла</InputLabel>
            <Select
              value={type}
              label="Тип узла"
              onChange={(e) => setType(e.target.value as NodeType)}
            >
              <MenuItem value="position">Должность/Сотрудник</MenuItem>
              <MenuItem value="department">Отдел</MenuItem>
              <MenuItem value="custom">Произвольный</MenuItem>
            </Select>
          </FormControl>
          
          {/* Parent Node */}
          <FormControl fullWidth size="small">
            <InputLabel>Родительский узел</InputLabel>
            <Select
              value={selectedParentId || ''}
              label="Родительский узел"
              onChange={(e) => setSelectedParentId(e.target.value || null)}
            >
              <MenuItem value="">
                <em>Корневой (нет родителя)</em>
              </MenuItem>
              {availableParentNodes.map(n => (
                  <MenuItem key={n.id} value={n.id}>
                    {n.label}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          
          <Divider sx={{ my: 1 }} />
          
          {/* Position Type - Link to User */}
          {type === 'position' && (
            <Autocomplete
              options={users}
              getOptionLabel={(option) => `${option.lastName} ${option.firstName}${option.position ? ` - ${option.position}` : ''}`}
              value={selectedUser || null}
              onChange={(_, newValue) => setLinkedUserId(newValue?.id || null)}
              onInputChange={(_, newInputValue) => setUserSearch(newInputValue)}
              loading={loadingUsers}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Привязать к сотруднику"
                  size="small"
                  placeholder="Начните вводить ФИО..."
                  helperText="Если сотрудник выбран, его данные будут отображаться на узле"
                />
              )}
              noOptionsText={userSearch.length < 2 ? 'Введите минимум 2 символа' : 'Не найдено'}
            />
          )}
          
          {/* Department Type - Link to Department */}
          {type === 'department' && (
            <FormControl fullWidth size="small">
              <InputLabel>Привязать к отделу</InputLabel>
              <Select
                value={departmentId || ''}
                label="Привязать к отделу"
                onChange={(e) => setDepartmentId(e.target.value || null)}
              >
                <MenuItem value="">
                  <em>Не выбрано</em>
                </MenuItem>
                {departments.map(d => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          
          <Divider sx={{ my: 1 }} />
          
          <Typography variant="caption" color="text.secondary">
            Пользовательские данные (переопределяют привязанные):
          </Typography>
          
          {/* Custom Title */}
          <TextField
            label="Заголовок"
            fullWidth
            size="small"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder={type === 'position' ? 'Например: Главный врач' : type === 'department' ? 'Название отдела' : 'Название узла'}
            helperText={linkedUserId ? 'Переопределит должность сотрудника' : selectedDepartment ? 'Переопределит название отдела' : ''}
          />
          
          {/* Custom Subtitle */}
          <TextField
            label="Подзаголовок"
            fullWidth
            size="small"
            value={customSubtitle}
            onChange={(e) => setCustomSubtitle(e.target.value)}
            placeholder="Например: Иванов Иван Иванович"
            helperText={linkedUserId ? 'Переопределит ФИО сотрудника' : ''}
          />
          
          {/* Custom Image URL */}
          <TextField
            label="URL изображения"
            fullWidth
            size="small"
            value={customImageUrl}
            onChange={(e) => setCustomImageUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
            helperText={linkedUserId ? 'Переопределит фото сотрудника' : ''}
          />
          
          {/* Link URL */}
          <TextField
            label="Ссылка"
            fullWidth
            size="small"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com/profile"
            helperText="URL для перехода при клике на узел"
          />
        </Box>
        
        {/* Delete confirmation */}
        {isEditing && showDeleteConfirm && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              Вы уверены, что хотите удалить этот узел? Все дочерние узлы также будут удалены.
            </Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
              <Button size="small" color="error" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Удаление...' : 'Да, удалить'}
              </Button>
              <Button size="small" onClick={() => setShowDeleteConfirm(false)}>
                Отмена
              </Button>
            </Box>
          </Alert>
        )}
      </DialogContent>
      
      <DialogActions>
        {isEditing && !showDeleteConfirm && (
          <Button
            color="error"
            startIcon={<Delete />}
            onClick={() => setShowDeleteConfirm(true)}
          >
            Удалить
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose} color="inherit">
          Отмена
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? 'Сохранение...' : isEditing ? 'Сохранить' : 'Создать'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NodeEditDialog;
