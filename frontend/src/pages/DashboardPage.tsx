import { Box } from '@mui/material';
import NewsPanel from '../components/dashboard/NewsPanel';

export default function DashboardPage() {
  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflowX: 'visible',
        overflowY: 'hidden',
      }}
    >
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <NewsPanel />
      </Box>
    </Box>
  );
}
