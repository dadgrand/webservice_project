import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import ContactSidebar from '../components/contacts/ContactSidebar';
import ContactDetail from '../components/contacts/ContactDetail';
import { contactService } from '../services';
import type { Contact } from '../types';
import { shellPanelSx } from '../styles/shell';
import { useAuthStore } from '../store/authStore';

const FAVORITE_ORDER_STORAGE_PREFIX = 'hospital.favorite-contacts';

function getFavoriteStorageKey(userId: string): string {
  return `${FAVORITE_ORDER_STORAGE_PREFIX}:${userId}`;
}

function readFavoriteOrder(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(getFavoriteStorageKey(userId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function mergeFavoriteOrder(apiIds: string[], storedIds: string[]): string[] {
  const apiSet = new Set(apiIds);
  const orderedStored = storedIds.filter((id) => apiSet.has(id));
  const missing = apiIds.filter((id) => !orderedStored.includes(id));
  return [...orderedStored, ...missing];
}

function moveFavoriteByOffset(ids: string[], contactId: string, offset: -1 | 1): string[] {
  const currentIndex = ids.indexOf(contactId);
  if (currentIndex === -1) {
    return ids;
  }

  const targetIndex = currentIndex + offset;
  if (targetIndex < 0 || targetIndex >= ids.length) {
    return ids;
  }

  const next = [...ids];
  const [moved] = next.splice(currentIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

const ContactsPage: React.FC = () => {
  const currentUserId = useAuthStore((state) => state.user?.id);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const loadFavorites = async () => {
      try {
        const favorites = await contactService.getFavorites();
        const apiIds = favorites.map((contact) => contact.id);
        setFavoriteIds(mergeFavoriteOrder(apiIds, readFavoriteOrder(currentUserId)));
      } catch (error) {
        console.error('Failed to load favorite contacts:', error);
      }
    };

    void loadFavorites();
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    window.localStorage.setItem(getFavoriteStorageKey(currentUserId), JSON.stringify(favoriteIds));
  }, [currentUserId, favoriteIds]);

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
  };

  const handleFavoriteChange = async (contactId: string, isFavorite: boolean) => {
    await contactService.toggleFavorite(contactId, isFavorite);
    setFavoriteIds((prev) =>
      isFavorite ? (prev.includes(contactId) ? prev : [contactId, ...prev]) : prev.filter((id) => id !== contactId)
    );
  };

  const handleMoveFavorite = (contactId: string, offset: -1 | 1) => {
    setFavoriteIds((prev) => moveFavoriteByOffset(prev, contactId, offset));
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden', flexGrow: 1, gap: 1.5 }}>
      <ContactSidebar
        selectedId={selectedContact?.id || null}
        onSelect={handleSelectContact}
        favoriteIds={favoriteIds}
        onMoveFavorite={handleMoveFavorite}
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
