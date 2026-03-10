import {
  Card,
  CardContent,
  CardActionArea,
  Avatar,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
  alpha,
} from '@mui/material';
import {
  Phone as PhoneIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  PhoneCallback as InternalPhoneIcon,
} from '@mui/icons-material';
import type { Contact } from '../types';
import { resolveMediaUrl } from '../utils/media';

interface ContactCardProps {
  contact: Contact;
  onClick?: (contact: Contact) => void;
  compact?: boolean;
}

export default function ContactCard({ contact, onClick, compact = false }: ContactCardProps) {
  const fullName = [contact.lastName, contact.firstName, contact.middleName]
    .filter(Boolean)
    .join(' ');

  const initials = `${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`.toUpperCase();

  // Generate consistent color based on name
  const getAvatarColor = (name: string) => {
    const colors = [
      '#1976d2', '#388e3c', '#d32f2f', '#7b1fa2', 
      '#1565c0', '#00796b', '#c2185b', '#5d4037',
      '#303f9f', '#0097a7', '#689f38', '#e64a19',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const avatarColor = getAvatarColor(fullName);

  if (compact) {
    return (
      <Card
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1.5,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'all 0.2s ease',
          '&:hover': onClick ? {
            transform: 'translateY(-2px)',
            boxShadow: 3,
          } : {},
        }}
        onClick={() => onClick?.(contact)}
      >
        <Avatar
          src={resolveMediaUrl(contact.avatarUrl)}
          sx={{
            width: 40,
            height: 40,
            bgcolor: avatarColor,
            fontSize: '0.875rem',
          }}
        >
          {initials}
        </Avatar>
        <Box sx={{ ml: 1.5, minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {fullName}
          </Typography>
          {contact.position && (
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {contact.position}
            </Typography>
          )}
        </Box>
        {contact.phone && (
          <Tooltip title={contact.phone}>
            <IconButton
              size="small"
              href={`tel:${contact.phone}`}
              onClick={(e) => e.stopPropagation()}
              sx={{ color: 'primary.main' }}
            >
              <PhoneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Card>
    );
  }

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.3s ease',
        overflow: 'visible',
        position: 'relative',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: (theme) => `0 12px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
        },
      }}
    >
      {/* Top accent bar */}
      <Box
        sx={{
          height: 4,
          bgcolor: avatarColor,
          borderRadius: '12px 12px 0 0',
        }}
      />

      <CardActionArea
        onClick={() => onClick?.(contact)}
        disabled={!onClick}
        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        <CardContent sx={{ flexGrow: 1, pt: 3 }}>
          {/* Avatar and name section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
            <Avatar
              src={resolveMediaUrl(contact.avatarUrl)}
              sx={{
                width: 80,
                height: 80,
                bgcolor: avatarColor,
                fontSize: '1.75rem',
                fontWeight: 600,
                mb: 1.5,
                 boxShadow: `0 4px 14px ${alpha(avatarColor, 0.4)}`,
              }}
            >
              {initials}
            </Avatar>
            <Typography
              variant="h6"
              align="center"
              sx={{
                fontWeight: 600,
                lineHeight: 1.3,
                mb: 0.5,
              }}
            >
              {fullName}
            </Typography>
            {contact.position && (
              <Typography
                variant="body2"
                color="text.secondary"
                align="center"
                sx={{ mb: 1 }}
              >
                {contact.position}
              </Typography>
            )}
            {contact.department && (
              <Chip
                icon={<BusinessIcon sx={{ fontSize: 16 }} />}
                label={contact.department.name}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: alpha(avatarColor, 0.5),
                  color: avatarColor,
                  '& .MuiChip-icon': { color: avatarColor },
                }}
              />
            )}
          </Box>

          {/* Contact info */}
          <Box sx={{ mt: 'auto' }}>
            {contact.phone && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 0.75,
                  px: 1,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                component="a"
                href={`tel:${contact.phone}`}
                onClick={(e) => e.stopPropagation()}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <PhoneIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                <Typography variant="body2" color="text.primary">
                  {contact.phone}
                </Typography>
              </Box>
            )}

            {contact.phoneInternal && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 0.75,
                  px: 1,
                  borderRadius: 1,
                }}
              >
                <InternalPhoneIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                  вн. {contact.phoneInternal}
                </Typography>
              </Box>
            )}

            {contact.email && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 0.75,
                  px: 1,
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
                component="a"
                href={`mailto:${contact.email}`}
                onClick={(e) => e.stopPropagation()}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <EmailIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                <Typography
                  variant="body2"
                  color="text.primary"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {contact.email}
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>
      </CardActionArea>

      {/* Status indicator */}
      {!contact.isActive && (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
          }}
        >
          <Chip
            label="Неактивен"
            size="small"
            color="default"
            sx={{ opacity: 0.8 }}
          />
        </Box>
      )}
    </Card>
  );
}
