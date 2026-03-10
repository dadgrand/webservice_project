
import React from 'react';
import { Box } from '@mui/material';
import OrgChartViewer from '../components/org-tree/OrgChartViewer';

const OrgTreePage: React.FC = () => {
   return (
     <Box sx={{ height: '100%', minHeight: 0, overflow: 'hidden', flexGrow: 1 }}>
       <OrgChartViewer />
     </Box>
   );
};

export default OrgTreePage;
