import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  InputAdornment,
  CircularProgress,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Search } from '@mui/icons-material';
import { contactService } from '../../services';
import type { Contact, Department } from '../../types';
import { shellInsetSurfaceSx, shellPanelHeaderSx, shellPanelSx } from '../../styles/shell';
import { resolveMediaUrl } from '../../utils/media';

const SIDEBAR_WIDTH = 300;

interface ContactSidebarProps {
  selectedId: string | null;
  onSelect: (contact: Contact) => void;
  favoriteIds: string[];
}

const ContactSidebar: React.FC<ContactSidebarProps> = ({ selectedId, onSelect, favoriteIds }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const trimmedSearch = search.trim();
  const visibleContacts =
    trimmedSearch.length > 0
      ? contacts
      : [...contacts].sort((left, right) => {
          const leftRank = favoriteIds.includes(left.id) ? 0 : 1;
          const rightRank = favoriteIds.includes(right.id) ? 0 : 1;
          return leftRank - rightRank;
        });

  // Load departments on mount
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const depts = await contactService.getDepartments();
        setDepartments(depts);
      } catch (error) {
        console.error('Failed to load departments:', error);
      }
    };
    loadDepartments();
  }, []);

  // Fetch contacts on mount and when search/department changes
  useEffect(() => {
    const fetchContacts = async () => {
      setLoading(true);
      try {
        const response = await contactService.search(
          1, 
          100, 
          trimmedSearch || undefined,
          selectedDepartmentId || undefined
        );
        setContacts(response.data || []);
      } catch (error) {
        console.error('Failed to fetch contacts:', error);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timer = setTimeout(fetchContacts, 300);
    return () => clearTimeout(timer);
  }, [selectedDepartmentId, trimmedSearch]);

  useEffect(() => {
    if (loading || visibleContacts.length === 0) {
      return;
    }

    const hasSelectedContact = selectedId ? visibleContacts.some((contact) => contact.id === selectedId) : false;
    if (!hasSelectedContact) {
      onSelect(visibleContacts[0]);
    }
  }, [loading, onSelect, selectedId, visibleContacts]);

  return (
    <Box
      sx={{
        ...shellPanelSx,
        width: SIDEBAR_WIDTH,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Search field */}
       <Box
         sx={{
           ...shellPanelHeaderSx,
           p: 2,
         }}
       >
        <TextField
          fullWidth
          size="small"
          placeholder="Поиск по ФИО..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search color="action" />
              </InputAdornment>
            ),
          }}
           sx={{
             ...shellInsetSurfaceSx,
             mb: 1,
           }}
        />
        
        {/* Department filter */}
        <FormControl fullWidth size="small">
          <InputLabel>Отдел</InputLabel>
          <Select
            value={selectedDepartmentId}
            label="Отдел"
            onChange={(e) => setSelectedDepartmentId(e.target.value)}
          >
            <MenuItem value="">
              <em>Все отделы</em>
            </MenuItem>
            {departments.map((dept) => (
              <MenuItem key={dept.id} value={dept.id}>
                {dept.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Contact list */}
      <Box
        data-testid="contacts-sidebar-list"
        sx={{ 
        flexGrow: 1, 
        minHeight: 0,
        overflow: 'auto',
        '&::-webkit-scrollbar': {
          display: 'none',
        },
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : visibleContacts.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {search ? 'Сотрудники не найдены' : 'Нет сотрудников'}
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ px: 1.1, py: 1 }}>
            {visibleContacts.map((contact) => (
              <ListItem key={contact.id} disablePadding sx={{ mb: 0.55 }}>
                <ListItemButton
                  selected={selectedId === contact.id}
                  onClick={() => onSelect(contact)}
                  sx={{
                    py: 1.2,
                    px: 1.4,
                    borderRadius: '10px',
                    border: '1px solid transparent',
                    '&.Mui-selected': {
                      background:
                        'linear-gradient(135deg, rgba(64, 140, 171, 0.18) 0%, rgba(255,255,255,0.52) 100%)',
                      borderColor: 'rgba(76, 141, 171, 0.2)',
                      boxShadow: '0 12px 28px rgba(26, 78, 103, 0.1), inset 0 1px 0 rgba(255,255,255,0.5)',
                      '&:hover': {
                        background:
                          'linear-gradient(135deg, rgba(64, 140, 171, 0.22) 0%, rgba(255,255,255,0.56) 100%)',
                      },
                    },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar
                      src={resolveMediaUrl(contact.avatarUrl)}
                      sx={{
                        width: 42,
                        height: 42,
                        bgcolor: alpha('#1d7a8f', 0.18),
                        color: 'primary.dark',
                        boxShadow: '0 10px 22px rgba(29, 122, 143, 0.12)',
                      }}
                    >
                      {contact.firstName[0]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`${contact.lastName} ${contact.firstName}`}
                    primaryTypographyProps={{
                      noWrap: true,
                      fontWeight: selectedId === contact.id ? 600 : 400,
                    }}
                    secondary={contact.position}
                    secondaryTypographyProps={{
                      noWrap: true,
                      fontSize: '0.75rem',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default ContactSidebar;
