import { Box, Typography } from '@mui/material';

interface DashboardHeroStripProps {
  firstName?: string;
  position?: string | null;
  department?: string | null;
}

export const dashboardShellGradient =
  'linear-gradient(140deg, rgba(18,52,71,0.96) 0%, rgba(17,62,86,0.96) 54%, rgba(18,74,94,0.94) 100%)';

export default function DashboardHeroStrip({ firstName, position, department }: DashboardHeroStripProps) {
  return (
    <Box
      component="section"
      sx={{
        background: dashboardShellGradient,
        color: '#f1f8fc',
        borderRadius: 0,
        position: 'relative',
        overflow: 'hidden',
        borderBottom: '1px solid rgba(190, 229, 238, 0.12)',
      }}
    >
      <Box
        sx={{
          pt: { xs: 2.1, md: 2.6 },
          pb: { xs: 2.1, md: 2.6 },
          pr: { xs: 2.1, md: 2.6 },
          pl: {
            xs: 2.1,
            md: 'calc(var(--layout-drawer-width, 0px) + 20px)',
          },
          position: 'relative',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: { xs: 120, md: 180 },
            height: '100%',
            background: 'linear-gradient(120deg, rgba(107, 206, 220, 0.18) 0%, rgba(107,206,220,0) 72%)',
            clipPath: 'polygon(38% 0, 100% 0, 100% 100%, 0 100%)',
            pointerEvents: 'none',
          }}
        />
        <Typography variant="h4" gutterBottom sx={{ color: 'inherit', mb: 0.6 }}>
          Добро пожаловать, {firstName}!
        </Typography>
        <Typography variant="body1" sx={{ color: 'rgba(222, 241, 250, 0.84)', fontWeight: 500 }}>
          {[position, department].filter(Boolean).join(' • ')}
        </Typography>
      </Box>
    </Box>
  );
}
