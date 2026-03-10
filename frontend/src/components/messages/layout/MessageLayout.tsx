
import React, { useEffect } from 'react';
import { Box, Drawer, useMediaQuery, useTheme } from '@mui/material';
import FolderList from '../folders/FolderList';
import { useMessageStore } from '../../../store/messageStore';
import { useAuthStore } from '../../../store/authStore';

const SIDEBAR_WIDTH = 280;

interface MessageLayoutProps {
  children: React.ReactNode;
}

const MessageLayout: React.FC<MessageLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const {
    isSidebarOpen,
    toggleSidebar,
    initSocket,
    disconnectSocket,
    fetchFolders,
    fetchLabels,
    fetchMessages,
  } = useMessageStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user?.id) {
      disconnectSocket();
      return undefined;
    }

    initSocket();

    return () => {
      disconnectSocket();
    };
  }, [user?.id, initSocket, disconnectSocket]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    void Promise.all([fetchFolders(), fetchLabels()]).then(() => fetchMessages());
  }, [user?.id, fetchFolders, fetchLabels, fetchMessages]);

  const sidebarContent = (
     <Box sx={{ 
      height: '100%', 
      minHeight: 0,
      display: 'flex', 
      flexDirection: 'column', 
      border: `1px solid rgba(255,255,255,0.58)`,
      borderRadius: '28px',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(244,250,253,0.74) 100%)',
      boxShadow: '0 24px 52px rgba(24, 57, 74, 0.1)',
      overflow: 'auto',
      '&::-webkit-scrollbar': {
        display: 'none',
      },
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    }}>
      <FolderList />
    </Box>
  );

  return (
     <Box sx={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden', flexGrow: 1, gap: 1.5 }}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Box
          sx={{
            width: isSidebarOpen ? SIDEBAR_WIDTH : 0,
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {sidebarContent}
        </Box>
      )}

      {/* Mobile Sidebar */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={isSidebarOpen}
          onClose={toggleSidebar}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: SIDEBAR_WIDTH },
          }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, height: '100%', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>

    </Box>
  );
};

export default MessageLayout;
