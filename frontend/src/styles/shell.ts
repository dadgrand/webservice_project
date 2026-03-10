import { alpha } from '@mui/material/styles';

const panelBorder = '1px solid rgba(255,255,255,0.58)';
const panelBackground = 'linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(244,250,253,0.72) 100%)';
const panelShadow = '0 24px 52px rgba(24, 57, 74, 0.08)';
const panelInset = 'inset 0 1px 0 rgba(255,255,255,0.64)';

export const shellPanelSx = {
  borderRadius: '28px',
  border: panelBorder,
  background: panelBackground,
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  boxShadow: `${panelShadow}, ${panelInset}`,
};

export const shellPanelSoftSx = {
  ...shellPanelSx,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.76) 0%, rgba(241,248,252,0.7) 100%)',
};

export const shellSectionSx = {
  ...shellPanelSoftSx,
  p: 2.2,
};

export const shellPanelHeaderSx = {
  borderBottom: '1px solid rgba(32, 73, 96, 0.08)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.14) 100%)',
};

export const shellInsetSurfaceSx = {
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.46)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.64) 0%, rgba(248,252,254,0.54) 100%)',
  boxShadow: `inset 0 1px 0 ${alpha('#ffffff', 0.66)}`,
};

export const shellInnerPanelSx = {
  borderRadius: '12px',
  border: '1px solid rgba(30, 85, 110, 0.09)',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.62) 0%, rgba(247,251,253,0.56) 100%)',
  boxShadow: `inset 0 1px 0 ${alpha('#ffffff', 0.7)}`,
};

export const shellEmptyStateSx = {
  ...shellPanelSx,
  height: '100%',
  minHeight: 0,
  display: 'grid',
  placeItems: 'center',
  textAlign: 'center',
  color: 'text.secondary',
};
