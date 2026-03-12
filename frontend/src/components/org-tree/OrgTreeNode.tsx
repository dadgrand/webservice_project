
import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Box, Typography, Avatar, Paper } from '@mui/material';
import type { OrgTreeNode as OrgTreeNodeType } from '../../types';
import { resolveMediaUrl } from '../../utils/media';

export const ORG_TREE_NODE_WIDTH = 220;
export const ORG_TREE_NODE_HEIGHT = 180;

// Custom Node Component
const OrgTreeNode: React.FC<NodeProps<OrgTreeNodeType & { isAdmin?: boolean }>> = ({ data, isConnectable }) => {
   const { linkedUser, customTitle, customSubtitle, customImageUrl, department, isAdmin = false, type } = data;

  const title = type === 'department'
    ? customTitle || department?.name || 'Отдел'
    : linkedUser?.position || customTitle || (type === 'position' ? 'Должность' : 'Узел');
  const subtitle = type === 'department'
    ? customSubtitle || department?.name || 'Отдел'
    : linkedUser
      ? `${linkedUser.lastName} ${linkedUser.firstName}`
      : customSubtitle || (type === 'position' ? 'Сотрудник' : 'Произвольный блок');
  const avatarUrl = resolveMediaUrl(linkedUser?.avatarUrl || customImageUrl);

  return (
    <Box sx={{ position: 'relative', width: ORG_TREE_NODE_WIDTH }}>
      {/* Input Handle (Top) */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        style={{ background: '#555', width: 8, height: 8 }}
      />

      <Paper
        elevation={3}
        sx={{
          p: 2,
          width: '100%',
          height: ORG_TREE_NODE_HEIGHT,
          boxSizing: 'border-box',
          borderRadius: 1,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          transition: 'all 0.2s',
          '&:hover': {
            boxShadow: 6,
            borderColor: 'primary.main',
          },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative accent line */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, bgcolor: 'primary.main' }} />

        {/* Avatar */}
        <Box sx={{ mt: 1, mb: 1.5, position: 'relative' }}>
            <Avatar
            src={avatarUrl}
            sx={{ width: 64, height: 64, border: '3px solid white', boxShadow: 2 }}
            >
            {subtitle[0]}
            </Avatar>
        </Box>

        {/* Content */}
        <Typography
          variant="subtitle2"
          color="primary"
          fontWeight="bold"
          sx={{
            mb: 0.5,
            width: '100%',
            lineHeight: 1.2,
            minHeight: '2.4em',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
          }}
        >
          {title.toUpperCase()}
        </Typography>
        <Typography
          variant="body2"
          fontWeight="medium"
          sx={{
            mb: 1,
            width: '100%',
            lineHeight: 1.3,
            minHeight: '2.6em',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
          }}
        >
          {subtitle}
        </Typography>

        {/* Admin Actions (Overlay on hover could be better, but simple for now) */}
        {isAdmin && (
            <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'none' }} className="node-actions">
                {/* Actions handled by parent via node click */}
            </Box>
        )}
      </Paper>

      {/* Output Handle (Bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        style={{ background: '#555', width: 8, height: 8 }}
      />
    </Box>
  );
};

export default memo(OrgTreeNode);
