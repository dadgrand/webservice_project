import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import ContactSidebar from '../components/contacts/ContactSidebar';
import ContactDetail from '../components/contacts/ContactDetail';
import { contactService } from '../services';
import type { Contact } from '../types';
import { shellPanelSx } from '../styles/shell';

const ContactsPage: React.FC = () => {
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const favorites = await contactService.getFavorites();
        setFavoriteIds(favorites.map((contact) => contact.id));
      } catch (error) {
        console.error('Failed to load favorite contacts:', error);
      }
    };

    void loadFavorites();
  }, []);

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
  };

  const handleFavoriteChange = async (contactId: string, isFavorite: boolean) => {
    await contactService.toggleFavorite(contactId, isFavorite);
    setFavoriteIds((prev) =>
      isFavorite ? (prev.includes(contactId) ? prev : [contactId, ...prev]) : prev.filter((id) => id !== contactId)
    );
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden', flexGrow: 1, gap: 1.5 }}>
      <ContactSidebar
        selectedId={selectedContact?.id || null}
        onSelect={handleSelectContact}
        favoriteIds={favoriteIds}
      />
      <Box
        sx={{
          ...shellPanelSx,
          flexGrow: 1,
          overflow: 'hidden',
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          p: 0,
        }}
      >
        <ContactDetail
          contact={selectedContact}
          isFavorite={selectedContact ? favoriteIds.includes(selectedContact.id) : false}
          onFavoriteChange={handleFavoriteChange}
        />
      </Box>
    </Box>
  );
};

export default ContactsPage;
