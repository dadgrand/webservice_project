
 import React from 'react';
 import { Box } from '@mui/material';
import MessageLayout from '../components/messages/layout/MessageLayout';
import MessageList from '../components/messages/list/MessageList';
import MessageView from '../components/messages/view/MessageView';

const MessagesPage: React.FC = () => {
  return (
    <MessageLayout>
      <Box sx={{ display: 'flex', height: '100%', minHeight: 0, overflow: 'hidden', gap: 1.5 }}>
        {/* List of messages (Left panel) */}
         <Box 
           sx={{ 
             width: 350, 
             display: { xs: 'none', md: 'block' },
             flexShrink: 0,
             minHeight: 0,
             overflow: 'hidden',
             borderRadius: '28px',
             border: '1px solid rgba(255,255,255,0.58)',
             background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(244,250,253,0.72) 100%)',
             boxShadow: '0 24px 52px rgba(24, 57, 74, 0.08)',
             '&::-webkit-scrollbar': {
               display: 'none',
             },
             scrollbarWidth: 'none',
             msOverflowStyle: 'none',
           }}
         >
           <MessageList />
         </Box>
        
        {/* Message Content (Right panel) */}
        <Box
          sx={{
            flexGrow: 1,
            minHeight: 0,
            overflow: 'hidden',
            borderRadius: '28px',
            border: '1px solid rgba(255,255,255,0.58)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(244,250,253,0.72) 100%)',
            boxShadow: '0 24px 52px rgba(24, 57, 74, 0.08)',
          }}
        >
          <MessageView />
        </Box>
      </Box>
    </MessageLayout>
  );
};

export default MessagesPage;
