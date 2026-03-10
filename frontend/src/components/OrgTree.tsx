import { useState, useCallback, memo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  Collapse,
  IconButton,
  Chip,
  alpha,
  Skeleton,
  Tooltip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Business as BusinessIcon,
  Groups as GroupsIcon,
  FolderOpen as FolderOpenIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import type { Department } from '../types';
import { resolveMediaUrl } from '../utils/media';

interface OrgTreeProps {
  departments: Department[];
  selectedDepartmentId?: string | null;
  onDepartmentSelect?: (department: Department | null) => void;
  loading?: boolean;
}

interface DepartmentNodeProps {
  department: Department;
  level: number;
  selectedId?: string | null;
  onSelect?: (department: Department | null) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}

// Generate color based on department name or level
const getDepartmentColor = (name: string, level: number): string => {
  const levelColors = [
    '#1976d2', // Level 0 - primary blue
    '#2e7d32', // Level 1 - green
    '#ed6c02', // Level 2 - orange
    '#9c27b0', // Level 3 - purple
    '#0288d1', // Level 4 - light blue
  ];
  
  if (level < levelColors.length) {
    return levelColors[level];
  }
  
  // For deeper levels, generate based on name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#1976d2', '#388e3c', '#d32f2f', '#7b1fa2', '#00796b', '#c2185b'];
  return colors[Math.abs(hash) % colors.length];
};

const DepartmentNode = memo(function DepartmentNode({
  department,
  level,
  selectedId,
  onSelect,
  expandedIds,
  onToggle,
}: DepartmentNodeProps) {
  const hasChildren = department.children && department.children.length > 0;
  const isExpanded = expandedIds.has(department.id);
  const isSelected = selectedId === department.id;
  const color = department.color || getDepartmentColor(department.name, level);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(department.id);
  };

  const handleSelect = () => {
    onSelect?.(isSelected ? null : department);
  };

  const headName = department.head 
    ? `${department.head.lastName} ${department.head.firstName?.[0]}.`
    : null;

  return (
    <Box sx={{ mb: level === 0 ? 1 : 0 }}>
      <Paper
        elevation={isSelected ? 4 : level === 0 ? 2 : 0}
        onClick={handleSelect}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1.5,
          ml: level * 3,
          cursor: 'pointer',
          borderRadius: 2,
          border: '1px solid',
          borderColor: isSelected ? color : 'transparent',
          bgcolor: isSelected ? alpha(color, 0.08) : level === 0 ? 'background.paper' : alpha(color, 0.02),
          transition: 'all 0.2s ease',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': {
            bgcolor: alpha(color, 0.08),
            transform: 'translateX(4px)',
            '& .expand-button': {
              opacity: 1,
            },
          },
          '&::before': level > 0 ? {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            bgcolor: color,
            borderRadius: '0 2px 2px 0',
          } : {},
        }}
      >
        {/* Expand/Collapse button */}
        {hasChildren ? (
          <IconButton
            size="small"
            onClick={handleToggle}
            className="expand-button"
            sx={{
              opacity: isExpanded || level === 0 ? 1 : 0.7,
              transition: 'opacity 0.2s',
              bgcolor: alpha(color, 0.1),
              '&:hover': { bgcolor: alpha(color, 0.2) },
            }}
          >
            {isExpanded ? (
              <ExpandLessIcon sx={{ color, fontSize: 20 }} />
            ) : (
              <ExpandMoreIcon sx={{ color, fontSize: 20 }} />
            )}
          </IconButton>
        ) : (
          <Box sx={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {level === 0 ? (
              <BusinessIcon sx={{ color, fontSize: 20 }} />
            ) : (
              isExpanded ? (
                <FolderOpenIcon sx={{ color: alpha(color, 0.6), fontSize: 18 }} />
              ) : (
                <FolderIcon sx={{ color: alpha(color, 0.6), fontSize: 18 }} />
              )
            )}
          </Box>
        )}

        {/* Department info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant={level === 0 ? 'subtitle1' : 'body2'}
            fontWeight={level === 0 || isSelected ? 600 : 500}
            noWrap
            sx={{ color: isSelected ? color : 'text.primary' }}
          >
            {department.name}
          </Typography>
          {department.description && level === 0 && (
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {department.description}
            </Typography>
          )}
        </Box>

        {/* Head person avatar */}
        {department.head && (
          <Tooltip title={`Руководитель: ${headName}`} arrow>
            <Avatar
              src={resolveMediaUrl(department.head.avatarUrl)}
              sx={{
                width: 28,
                height: 28,
                bgcolor: color,
                fontSize: '0.7rem',
              }}
            >
              {department.head.firstName?.[0]}{department.head.lastName?.[0]}
            </Avatar>
          </Tooltip>
        )}

        {/* Employee count */}
        {(department.employeeCount !== undefined && department.employeeCount > 0) && (
          <Chip
            icon={<GroupsIcon sx={{ fontSize: '14px !important' }} />}
            label={department.employeeCount}
            size="small"
            variant="outlined"
            sx={{
              height: 24,
              borderColor: alpha(color, 0.3),
              color: alpha(color, 0.8),
              '& .MuiChip-icon': { color: alpha(color, 0.6) },
              '& .MuiChip-label': { px: 0.75, fontSize: '0.75rem' },
            }}
          />
        )}
      </Paper>

      {/* Children */}
      {hasChildren && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 0.5 }}>
            {department.children!.map((child) => (
              <DepartmentNode
                key={child.id}
                department={child}
                level={level + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                expandedIds={expandedIds}
                onToggle={onToggle}
              />
            ))}
          </Box>
        </Collapse>
      )}
    </Box>
  );
});

export default function OrgTree({
  departments,
  selectedDepartmentId,
  onDepartmentSelect,
  loading = false,
}: OrgTreeProps) {
  // Start with all root departments expanded
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const initialExpanded = new Set<string>();
    departments.forEach((dept) => initialExpanded.add(dept.id));
    return initialExpanded;
  });

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleExpandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (depts: Department[]) => {
      depts.forEach((d) => {
        allIds.add(d.id);
        if (d.children) collectIds(d.children);
      });
    };
    collectIds(departments);
    setExpandedIds(allIds);
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const handleClearSelection = () => {
    onDepartmentSelect?.(null);
  };

  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        {[1, 2, 3].map((i) => (
          <Box key={i} sx={{ mb: 1 }}>
            <Skeleton variant="rounded" height={56} sx={{ borderRadius: 2 }} />
            <Box sx={{ ml: 3, mt: 0.5 }}>
              <Skeleton variant="rounded" height={44} sx={{ borderRadius: 2 }} />
            </Box>
          </Box>
        ))}
      </Box>
    );
  }

  if (departments.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <BusinessIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography color="text.secondary">
          Нет отделений
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header with controls */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          px: 1,
        }}
      >
        <Typography variant="subtitle2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BusinessIcon fontSize="small" />
          Структура организации
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {selectedDepartmentId && (
            <Chip
              label="Сбросить"
              size="small"
              onDelete={handleClearSelection}
              sx={{ mr: 1 }}
            />
          )}
          <Tooltip title="Развернуть все">
            <IconButton size="small" onClick={handleExpandAll}>
              <ExpandMoreIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Свернуть все">
            <IconButton size="small" onClick={handleCollapseAll}>
              <ExpandLessIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Tree */}
      <Box sx={{ px: 1 }}>
        {departments.map((department) => (
          <DepartmentNode
            key={department.id}
            department={department}
            level={0}
            selectedId={selectedDepartmentId}
            onSelect={onDepartmentSelect}
            expandedIds={expandedIds}
            onToggle={handleToggle}
          />
        ))}
      </Box>
    </Box>
  );
}
