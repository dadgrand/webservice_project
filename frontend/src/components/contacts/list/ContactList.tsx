
import React, { useState, useEffect, useCallback } from 'react';
import { Box, Grid, TextField, InputAdornment, Typography, CircularProgress } from '@mui/material';
import { Search } from '@mui/icons-material';
import ContactCard from '../card/ContactCard';
import type { Contact } from '../../../types';
import { contactService } from '../../../services';
import { useMessageStore } from '../../../store/messageStore';

interface ContactListProps {
  departmentId?: string;
}

const ContactList: React.FC<ContactListProps> = ({ departmentId }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]); // Array of IDs
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  const { startCompose } = useMessageStore();

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      // Simple debounce logic by delay or just direct call for prototype
      const response = await contactService.search(1, 50, search, departmentId);
      setContacts(response.data || []);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    } finally {
      setLoading(false);
    }
  }, [search, departmentId]);

  const fetchFavorites = useCallback(async () => {
    try {
      const favs = await contactService.getFavorites();
      setFavorites(favs.map(c => c.id));
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
    fetchFavorites();
  }, [fetchContacts, fetchFavorites]); // Simple debounce could be added here

  const handleToggleFavorite = async (id: string) => {
    const isFav = favorites.includes(id);
    try {
      await contactService.toggleFavorite(id, !isFav);
      if (isFav) {
        setFavorites(favorites.filter(fid => fid !== id));
      } else {
        setFavorites([...favorites, id]);
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleCompose = (contact: Contact) => {
      // Open compose with this contact as preset recipient
      startCompose([contact.id]);
  };

  const handleClick = (contact: Contact) => {
    handleCompose(contact);
  };

  return (
    <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Поиск по ФИО, должности, телефону..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search color="action" />
              </InputAdornment>
            ),
          }}
          variant="outlined"
          sx={{ bgcolor: 'background.paper' }}
        />
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
         <Grid container spacing={3} sx={{ 
           flexGrow: 1, 
           overflowY: 'auto',
           '&::-webkit-scrollbar': {
             display: 'none',
           },
           scrollbarWidth: 'none',
           msOverflowStyle: 'none',
         }}>
            {contacts.length === 0 && (
                <Grid item xs={12}>
                    <Typography align="center" color="text.secondary">
                        Сотрудники не найдены
                    </Typography>
                </Grid>
            )}
          {contacts.map((contact) => (
            <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={contact.id}>
              <ContactCard
                contact={contact}
                isFavorite={favorites.includes(contact.id)}
                onToggleFavorite={handleToggleFavorite}
                onCompose={handleCompose}
                onClick={handleClick}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default ContactList;
