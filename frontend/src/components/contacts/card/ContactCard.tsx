
import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Avatar,
  Box,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material';
import {
  Email,
  Phone,
  Star,
  StarBorder,
  Message,
} from '@mui/icons-material';
import type { Contact } from '../../../types';
import { resolveMediaUrl } from '../../../utils/media';

interface ContactCardProps {
  contact: Contact;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onCompose: (contact: Contact) => void;
  onClick: (contact: Contact) => void;
}

const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  isFavorite,
  onToggleFavorite,
  onCompose,
  onClick,
}) => {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
          cursor: 'pointer',
        },
      }}
      onClick={() => onClick(contact)}
    >
      <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(contact.id);
          }}
        >
          {isFavorite ? <Star color="warning" /> : <StarBorder />}
        </IconButton>
      </Box>

      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 4 }}>
        <Avatar
          src={resolveMediaUrl(contact.avatarUrl)}
          sx={{ width: 80, height: 80, mb: 2, bgcolor: 'primary.main', fontSize: '2rem' }}
        >
          {contact.firstName[0]}
        </Avatar>
        
        <Typography variant="h6" align="center" noWrap sx={{ width: '100%', fontWeight: 'bold' }}>
          {contact.lastName} {contact.firstName}
        </Typography>
        
        <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
          {contact.position || 'Должность не указана'}
        </Typography>

        {contact.department && (
          <Chip
            label={contact.department.name}
            size="small"
            sx={{ mb: 2, maxWidth: '100%' }}
          />
        )}

        <Box sx={{ mt: 'auto', width: '100%', display: 'flex', justifyContent: 'center', gap: 1 }}>
          <Tooltip title={contact.email}>
            <IconButton size="small" color="primary" onClick={(e) => {
                e.stopPropagation();
                window.location.href = `mailto:${contact.email}`;
            }}>
              <Email />
            </IconButton>
          </Tooltip>
          {contact.phone && (
            <Tooltip title={contact.phone}>
              <IconButton size="small" color="success" onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = `tel:${contact.phone}`;
              }}>
                <Phone />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Написать сообщение">
            <IconButton size="small" color="secondary" onClick={(e) => {
                e.stopPropagation();
                onCompose(contact);
            }}>
              <Message />
            </IconButton>
          </Tooltip>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ContactCard;
