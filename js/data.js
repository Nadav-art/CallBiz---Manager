/* ============================================================
   CallBiz Manager – נתונים, קונפיגורציה ומנוע Workflow
   מבוסס על מסמך האפיון המלא
   ============================================================ */

/* ---------- אייקוני SVG (inline) ---------- */
const ICONS = {
  home:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  leads:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M17 8h4M19 6v4"/></svg>',
  calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>',
  tasks:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>',
  phone:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5c0 8 7 15 15 15l2.5-3.2-4.2-2.3-2 2c-2.6-1.2-4.8-3.4-6-6l2-2L9 4.5 5.8 4C5 4 4 4.3 4 5Z"/></svg>',
  whatsapp:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.2-.8-2.7-1.1-4.4-3.9-4.5-4.1-.1-.2-1.1-1.4-1.1-2.7 0-1.3.7-1.9.9-2.2.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2 0 .4-.1.6l-.4.5c-.2.2-.3.4-.1.7.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.5 2.6 1.6.2.1.4.1.6-.1l.9-1c.2-.2.4-.2.6-.1l1.9.9c.2.1.4.2.4.4.1.2.1.7-.1 1.3Z"/></svg>',
  mail:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 5 8-5"/></svg>',
  docs:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  clients: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M2 20c0-3 2.7-5 6-5s6 2 6 5M14.5 20c0-2 1.5-3.5 4-3.5s3.5 1.5 3.5 3.5"/></svg>',
  reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V4M20 20H4M8 16v-4M12 16V8M16 16v-6"/></svg>',
  settings: '<svg class="ic-settings" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"><path d="M10 0.64L13.11 0.71L13.48 1.08L13.63 1.45L13.78 3.38L14.66 3.67L15.26 4.04L15.78 3.97L16.96 2.86L17.77 2.78L18.07 2.93L19.77 4.63L19.99 5.15L19.85 5.89L18.74 7.23L18.74 7.52L19.03 7.97L19.33 9L19.48 9.15L19.92 9.22L21.33 9.3L21.62 9.45L22.07 10.04L22.07 12.56L21.77 12.63L21.62 12.48L21.55 9.96L21.25 9.74L19.85 9.67L19.25 9.52L18.88 9.08L18.74 8.41L18.29 7.52L18.44 6.86L19.48 5.6L19.48 5L17.7 3.23L17.11 3.3L15.78 4.49L15.11 4.49L14.74 4.19L13.63 3.82L13.26 3.3L13.11 1.3L12.81 1.08L10.08 1.08L10 1.23L9.85 1.23L9.71 1.82L9.63 3.3L9.19 3.82L8.45 3.97L7.63 4.41L6.97 4.41L6 3.6L5.86 3.6L5.63 3.3L5.04 3.23L3.19 5L3.26 5.67L4.3 7L4.3 7.6L3.78 8.48L3.71 9L3.41 9.45L3.12 9.59L1.34 9.74L1.04 10.04L0.97 12.63L1.04 12.85L1.41 13.15L3.04 13.3L3.26 13.37L3.64 13.81L3.78 14.48L4.3 15.37L4.3 16.03L3.26 17.37L3.26 17.96L5.04 19.66L5.49 19.59L5.63 19.37L5.78 19.37L6.89 18.48L7.34 18.48L7.93 18.85L8.74 19.07L9.19 19.37L9.34 19.74L9.34 20.77L9.41 21.36L9.56 21.59L12.37 21.66L12.59 21.51L12.74 21.59L12.74 21.96L12.44 22.1L9.63 22.1L9.34 21.96L8.96 21.44L8.89 19.74L8.67 19.51L7.85 19.29L7.26 18.92L6.97 18.92L5.56 20.03L5.04 20.11L4.52 19.88L2.97 18.33L2.75 17.81L2.97 17L3.86 15.89L3.86 15.52L3.56 15.07L3.19 13.89L3.04 13.74L1.12 13.52L0.75 13.22L0.6 12.93L0.6 9.96L0.75 9.67L1.34 9.3L3.04 9.15L3.26 8.93L3.41 8.26L3.86 7.52L3.78 7L3.56 6.86L2.75 5.6L2.75 4.93L2.89 4.63L4.6 2.93L4.89 2.78L5.56 2.78L5.86 2.93L7.26 4.04L8.37 3.52L9.04 3.38L9.19 3.23L9.34 1.3L9.48 1.01L10 0.64ZM11.11 7L12.52 7.15L14 7.89L15.04 9L15.48 9.89L15.7 10.7L15.7 11.59L15.33 11.59L15.26 10.7L15.04 9.96L14.37 8.85L13.18 7.89L12.07 7.52L10.59 7.52L9.85 7.74L9.11 8.11L8.22 8.93L7.71 9.74L7.34 10.93L7.34 12.19L7.63 13.22L8.15 14.11L8.82 14.78L9.78 15.37L10.45 15.59L11.48 15.66L11.48 16.11L9.85 15.89L8.45 15.07L7.56 14.04L7.19 13.3L6.89 12.19L6.97 10.56L7.19 9.82L7.71 8.85L8.15 8.48L8.3 8.19L8.45 8.19L9.11 7.6L9.93 7.23L11.11 7Z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/><path d="M17.18 12.04L18.44 12.04L19.25 12.19L19.92 12.41L21.33 13.22L22.59 14.63L23.1 15.66L23.4 16.77L23.33 18.92L23.1 19.74L22.44 20.99L21.33 22.18L21.18 22.18L20.81 22.55L19.77 23.07L18.59 23.36L16.59 23.29L15.63 22.99L14.44 22.33L13.55 21.51L13.55 21.36L12.96 20.7L12.52 19.81L12.15 18.4L12.15 17L12.37 15.96L12.89 14.78L13.26 14.41L13.41 14.04L14.07 13.37L14.22 13.37L14.44 13.07L14.96 12.85L15.04 12.7L16.37 12.19L17.18 12.04ZM17.03 12.48L15.85 12.78L14.96 13.22L13.7 14.33L13.7 14.48L13.33 14.85L12.74 16.18L12.52 18.03L12.74 19.22L13.33 20.55L14.44 21.81L14.59 21.81L15.18 22.33L16.22 22.77L17.4 22.99L18.22 22.99L19.4 22.77L20.51 22.25L21.99 20.92L22.81 19.37L23.03 18.33L23.03 17.07L22.66 15.66L22.29 14.92L21.55 14.11L21.55 13.96L21.25 13.81L20.96 13.44L20.07 12.93L19.03 12.56L17.03 12.48ZM16.96 14.55L17.77 14.63L18.07 14.92L18.14 15.22L21.03 15.22L21.11 15.59L18.51 15.59L18.14 15.66L17.85 16.18L17.11 16.33L16.74 16.18L16.52 15.96L16.52 15.74L16.29 15.59L14.66 15.66L14.44 15.52L14.52 15.22L16.44 15.22L16.52 14.92L16.96 14.55ZM17.18 14.92L16.81 15.15L16.81 15.66L17.03 15.89L17.4 15.96L17.77 15.66L17.77 15.15L17.55 14.92L17.18 14.92ZM19.03 16.85L19.77 16.85L20.22 17.22L20.36 17.51L21.11 17.51L21.11 17.81L20.29 17.89L20.22 18.18L19.92 18.48L19.48 18.63L18.96 18.48L18.66 18.18L18.59 17.89L14.44 17.81L14.52 17.51L15.41 17.44L18.37 17.51L18.59 17.44L18.74 17.07L19.03 16.85ZM19.25 17.22L18.96 17.44L18.96 17.96L19.18 18.18L19.7 18.18L19.92 17.89L19.92 17.51L19.7 17.22L19.25 17.22ZM16.74 19.07L17.18 19.07L17.48 19.22L17.7 19.44L17.77 19.74L21.03 19.74L21.11 20.11L17.77 20.18L17.63 20.62L17.26 20.85L16.44 20.77L16.07 20.18L14.44 20.11L14.44 19.88L14.59 19.74L16.15 19.74L16.29 19.29L16.74 19.07ZM16.89 19.44L16.44 19.74L16.44 20.18L16.74 20.48L17.18 20.48L17.4 20.25L17.48 19.88L17.26 19.51L16.89 19.44Z"/></svg>',
  plus:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>',
  chevronL:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 6-6 6 6 6"/></svg>',
  chevronR:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>',
  filter:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>',
  search:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  check:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 12 5 5 9-11"/></svg>',
  close:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  clock:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  user:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6"/></svg>',
  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>',
  kebab:   '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></svg>',
  video:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/></svg>',
  bolt:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>',
  note:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4"/></svg>',
  alert:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17h.01"/></svg>',
  bell:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5"/><path d="M10.5 19a1.9 1.9 0 0 0 3 0"/></svg>',
  lock:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  org:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15"/><path d="M13 10h7a1 1 0 0 1 1 1v10"/><path d="M2 21h20"/><path d="M6 9h2M6 13h2M6 17h2M16 14h2M16 18h2"/></svg>',
  flag:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  pause:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  copy: '<svg class="ic-copy" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"><path d="M2.42 0.6L15.35 0.6L16.31 1.08L16.89 2.04L16.89 5.96L16.31 6.06L16.12 5.96L16.12 2.23L15.93 1.85L15.26 1.37L2.9 1.27L2.23 1.46L1.75 1.94L1.56 2.61L1.65 15.64L2.04 16.12L2.71 16.41L6.16 16.41L6.16 17.08L5.77 17.17L2.23 17.08L1.17 16.41L0.79 15.54L0.79 2.13L1.08 1.46L1.65 0.89L2.42 0.6ZM8.65 6.92L21.68 6.92L22.73 7.5L23.21 8.46L23.21 21.87L22.92 22.54L22.44 23.02L21.48 23.4L8.84 23.4L8.07 23.11L7.5 22.63L7.11 21.77L7.11 8.55L7.4 7.78L7.98 7.21L8.65 6.92ZM9.22 7.59L8.55 7.78L7.98 8.46L8.07 22.06L8.84 22.63L21.48 22.63L21.87 22.44L22.25 22.06L22.44 21.58L22.44 8.65L22.25 8.17L21.96 7.88L21.2 7.59L9.22 7.59Z" stroke="currentColor" stroke-width="0.95" stroke-linejoin="round"/></svg>',
  manage: '<svg class="ic-manage" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"><path d="M9.22 0.6L10.47 0.6L11.13 0.85L12.04 1.76L12.29 2.67L13.29 2.67L13.87 2.84L14.2 3.25L14.28 3.92L17.68 3.92L18.09 4.08L18.59 4.58L18.76 4.99L18.76 10.63L18.26 10.63L18.26 5.24L18.09 4.83L17.68 4.5L14.28 4.41L14.2 5.41L13.62 5.99L6.07 5.99L5.49 5.49L5.41 4.41L2.18 4.41L1.76 4.58L1.35 5.24L1.43 20.66L2.09 21.16L10.88 21.16L11.05 21.33L10.96 21.66L10.8 21.74L1.84 21.66L1.35 21.41L0.85 20.66L0.85 4.91L1.51 4.08L1.93 3.92L5.41 3.92L5.49 3.25L5.82 2.84L7.4 2.67L7.56 2.01L7.9 1.43L8.48 0.93L9.22 0.6ZM9.64 1.1L8.97 1.26L8.23 1.93L7.98 2.51L7.98 2.92L7.65 3.25L6.24 3.25L5.99 3.42L5.99 5.24L6.15 5.41L13.53 5.41L13.7 5.16L13.62 3.34L11.88 3.17L11.71 2.92L11.63 2.18L11.13 1.51L10.22 1.1L9.64 1.1ZM9.64 2.42L10.3 2.51L10.71 3L10.63 3.75L10.38 4L9.89 4.17L9.31 4L8.97 3.5L9.06 2.84L9.64 2.42ZM9.72 3L9.55 3.09L9.55 3.42L9.72 3.58L10.13 3.5L10.13 3.09L9.72 3ZM17.26 11.63L18.09 11.63L19.34 12.04L20.17 12.79L20.17 12.95L20.5 13.29L20.75 14.03L20.75 15.19L20.08 16.52L19.25 17.18L20.08 17.35L21.16 17.93L22.16 18.84L22.16 19.01L22.57 19.42L23.15 21.08L23.07 22.99L22.65 22.99L22.49 20.66L22.07 19.67L21.66 19.25L21.66 19.09L20.25 18.01L18.34 17.51L16.93 17.51L15.69 17.76L14.69 18.18L14.28 18.59L14.11 18.59L13.45 19.25L12.87 20.25L12.62 21.08L12.62 22.65L12.54 22.82L12.04 22.74L12.12 20.75L12.37 20L12.95 19.01L14.36 17.76L15.19 17.35L16.1 17.18L16.1 17.02L15.69 16.85L15.27 16.44L14.78 15.52L14.69 14.03L14.86 13.45L15.19 12.87L15.86 12.21L17.26 11.63ZM17.26 12.21L16.35 12.54L15.69 13.12L15.27 13.95L15.27 15.19L15.61 15.94L16.44 16.68L17.51 17.02L18.43 16.93L19.17 16.6L19.83 15.94L20.17 15.19L20.17 14.03L19.92 13.37L19.09 12.54L18.26 12.21L17.26 12.21Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M4.25 8.06L5.08 8.06L5.41 8.23L5.99 8.97L5.91 9.97L5.16 10.63L4.5 10.71L3.92 10.55L3.34 9.89L3.34 8.81L3.75 8.31L4.25 8.06ZM4.58 8.56L4 8.81L4 8.97L3.83 9.06L3.83 9.64L4.33 10.13L4.91 10.13L5.24 9.97L5.49 9.31L5.16 8.73L4.58 8.56ZM7.32 8.97L14.61 8.97L14.61 9.39L7.4 9.47L7.23 9.31L7.32 8.97ZM4.33 11.79L4.91 11.79L5.49 12.04L5.82 12.37L5.99 12.79L5.99 13.53L5.82 13.87L5.41 14.28L4.99 14.45L4.25 14.45L3.75 14.2L3.25 13.37L3.25 12.87L3.58 12.21L4.33 11.79ZM4.41 12.37L3.92 12.7L3.83 13.45L4.25 13.87L4.75 13.95L5.33 13.62L5.41 12.79L4.91 12.37L4.41 12.37ZM7.48 12.7L12.87 12.7L13.04 12.87L13.04 13.12L12.87 13.29L7.4 13.29L7.23 12.95L7.48 12.7ZM4.17 15.61L5.08 15.61L5.57 15.86L5.99 16.52L5.91 17.51L5.57 17.93L5.08 18.18L4.17 18.18L3.83 18.01L3.34 17.43L3.34 16.35L3.83 15.77L4.17 15.61ZM4.5 16.1L3.92 16.44L3.83 17.18L4.17 17.6L4.91 17.68L5.41 17.26L5.41 16.52L5.08 16.19L4.5 16.1ZM7.48 16.52L11.96 16.52L12.12 16.68L12.12 17.02L7.4 17.1L7.23 16.77L7.48 16.52ZM16.77 18.18L17.1 18.18L17.51 18.76L18.01 18.76L18.34 18.18L18.76 18.18L18.84 18.34L18.76 18.67L18.51 18.92L18.51 19.17L19.17 21.16L19.17 21.66L17.85 23.4L17.6 23.4L17.26 23.07L17.26 22.9L16.27 21.66L16.27 21.24L16.93 19.25L16.93 18.84L16.68 18.59L16.77 18.18ZM17.51 19.25L16.85 21.58L17.76 22.65L18.59 21.58L18.59 21.16L18.01 19.25L17.51 19.25Z"/></svg>',
  layers:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>',
  target:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  queue:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  sync:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9a8 8 0 0 1 13-3l3 3M20 15a8 8 0 0 1-13 3l-3-3"/><path d="M17 3v6h-6M7 21v-6h6"/></svg>',
  eye:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.6"/></svg>',
  expand:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
};

/* ============================================================
   4. סוג ישות / מסלול טיפול / מטרה (הפרדה מחייבת)
   ============================================================ */
const ENTITY_TYPES = {
  lead:      { label: 'ליד',          color: 'blue'  },
  prospect:  { label: 'מתעניין',      color: 'blue'  },
  customer:  { label: 'לקוח פעיל',    color: 'green' },
  former:    { label: 'לקוח לשעבר',   color: 'gray'  },
  contact:   { label: 'איש קשר',      color: 'gray'  },
  org:       { label: 'ארגון',        color: 'gray'  },
};

const JOURNEY_TYPES = {
  sales:        { label: 'מכירה',        color: 'blue'   },
  support:      { label: 'שירות',        color: 'amber'  },
  upsell:       { label: 'הרחבת שירות',  color: 'blue'   },
  retention:    { label: 'שימור',        color: 'orange' },
  renewal:      { label: 'חידוש',        color: 'green'  },
  installation: { label: 'התקנה',        color: 'blue'   },
  training:     { label: 'הדרכה',        color: 'blue'   },
  billing:      { label: 'גבייה',        color: 'red'    },
  complaint:    { label: 'תלונה',        color: 'red'    },
  cancellation: { label: 'ביטול',        color: 'red'    },
  general:      { label: 'שירות כללי',   color: 'amber'  },
  appointment:  { label: 'תיאום',        color: 'green'  },
  followup:     { label: 'פולו-אפ',      color: 'orange' },
};

/* מחלקה אחראית לפי המסלול — מכירות / שירות / גבייה (כמו במערכת הדסקטופ) */
const DEPT_MAP = {
  sales:   { label: 'מכירות', color: 'blue',  j: ['sales', 'upsell', 'renewal', 'appointment', 'retention', 'followup', 'installation', 'training'] },
  billing: { label: 'גבייה',  color: 'red',   j: ['billing'] },
  service: { label: 'שירות',  color: 'amber', j: ['support', 'complaint', 'cancellation', 'general'] },
};
function deptOf(journey) {
  for (const k in DEPT_MAP) if (DEPT_MAP[k].j.includes(journey)) return DEPT_MAP[k];
  return DEPT_MAP.service;
}

const OBJECTIVES = {
  contact:    'יצירת קשר',
  meeting:    'קביעת פגישה',
  resolve:    'פתרון תקלה',
  schedule:   'תיאום שירות',
  proposal:   'שליחת הצעה',
  document:   'קבלת מסמך',
  renew:      'חידוש חוזה',
  collect:    'גביית תשלום',
  close:      'סגירת פנייה',
  winback:    'החזרת לקוח',
  training:   'ביצוע הדרכה',
  install:    'תיאום התקנה',
};

/* ============================================================
   8. מצבי שלב ב-Workflow
   ============================================================ */
const STAGE_STATE = {
  done:       { label: 'הושלם',        color: 'green',  icon: 'check' },
  active:     { label: 'פעיל',         color: 'brand',  icon: 'clock' },
  waiting:    { label: 'ממתין',        color: 'amber',  icon: 'pause' },
  overdue:    { label: 'באיחור',       color: 'red',    icon: 'alert' },
  blocked:    { label: 'חסום',         color: 'red',    icon: 'alert' },
  cancelled:  { label: 'בוטל',         color: 'gray',   icon: 'close' },
  irrelevant: { label: 'לא רלוונטי',   color: 'gray',   icon: 'close' },
  todo:       { label: 'טרם התחיל',    color: 'gray',   icon: '' },
};

/* ============================================================
   6 + 8.4  מנוע Workflow דינמי – שלבים לפי מסלול טיפול
   (לא קשיח בממשק – מוגדר בקונפיג, ניתן להוסיף מסלולים)
   ============================================================ */
const WORKFLOWS = {
  sales: [
    { key: 'intake',      title: 'ליד נכנס',       objective: 'contact' },
    { key: 'assign',      title: 'שיוך לנציג',     objective: 'contact' },
    { key: 'contactinfo', title: 'פרטי איש קשר',   objective: 'contact' },
    { key: 'contact',     title: 'יצירת קשר',      objective: 'contact' },
    { key: 'qualify',     title: 'בירור צורך',     objective: 'meeting' },
    { key: 'service',     title: 'בחירת שירות / מוצר', objective: 'meeting' },
    { key: 'meeting',   title: 'קביעת פגישה',     objective: 'meeting' },
    { key: 'reminder',  title: 'תזכורות לפגישה',  objective: 'meeting' },
    { key: 'held',      title: 'ביצוע פגישה וסיכום', objective: 'proposal' },   // סיכום הפגישה אוחד לכאן (היה שלב כפול)
    { key: 'proposal',  title: 'שליחת הצעת מחיר', objective: 'proposal' },
    { key: 'followup',  title: 'פולו-אפ',         objective: 'close' },
    { key: 'close',     title: 'סגירה (זכייה/הפסד)', objective: 'close' },
  ],
  support: [
    { key: 'open',      title: 'פתיחת פנייה',       objective: 'resolve' },
    { key: 'identify',  title: 'זיהוי לקוח',        objective: 'resolve' },
    { key: 'classify',  title: 'סיווג פנייה',       objective: 'resolve' },
    { key: 'diagnose',  title: 'אבחון',             objective: 'resolve' },
    { key: 'log',       title: 'תיעוד',             objective: 'resolve' },
    { key: 'schedule',  title: 'תיאום טיפול / תור', objective: 'schedule' },
    { key: 'handle',    title: 'טיפול',             objective: 'resolve' },
    { key: 'waitcust',  title: 'המתנה ללקוח',       objective: 'resolve' },
    { key: 'verify',    title: 'בדיקת פתרון',       objective: 'close' },
    { key: 'csat',      title: 'שביעות רצון',       objective: 'close' },
    { key: 'close',     title: 'סגירה',             objective: 'close' },
  ],
  upsell: [
    { key: 'request',   title: 'בקשת הרחבה',        objective: 'contact' },
    { key: 'contact',   title: 'יצירת קשר',         objective: 'contact' },
    { key: 'need',      title: 'בירור צורך',        objective: 'contact' },
    { key: 'service',   title: 'בחירת שירות / מוצר', objective: 'proposal' },
    { key: 'proposal',  title: 'הצעת מחיר',         objective: 'proposal' },
    { key: 'approve',   title: 'אישור',             objective: 'close' },
    { key: 'implement', title: 'יישום',             objective: 'close' },
    { key: 'monitor',   title: 'מעקב',              objective: 'close' },
    { key: 'close',     title: 'סגירה',             objective: 'close' },
  ],
  appointment: [
    { key: 'open',     title: 'פתיחת בקשה',      objective: 'schedule' },
    { key: 'svc',      title: 'בחירת סוג שירות', objective: 'schedule' },
    { key: 'provider', title: 'בחירת נותן שירות',objective: 'schedule' },
    { key: 'offer',    title: 'הצעת זמנים',      objective: 'schedule' },
    { key: 'confirm',  title: 'אישור לקוח',      objective: 'schedule' },
    { key: 'reminder', title: 'תזכורת',          objective: 'schedule' },
    { key: 'arrive',   title: 'הגעה / ביצוע',    objective: 'resolve' },
    { key: 'summary',  title: 'סיכום טיפול',     objective: 'close' },
    { key: 'next',     title: 'המשך טיפול',      objective: 'close' },
    { key: 'close',    title: 'סגירה',           objective: 'close' },
  ],
  followup: [
    { key: 'create',  title: 'יצירת פולו-אפ',      objective: 'contact' },
    { key: 'time',    title: 'קביעת זמן',          objective: 'contact' },
    { key: 'remind',  title: 'תזכורת לנציג',       objective: 'contact' },
    { key: 'call',    title: 'ביצוע שיחה',         objective: 'contact' },
    { key: 'outcome', title: 'תוצאה',              objective: 'close' },
    { key: 'nextact', title: 'קביעת פעולה נוספת',  objective: 'close' },
    { key: 'close',   title: 'סגירת הפולו-אפ',     objective: 'close' },
  ],
  billing: [
    { key: 'open',    title: 'פתיחת גבייה',   objective: 'collect' },
    { key: 'notify',  title: 'פנייה ללקוח',   objective: 'collect' },
    { key: 'arrange', title: 'הסדר תשלום',    objective: 'collect' },
    { key: 'collect', title: 'גביית תשלום',   objective: 'collect' },
    { key: 'close',   title: 'סגירה',         objective: 'close' },
  ],
  renewal: [
    { key: 'open',     title: 'פתיחת חידוש',  objective: 'renew' },
    { key: 'review',   title: 'סקירת חוזה',   objective: 'renew' },
    { key: 'offer',    title: 'הצעת חידוש',   objective: 'proposal' },
    { key: 'approve',  title: 'אישור לקוח',   objective: 'close' },
    { key: 'close',    title: 'סגירה',        objective: 'close' },
  ],
};
/* מסלולים שמשתמשים ב-workflow קיים */
const WORKFLOW_ALIAS = {
  general: 'support', complaint: 'support', retention: 'followup',
  installation: 'appointment', training: 'appointment', cancellation: 'support',
};
function workflowFor(journey) {
  return WORKFLOWS[journey] || WORKFLOWS[WORKFLOW_ALIAS[journey]] || WORKFLOWS.sales;
}

/* ============================================================
   3.4 סוגי "הפעולה הבאה"
   ============================================================ */
const NEXT_ACTIONS = {
  followup:   { label: 'פולו-אפ',        icon: 'phone',    color: 'orange' },
  remind:     { label: 'תזכורת לפגישה',  icon: 'clock',    color: 'blue'   },
  meeting:    { label: 'פגישה',          icon: 'calendar', color: 'green'  },
  appt:       { label: 'תור שירות',      icon: 'calendar', color: 'green'  },
  callback:   { label: 'חזרה ללקוח',     icon: 'phone',    color: 'amber'  },
  proposal:   { label: 'הצעת מחיר',      icon: 'docs',     color: 'blue'   },
  mgr_task:   { label: 'משימת מנהל',     icon: 'flag',     color: 'red'    },
  cust_ok:    { label: 'אישור לקוח',     icon: 'check',    color: 'amber'  },
  wait_doc:   { label: 'המתנה למסמך',    icon: 'pause',    color: 'gray'   },
  summary:    { label: 'סיכום פגישה',    icon: 'note',     color: 'orange' },
  billing:    { label: 'גבייה',          icon: 'docs',     color: 'red'    },
  none:       { label: 'ללא פעולה',      icon: '',         color: 'gray'   },
};

/* ============================================================
   3.2 כרטיסי סיכום (לחיצים → סינון)
   ============================================================ */
const SUMMARY_CARDS = [
  { key: 'today_meetings', label: 'פגישות היום',        color: 'brand',  delta: 'לחץ לסינון', icon: 'calendar' },
  { key: 'today_followup', label: 'פולו-אפ היום',       color: 'orange', delta: 'לחץ לסינון', icon: 'phone' },
  { key: 'overdue',        label: 'באיחור',             color: 'red',    delta: 'דורש טיפול מיידי', icon: 'clock' },
  { key: 'week_meetings',  label: 'השבוע',              color: 'blue',   delta: 'לחץ לסינון', icon: 'calendar' },
  { key: 'done',           label: 'הושלמו',             color: 'green',  delta: 'לחץ לסינון', icon: 'check' },
  { key: 'new_leads',      label: 'לידים שטרם טופלו',   color: 'blue',   delta: 'ממתינים ל-SLA', icon: 'leads' },
  { key: 'open_service',   label: 'פניות שירות פתוחות', color: 'amber',  delta: 'לחץ לסינון', icon: 'tasks' },
  { key: 'pending_appt',   label: 'תורים לאישור',       color: 'amber',  delta: 'דורשים אישור', icon: 'clock' },
  { key: 'no_next',        label: 'ללא פעולה הבאה',     color: 'red',    delta: 'חריגה', icon: 'alert' },
];

/* ============================================================
   רשומות לדוגמה (עם הפרדת entity/journey/objective, SLA, עדיפות)
   ============================================================ */
const RECORDS = [
  {
    id: 1, name: 'ישראל כהן', org: 'CalBig', avatar: 'IK', phone: '052-1234567', idnum: '312456789',
    entity: 'lead', journey: 'sales', objective: 'meeting', stageKey: 'meeting',
    subject: 'מכירה ראשונית', assignee: 'יואב כהן', source: 'קמפיין גוגל',
    priority: 'high', sla: { label: 'בזמן', color: 'green', mins: 55 },
    status: { label: 'נקבעה פגישה', color: 'green' },
    next: { type: 'meeting', at: 'היום 09:30' }, time: '09:30',
    meeting: { date: '22/05/24', time: '09:30', dur: 60, channel: 'Google Meet', with: 'יואב כהן' },
  },
  {
    id: 2, name: 'דנה לוי', org: 'Tech Solutions', avatar: 'DL', female: true, phone: '053-7654321',
    entity: 'prospect', journey: 'sales', objective: 'proposal', stageKey: 'reminder',
    subject: 'הצעת מערכת', assignee: 'יואב כהן', source: 'אתר',
    priority: 'medium', sla: { label: 'בזמן', color: 'green', mins: 180 },
    status: { label: 'תזכורת לפגישה', color: 'blue' },
    next: { type: 'remind', at: 'מחר 09:30' }, time: '10:30',
    meeting: { date: '23/05/24', time: '10:30', dur: 45, channel: 'טלפון', with: 'יואב כהן' },
  },
  {
    id: 3, name: 'אבי רוזן', org: 'Zohar Group', avatar: 'AR', phone: '054-1112222',
    entity: 'customer', journey: 'upsell', objective: 'proposal', stageKey: 'proposal',
    subject: 'הרחבת מנויים', assignee: 'יואב כהן', source: 'לקוח קיים',
    priority: 'medium', sla: { label: 'בזמן', color: 'green', mins: 240 },
    status: { label: 'הצעה נשלחה', color: 'amber' },
    next: { type: 'followup', at: 'היום 10:50' }, time: '12:00',
  },
  {
    id: 4, name: 'מיכל רוזן', org: 'MR Marketing', avatar: 'MR', female: true, phone: '050-3334444',
    entity: 'customer', journey: 'support', objective: 'resolve', stageKey: 'schedule',
    subject: 'תקלת התחברות', assignee: 'יואב כהן', source: 'טלפון',
    priority: 'high', sla: { label: 'קרוב לחריגה', color: 'orange', mins: 20 },
    status: { label: 'בטיפול', color: 'blue' },
    next: { type: 'appt', at: 'היום 14:00' }, time: '14:00',
  },
  {
    id: 5, name: 'שרון אביב', org: '', avatar: 'SA', phone: '052-5556666',
    entity: 'lead', journey: 'followup', objective: 'contact', stageKey: 'call',
    subject: 'מעקב לאחר שיחה', assignee: 'יואב כהן', source: 'פייסבוק',
    priority: 'medium', sla: { label: 'בזמן', color: 'green', mins: 90 },
    status: { label: 'פולו-אפ', color: 'orange' },
    next: { type: 'followup', at: 'היום 16:00' }, time: '16:00',
  },
  {
    id: 6, name: 'יואב בן דוד', org: 'BD Finance', avatar: 'YB', phone: '053-7778888',
    entity: 'lead', journey: 'sales', objective: 'contact', stageKey: 'contact',
    subject: 'שיחת הכרות', assignee: 'יואב כהן', source: 'קמפיין גוגל',
    priority: 'high', sla: { label: 'חריגה!', color: 'red', mins: -12 },
    status: { label: 'ניסיון קשר', color: 'blue' },
    next: { type: 'callback', at: 'באיחור · 12 דק\'' }, time: '17:30', overdue: true,
  },
  {
    id: 7, name: 'רונית שגב', org: 'Segev Ltd', avatar: 'RS', female: true, phone: '058-2223344',
    entity: 'customer', journey: 'billing', objective: 'collect', stageKey: 'notify',
    subject: 'תשלום שלא נגבה', assignee: 'יואב כהן', source: 'מערכת סליקה',
    priority: 'high', sla: { label: 'קרוב לחריגה', color: 'orange', mins: 30 },
    status: { label: 'ממתינה ללקוח', color: 'amber' },
    next: { type: 'billing', at: 'היום 15:00' }, time: '15:00',
  },
  {
    id: 8, name: 'עופר מלכה', org: 'OM Studio', avatar: 'OM', phone: '050-9998877',
    entity: 'former', journey: 'retention', objective: 'winback', stageKey: 'create',
    subject: 'החזרת לקוח', assignee: 'יואב כהן', source: 'ניתוח נטישה',
    priority: 'low', sla: { label: 'ללא', color: 'gray', mins: null },
    status: { label: 'לקוח לשעבר', color: 'gray' },
    next: { type: 'followup', at: 'מחר 11:00' }, time: '—',
    former: { endedAt: '01/02/24', reason: 'מעבר למתחרה', allowContact: true },
  },
  {
    id: 9, name: 'יעל שרון', org: 'YS Design', avatar: 'YS', female: true, phone: '052-8887766',
    entity: 'customer', journey: 'sales', objective: 'close', stageKey: 'close',
    subject: 'עסקה נסגרה', assignee: 'מיכל רוזן', source: 'המלצה',
    priority: 'low', sla: { label: 'הושלם', color: 'green', mins: null }, done: true,
    status: { label: 'זכייה', color: 'green' },
    next: { type: 'none', at: '—' }, time: '08:30',
  },
  {
    id: 10, name: 'משה כץ', org: 'Katz Ltd', avatar: 'MK', phone: '053-4445566',
    entity: 'customer', journey: 'support', objective: 'close', stageKey: 'close',
    subject: 'תקלה נפתרה', assignee: 'שרון אביב', source: 'טלפון',
    priority: 'low', sla: { label: 'הושלם', color: 'green', mins: null }, done: true,
    status: { label: 'נסגרה', color: 'green' },
    next: { type: 'none', at: '—' }, time: '09:15',
  },
  {
    id: 11, name: 'נועה ברק', org: 'Barak Co', avatar: 'NB', female: true, phone: '054-9990011',
    entity: 'customer', journey: 'appointment', objective: 'schedule', stageKey: 'confirm',
    subject: 'תור התקנה', assignee: 'רותם לוי', source: 'לקוח קיים',
    priority: 'medium', sla: { label: 'ממתין לאישור', color: 'amber', mins: 120 }, pendingApproval: true,
    status: { label: 'ממתינה לאישור', color: 'amber' },
    next: { type: 'appt', at: 'היום 13:00' }, time: '13:00',
  },
  {
    id: 12, name: 'איתי לוין', org: '', avatar: 'IL', phone: '050-2223311',
    entity: 'lead', journey: 'followup', objective: 'contact', stageKey: 'call',
    subject: 'מעקב הצעה', assignee: 'יואב כהן', source: 'קמפיין גוגל',
    priority: 'medium', sla: { label: 'בזמן', color: 'green', mins: 120 },
    status: { label: 'פולו-אפ', color: 'orange' },
    next: { type: 'followup', at: 'היום 11:30' }, time: '11:30',
  },
  {
    id: 13, name: 'דנה פרץ', org: 'DP Media', avatar: 'DP', female: true, phone: '058-7778899',
    entity: 'lead', journey: 'sales', objective: 'contact', stageKey: 'intake',
    subject: 'ליד חדש שטרם טופל', assignee: '—', source: 'אתר',
    priority: 'high', sla: { label: 'ממתין ל-SLA', color: 'amber', mins: 40 },
    status: { label: 'חדש', color: 'blue' },
    next: { type: 'callback', at: 'ממתין לשיוך' }, time: '—',
  },
  {
    id: 14, name: 'עומר דגן', org: 'Dagan Tech', avatar: 'OD', phone: '053-1239876',
    entity: 'customer', journey: 'support', objective: 'resolve', stageKey: 'diagnose',
    subject: 'בעיית חיוב', assignee: 'שרון אביב', source: 'וואטסאפ',
    priority: 'medium', sla: { label: 'בזמן', color: 'green', mins: 200 },
    status: { label: 'בטיפול', color: 'blue' },
    next: { type: 'callback', at: 'היום 15:30' }, time: '15:30',
  },
  {
    id: 15, name: 'ליאת כהן', org: 'LC Group', avatar: 'LC', female: true, phone: '052-3216549',
    entity: 'prospect', journey: 'sales', objective: 'meeting', stageKey: 'meeting',
    subject: 'פגישת מכירה', assignee: 'מיכל רוזן', source: 'לינקדאין',
    priority: 'medium', sla: { label: 'בזמן', color: 'green', mins: 150 },
    status: { label: 'נקבעה פגישה', color: 'green' },
    next: { type: 'meeting', at: 'היום 12:30' }, time: '12:30',
    meeting: { date: '22/05/24', time: '12:30', dur: 45, channel: 'טלפון', with: 'מיכל רוזן' },
  },
];

/* ============================================================
   13. חלונות פולו-אפ + הגדרות תזמון פולו-אפ
   ============================================================ */
const FOLLOWUP_WINDOWS = [
  { id: 'w1', range: '09:00 - 10:00', capacity: 6, booked: 5 },
  { id: 'w2', range: '11:30 - 12:30', capacity: 6, booked: 2 },
  { id: 'w3', range: '14:00 - 15:00', capacity: 6, booked: 6 },
  { id: 'w4', range: '16:00 - 17:00', capacity: 6, booked: 3 },
];
const FOLLOWUP_QUICK = ['בעוד 15 דק\'', 'בעוד 30 דק\'', 'בעוד שעה', 'מאוחר יותר היום', 'מחר בבוקר', 'מחר בצהריים'];

/* --- עזרי זמן: אין קביעה בהיסטוריה — הכל מעכשיו והלאה --- */
/* מנוע הזמן (nowHM / recIsOverdue / refNowAbsMin וכו') הועבר למודול נפרד: js/clock.js
   COORD_TODAY ו-APP_NOW מוגדרים כאן (נתונים) ונצרכים ע"י clock.js. */
function hmToMin(hhmm) { const [a, b] = String(hhmm).split(':').map(Number); return a * 60 + (b || 0); }
function minToHM(m) { m = Math.max(0, m); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
function rangeStartMin(range) { return hmToMin(String(range).split('-')[0].trim()); }   // "09:00 - 10:00"
function isPastToday(hhmmOrRange) { return rangeStartMin(hhmmOrRange) <= nowHM(); }

/* שלבים אופציונליים — נוספים לפי צורך לכל ליד (דינמיות) */
const EXTRA_STAGE_LIB = [
  { key: 'deposit',  title: 'גביית מקדמה',   objective: 'collect', desc: 'תשלום מקדים לפני פגישה/טיפול',
    anchors: [{ type: 'before', key: 'meeting' }, { type: 'before', key: 'proposal' }, { type: 'after', key: 'contact' }] },
  { key: 'contract', title: 'הסכם לחתימה',   objective: 'close',   desc: 'שליחת הסכם ישירות אחרי שיחה/הצעה',
    anchors: [{ type: 'after', key: 'proposal' }, { type: 'after', key: 'contact' }] },
];
/* המסלול הדינמי של רשומה: בסיס פחות מדולגים + אופציונליים במקום הנכון */
function stageByKey(journey, k) {
  return workflowFor(journey).find(s => s.key === k) || EXTRA_STAGE_LIB.find(e => e.key === k);
}
function dynamicFlow(r) {
  /* סדר מותאם אישית (מעורך השלבים) גובר על הכל */
  if (r.customFlow && r.customFlow.length) {
    return r.customFlow.map(k => stageByKey(r.journey, k)).filter(Boolean)
      .map(s => ({ key: s.key, title: s.title, objective: s.objective }));
  }
  const skip = r.skipStages || [];
  const enabled = r.enableStages || [];   // הפעלה פרטנית של שלב שכבוי כברירת מחדל
  let flow = workflowFor(r.journey).filter(s => {
    if (skip.includes(s.key)) return false;
    // חסימת מנהל — לא מוצג בכלל; "כבוי כברירת מחדל" — רק אם הופעל פרטנית בליד
    if (typeof stageIsBlocked === 'function' && stageIsBlocked(r.journey, s.key)) return false;
    if (typeof stageIsOffByDefault === 'function' && stageIsOffByDefault(r.journey, s.key) && !enabled.includes(s.key)) return false;
    // רלוונטיות אוטומטית לפי תצורת השירות שנבחר (רכישה ישירה לא צריכה שלבי פגישה וכו')
    if (typeof stageRelevantFor === 'function' && !stageRelevantFor(r, s.key) && !enabled.includes(s.key)) return false;
    return true;
  });
  (r.extraStages || []).forEach(exKey => {
    const ex = EXTRA_STAGE_LIB.find(e => e.key === exKey); if (!ex) return;
    let pos = -1;
    for (const a of ex.anchors) {
      const i = flow.findIndex(s => s.key === a.key);
      if (i >= 0) { pos = a.type === 'before' ? i : i + 1; break; }
    }
    if (pos < 0) pos = Math.max(1, flow.length - 1);   // ברירת מחדל: לפני סגירה
    flow.splice(pos, 0, { key: ex.key, title: ex.title, objective: ex.objective });
  });
  return flow;
}

/* תבניות וואטסאפ — עריכות במסך ההגדרות */
let WA_TEMPLATES = {
  arrival: 'היי {שם} 👋 מזכירים: {נושא} ב-{מועד}. נשמח שתאשר/י הגעה 🙏 — צוות CallBiz',
};
function fillTemplate(tpl, r) {
  const first = (r.name || '').split(' ')[0];
  return tpl
    .replace(/\{שם\}/g, first)
    .replace(/\{נושא\}/g, r.subject || 'התור')
    .replace(/\{מועד\}/g, r.next?.at || (r.meeting ? `${r.meeting.date} ${r.meeting.time}` : 'המועד שנקבע'));
}

/* דיוק תזמון ביומן — קפיצות בדקות; התצוגה נשארת בטווחי שעה */
let CAL_STEP = { minutes: 15 };
const CAL_STEP_OPTIONS = [5, 10, 15, 30, 60];

/* מדיניות זמן פולו-אפ (מועד חזרה) — מוגדרת בהגדרות, מסתנכרנת עם חלונות פנויים */
let FOLLOWUP_POLICY = { mode: 'same_day', modes: ['same_day'] };
const FU_POLICY_OPTIONS = [
  { key: 'same_day',   label: 'אותו היום — החלון הפנוי הבא' },
  { key: 'next_day',   label: 'יום אחרי — החלון הראשון בבוקר' },
  { key: 'other_hour', label: 'שעה אחרת — בעוד שעתיים' },
  { key: 'end_day',    label: 'סוף היום — 17:00' },
  { key: 'in_3_days',  label: 'בעוד 3 ימים' },
  { key: 'next_week',  label: 'שבוע הבא — אותו יום' },
  { key: 'morning',    label: 'בוקר — 09:00' },
  { key: 'afternoon',  label: 'אחה״צ — 16:00' },
];

/* ============================================================
   12. מנוע תזמון – זמנים מוצעים (עם צמצום פערים ודירוג)
   ============================================================ */
const SUGGESTED_SLOTS = [
  { time: '09:30 - 10:00', owner: 'יואב כהן', score: 98, fillsGap: true,  reason: 'סוגר פער בין 09:00 ל-10:00', needsApproval: false },
  { time: '10:10 - 10:40', owner: 'יואב כהן', score: 91, fillsGap: true,  reason: 'רציף לפגישה הקודמת', needsApproval: false },
  { time: '11:20 - 11:50', owner: 'יואב כהן', score: 84, fillsGap: false, reason: 'קרוב לזמן המבוקש', needsApproval: false },
  { time: '13:20 - 13:50', owner: 'רותם לוי', score: 72, fillsGap: false, reason: 'נציג חלופי פנוי', needsApproval: false },
  { time: '17:30 - 18:00', owner: 'יואב כהן', score: 55, fillsGap: false, reason: 'שעה אחרונה ביום', needsApproval: true },
];

/* ============================================================
   18. Work Queue – הפעולה הבאה המומלצת
   ============================================================ */
const WORK_QUEUE = [
  { id: 6, kind: 'ליד באיחור (SLA)', name: 'יואב בן דוד', time: 'עכשיו', priority: 'high', why: 'חריגת SLA · 12 דק\' באיחור' },
  { id: 1, kind: 'פגישה עומדת להתחיל', name: 'ישראל כהן', time: '09:30', priority: 'high', why: 'פגישה בעוד 15 דק\'' },
  { id: 4, kind: 'לקוח ממתין למענה', name: 'מיכל רוזן', time: '14:00', priority: 'high', why: 'SLA קרוב לחריגה' },
  { id: 7, kind: 'גבייה שדורשת מעקב', name: 'רונית שגב', time: '15:00', priority: 'medium', why: 'תשלום שלא נגבה' },
  { id: 5, kind: 'פולו-אפ שהגיע זמנו', name: 'שרון אביב', time: '16:00', priority: 'medium', why: 'הגיע מועד השיחה' },
];

/* ============================================================
   10.2 סוגי תיאום + 7.2 טאבים ב-Drawer
   ============================================================ */
const APPT_TYPES = ['שיחת פולו-אפ', 'פגישה', 'תור שירות', 'שיחה עם מנהל', 'הדרכה', 'התקנה', 'טיפול טכני', 'ביקור', 'פגישה קבוצתית', 'שיחת סטטוס'];
const DRAWER_TABS = [
  { key: 'flow',     label: 'ציר טיפול', icon: 'tasks' },
  { key: 'log',      label: 'תיעוד',     icon: 'note' },      /* תיעוד מימין להיסטוריה */
  { key: 'history',  label: 'היסטוריה',  icon: 'history' },
  { key: 'tasks',    label: 'משימות',    icon: 'check' },
  { key: 'docs',     label: 'מסמכים',    icon: 'docs' },
];

/* 9. Activity Timeline לדוגמה */
const HISTORY_SAMPLE = [
  { type: 'פתיחת ליד',      by: 'מערכת',    at: '21/05/24 21:15', desc: 'ליד נקלט ממקור: קמפיין גוגל' },
  { type: 'שיוך נציג',      by: 'מערכת',    at: '21/05/24 21:15', desc: 'הוקצה ל: יואב כהן (סבב שוויוני)' },
  { type: 'שיחה',          by: 'יואב כהן', at: '22/05/24 08:40', desc: '3 דק\' · נוצר קשר, מעוניין בפגישה' },
  { type: 'קביעת פגישה',   by: 'יואב כהן', at: '22/05/24 08:45', desc: 'פגישה נקבעה ל-22/05 09:30 · Google Meet' },
  { type: 'תזכורת נשלחה',  by: 'מערכת',    at: '22/05/24 08:46', desc: 'SMS אישור נשלח ללקוח' },
];

/* ---------- טאבים בכותרת (תהליכים) ---------- */
/* טאבים עליונים — צ'יפ זז (segmented). יומן/הגדרות/אוטומציות עברו לסיידבר */
const PROC_TABS = [
  { key: 'unified', label: 'מסך אחד לכל העבודה',   short: 'מסך אחד לעבודה', icon: 'tasks', active: true },
  { key: 'dynamic', label: 'טיפול מהלך דינמי',      short: 'טיפול דינמי',    icon: 'bolt' },
  { key: 'coord',   label: 'לוח תיאום חי',          short: 'לוח תיאום',      icon: 'clock' },
];

/* ============================================================
   15. הגדרות יומן – שעות פעילות, קיבולת, חריגים, אישור, סנכרון
   ============================================================ */
const WEEK_DAYS = [
  { key: 'sun', label: 'ראשון',  on: true,  start: '08:00', end: '17:00', brk: '13:00-13:30' },
  { key: 'mon', label: 'שני',    on: true,  start: '08:00', end: '17:00', brk: '13:00-13:30' },
  { key: 'tue', label: 'שלישי',  on: true,  start: '08:00', end: '18:00', brk: '13:00-14:00' },
  { key: 'wed', label: 'רביעי',  on: true,  start: '08:00', end: '17:00', brk: '—' },
  { key: 'thu', label: 'חמישי',  on: true,  start: '08:00', end: '16:00', brk: '—' },
  { key: 'fri', label: 'שישי',   on: false, start: '08:00', end: '13:00', brk: '—' },
  { key: 'sat', label: 'שבת',    on: false, start: '—',     end: '—',     brk: '—' },
];
const CAPACITY = [
  { label: 'מקסימום פגישות ביום',        value: 8 },
  { label: 'מקסימום תורים ברצף',         value: 3 },
  { label: 'מקסימום פולו-אפים בחלון',    value: 6 },
  { label: 'מקסימום פגישות בשעה',        value: 2 },
  { label: 'מקסימום תורים ממתינים',      value: 10 },
];
const DURATIONS = [
  { type: 'פגישה',       def: 60, min: 30, max: 120, prep: 10, wrap: 10 },
  { type: 'תור שירות',   def: 45, min: 30, max: 90,  prep: 15, wrap: 15 },
  { type: 'שיחת פולו-אפ',def: 10, min: 5,  max: 20,  prep: 0,  wrap: 5 },
  { type: 'הדרכה',       def: 90, min: 60, max: 120, prep: 10, wrap: 10 },
];
const EXCEPTIONS = [
  { date: '05/06/24', label: 'ערב חג שבועות', type: 'יום מקוצר',    from: '08:00', to: '13:00', note: 'סגירה מוקדמת לרגל החג' },
  { date: '11/06/24', label: 'חופשה שנתית',   type: 'סגור',         note: 'הסניף סגור — כל התורים הופנו מראש' },
  { date: '18/07/24', label: 'אירוע חברה',    type: 'שעות מיוחדות', from: '10:00', to: '15:00', note: 'פתיחה מאוחרת עקב כנס צוות בבוקר' },
];
const APPROVAL_POLICIES = [
  { label: 'אישור אוטומטי',            on: true },
  { label: 'אישור נציג',               on: false },
  { label: 'אישור מנהל (בחריגה בלבד)', on: true },
  { label: 'אישור לקוח',               on: true },
];
const SYNC_CALENDARS = [
  { name: 'Google Calendar',   mode: 'דו-כיווני', on: true },
  { name: 'Outlook / M365',    mode: 'חד-כיווני', on: false },
  { name: 'יומן צוות פנימי',   mode: 'דו-כיווני', on: true },
];

/* ============================================================
   16. אוטומציות
   ============================================================ */
const AUTOMATIONS = [
  { key: 'a1',  trigger: 'בעת יצירת ליד', title: 'זיהוי לקוח קיים', desc: 'בודק אם כבר יש תיק לאותו טלפון', on: false },
  { key: 'a1b', trigger: 'בעת יצירת ליד', title: 'שיוך נציג אוטומטי', desc: 'מחליט למי מהצוות הליד מגיע', on: false },
  { key: 'a1c', trigger: 'בעת יצירת ליד', title: 'פתיחת שיחת המשך', desc: 'קובע מתי לחזור ללקוח', on: false },
  { key: 'a1d', trigger: 'בעת יצירת ליד', title: 'מדידת זמן תגובה', desc: 'מתחיל לספור כמה זמן לוקח לחזור ללקוח', on: false },
  { key: 'a2', trigger: 'בעת קביעת פגישה',  title: 'תזכורות ואישור אוטומטי', desc: 'סגירת פולו-אפ קודם, יצירת אירוע, שליחת אישור', on: false },
  { key: 'a3', trigger: 'לפני פגישה',        title: 'תזכורת ללקוח (SMS + WhatsApp)', desc: 'שעה לפני הפגישה', on: false },
  { key: 'a4', trigger: 'בעת ביטול',         title: 'הצעת זמן חלופי אוטומטית', desc: 'ביטול אירוע, פתיחת פולו-אפ, הצעת חלופה', on: false },
  { key: 'a5', trigger: 'בעת אי-הגעה',       title: 'קביעת שיחת חזרה', desc: 'סימון לא-הגיע + יצירת פולו-אפ', on: false },
  { key: 'a6', trigger: 'לאחר פגישה',        title: 'דרישת תוצאה + המלצת AI', desc: 'לא ניתן לסיים ללא פעולה הבאה', on: false },
  { key: 'a7', trigger: 'מחוץ לשעות פעילות', title: 'העברה לחלון הפנוי הבא', desc: 'פולו-אפ שנכנס בלילה יתוזמן לבוקר', on: false },
  /* --- אוטומציות תהליך שיריון ונעילה זמנית --- */
  { key: 'h1', trigger: 'בעת נעילה זמנית',      title: 'שליחת קישור סליקה ללקוח', desc: 'מיד עם נעילת התור נשלח קישור תשלום בוואטסאפ', on: false },
  { key: 'h2', trigger: 'נעילה — 5 דק׳ לסיום',  title: 'תזכורת דחופה לנציג וללקוח', desc: 'התראה בפעמון + וואטסאפ ללקוח לפני שהתור משתחרר', on: false },
  { key: 'h3', trigger: 'בתום זמן הנעילה',      title: 'שחרור אוטומטי של המשבצת', desc: 'התור חוזר להיות פנוי, הלקוח יורד מרשימת ההמתנה ונפתח פולו-אפ', on: false },
  { key: 'h4', trigger: 'בתום זמן הנעילה',      title: 'הצעת מועד חלופי אוטומטית', desc: 'נשלחים ללקוח 3 מועדים חלופיים לפי הקריטריונים שלו', on: false },
  { key: 'h5', trigger: 'לאחר סליקה מוצלחת',    title: 'שיריון סופי + אישור ללקוח', desc: 'המשבצת נסגרת, נשלח אישור עם פרטי התור והנחיות הכנה', on: false },
  { key: 'h6', trigger: 'לאחר סליקה מוצלחת',    title: 'הפקת קבלה ותיוק במסמכי הליד', desc: 'קבלה נשמרת אוטומטית בטאב "מסמכים" עם חותמת זמן', on: false },
  { key: 'h7', trigger: 'הסכם נשלח ולא נחתם',   title: 'תזכורת חתימה אוטומטית', desc: 'לפי מספר הימים שהוגדר בהגדרות מנהל › הסכמים', on: false },
  { key: 'h8', trigger: 'בעת חתימת הסכם',        title: 'מעבר אוטומטי לסליקה', desc: 'עם קליטת החתימה נפתח מסך הסליקה והנעילה מוארכת', on: false },
];

/* ---------- 9. תרשים זרימת ליד אוטומטי ---------- */
const LEAD_FLOW = [
  { t: 'ליד נכנס',        s: '21/05 21:15', c: 'blue' },
  { t: 'זיהוי כפילות',    s: 'לא נמצאה התאמה', c: 'gray' },
  { t: 'שיוך נציג',       s: 'סבב שוויוני', c: 'gray' },
  { t: 'מחוץ לשעות?',     s: 'כן · 21:15', c: 'amber', branch: true },
  { t: 'העברה לבוקר',     s: '22/05 08:00', c: 'green' },
  { t: 'פולו-אפ מיידי',   s: 'התראה לנציג + SLA', c: 'brand' },
];

/* ---------- מקרא סטטוסים + סוגי תיאום ---------- */
const STATUS_LEGEND = [
  { label: 'קבע מחדש', color: '#5B4CE6' },
  { label: 'הושלם',    color: '#16A34A' },
  { label: 'באיחור',   color: '#DC2626' },
  { label: 'בהמתנה',   color: '#EA6A2C' },
  { label: 'טרם הוקצה',color: '#9A9EB1' },
];
const APPT_TYPE_LEGEND = [
  { label: 'שיחת פולו-אפ', icon: 'phone' },
  { label: 'פגישה',        icon: 'calendar' },
  { label: 'תור שירות',    icon: 'tasks' },
  { label: 'שיחה עם גורם', icon: 'user' },
];

/* ---------- 25. כללי ניתוב / עדיפות ---------- */
const ROUTING_RULES = ['פעילות', 'מקור ליד', 'אזור', 'סוג שירות', 'שפה', 'מיומנות', 'עומס', 'סבב שוויוני', 'מי שטיפל בעבר'];
const PRIORITY_RULES = ['גיל הליד', 'מקור', 'ערך פוטנציאלי', 'SLA', 'מספר ניסיונות', 'לקוח VIP', 'דחיפות', 'זמן המתנה'];

/* ============================================================
   26. לוח תיאום חי — נתוני העסק (סניפים, מטפלים, סוגי טיפול)
   הקריטריונים נטענים לפי העסק; כאן דמו לעסק רפואי/אסתטי
   ============================================================ */
/* ============================================================
   רשימת ערים/ישובים בישראל — מפולחת לאזורים בסדר גאוגרפי צפון→אילת.
   ord = מיקום גאוגרפי (למיון ולסינון "הסניף הקרוב"). משמש את מערכת הכתובות.
   ============================================================ */
const IL_REGIONS = ['צפון', 'חיפה והקריות', 'השרון', 'מרכז', 'ירושלים והסביבה', 'שפלה', 'דרום', 'אילת'];
const IL_CITIES = [
  { name: 'קרית שמונה', region: 'צפון', ord: 1 }, { name: 'צפת', region: 'צפון', ord: 3 },
  { name: 'טבריה', region: 'צפון', ord: 5 }, { name: 'נהריה', region: 'צפון', ord: 6 },
  { name: 'עכו', region: 'צפון', ord: 7 }, { name: 'כרמיאל', region: 'צפון', ord: 8 },
  { name: 'עפולה', region: 'צפון', ord: 9 },
  { name: 'חיפה', region: 'חיפה והקריות', ord: 12 }, { name: 'קריות', region: 'חיפה והקריות', ord: 13 },
  { name: 'נשר', region: 'חיפה והקריות', ord: 14 }, { name: 'חדרה', region: 'חיפה והקריות', ord: 16 },
  { name: 'נתניה', region: 'השרון', ord: 20 }, { name: 'הרצליה', region: 'השרון', ord: 22 },
  { name: 'רעננה', region: 'השרון', ord: 23 }, { name: 'כפר סבא', region: 'השרון', ord: 24 },
  { name: 'הוד השרון', region: 'השרון', ord: 25 },
  { name: 'פתח תקווה', region: 'מרכז', ord: 30 }, { name: 'תל אביב', region: 'מרכז', ord: 32 },
  { name: 'רמת גן', region: 'מרכז', ord: 33 }, { name: 'גבעתיים', region: 'מרכז', ord: 34 },
  { name: 'חולון', region: 'מרכז', ord: 35 }, { name: 'בת ים', region: 'מרכז', ord: 36 },
  { name: 'ראשון לציון', region: 'מרכז', ord: 37 },
  { name: 'ירושלים', region: 'ירושלים והסביבה', ord: 42 }, { name: 'בית שמש', region: 'ירושלים והסביבה', ord: 44 },
  { name: 'מעלה אדומים', region: 'ירושלים והסביבה', ord: 45 },
  { name: 'מודיעין', region: 'שפלה', ord: 48 }, { name: 'רחובות', region: 'שפלה', ord: 50 },
  { name: 'נס ציונה', region: 'שפלה', ord: 51 }, { name: 'לוד', region: 'שפלה', ord: 52 }, { name: 'רמלה', region: 'שפלה', ord: 53 },
  { name: 'אשדוד', region: 'דרום', ord: 58 }, { name: 'אשקלון', region: 'דרום', ord: 60 },
  { name: 'קרית גת', region: 'דרום', ord: 62 }, { name: 'באר שבע', region: 'דרום', ord: 66 },
  { name: 'דימונה', region: 'דרום', ord: 68 }, { name: 'ערד', region: 'דרום', ord: 69 },
  { name: 'אילת', region: 'אילת', ord: 90 },
];
const IL_STREETS = ['הרצל', 'ויצמן', 'בן גוריון', 'ז׳בוטינסקי', 'רוטשילד', 'אלנבי', 'ביאליק', 'סוקולוב', 'ההסתדרות', 'הנשיא', 'העצמאות', 'הגליל', 'הרימון', 'התאנה', 'ההגנה', 'המלך דוד', 'אחד העם'];
function ilCity(name) { return IL_CITIES.find(c => c.name === name); }
function branchOrd(b) { const c = b.city && ilCity(b.city); return c ? c.ord : (b.ord != null ? b.ord : 999); }

/* סניף: active=מופעל · days=ימי פתיחה (0=א׳..6=ש׳) · from/to=שעות · treatments=טיפולים · mgr · city/street/num=כתובת */
const COORD_BRANCHES = [
  { key: 'tlv',      label: 'סניף ראשי – תל אביב', short: 'תל אביב',  city: 'תל אביב', street: 'רוטשילד', num: '45', on: true,  active: true,  days: [0,1,2,3,4], from: 8, to: 19, treatments: ['consult','followup','facial','injection','laser'], mgr: 'ml' },
  { key: 'haifa',    label: 'סניף צפון – חיפה',    short: 'חיפה',    city: 'חיפה', street: 'הנשיא', num: '12', on: true,  active: true,  days: [0,1,2,3,4], from: 8, to: 17, treatments: ['consult','followup','facial'], mgr: 'az' },
  { key: 'bsheva',   label: 'סניף דרום – באר שבע', short: 'באר שבע', city: 'באר שבע', street: 'הרצל', num: '30', on: true,  active: true,  days: [0,1,2,3,4], from: 8, to: 18, treatments: ['consult','followup','injection'], mgr: 'sa' },
  { key: 'jlm',      label: 'סניף ירושלים',        short: 'ירושלים', city: 'ירושלים', street: 'המלך דוד', num: '8', on: false, active: true,  days: [0,1,2,3],   from: 9, to: 16, treatments: ['consult','followup','laser'], mgr: 'rl' },
  { key: 'herzliya', label: 'סניף הרצליה',         short: 'הרצליה',  city: 'הרצליה', street: 'סוקולוב', num: '22', on: false, active: true,  days: [0,2,4],     from: 8, to: 18, treatments: ['facial','injection','laser'], mgr: 'dp' },
  { key: 'modiin',   label: 'סניף מודיעין',        short: 'מודיעין', city: 'מודיעין', street: 'הרימון', num: '5', on: false, active: false, days: [0,1,2,3,4], from: 8, to: 17, treatments: ['facial','laser'], mgr: 'no' },
];
/* ============================================================
   מקור-אמת יחיד לכל המשתמשים/המטפלים במערכת = מסך ההגדרות ("ניהול עובדים").
   כל המסכים — יומן, לוח תיאום, אשף התיאום — נגזרים מכאן, כדי שלא יופיעו
   אנשי צוות שונים במקומות שונים. שדות סניף/מגדר/מיומנות משמשים את לוח התיאום.
   ============================================================ */
/* sched (אופציונלי): מטפל שעובד בכמה סניפים בשעות שונות עם הפסקה — {branch, from, to} */
let STAFF = [
  { id: 'yk', name: 'יואב כהן',  dept: 'הנהלה',  role: 'מנהל פעילות',  perm: 'מנהל רשת', occ: ['פגישות', 'שיחות יוצאות'], resp: ['לידים חדשים', 'לקוחות VIP'], avail: 'available', branch: 'tlv',      gender: 'm', on: true,  skills: ['consult','followup','injection'], branches: ['tlv','bsheva'],
    sched: [{ branch: 'tlv', from: 8, to: 12 }, { branch: 'bsheva', from: 13, to: 18 }] },   // בוקר ת״א · צהריים הפסקה · אחה״צ ב״ש
  { id: 'ml', name: 'מיכל רוזן', dept: 'מכירות', role: 'נציגת מכירות', perm: 'מנהל סניף', occ: ['פגישות', 'שיחות נכנסות'],  resp: ['אזור מרכז'], avail: 'available', branch: 'tlv',      gender: 'f', on: true,  skills: ['facial','injection','laser'], branches: ['tlv'] },
  { id: 'az', name: 'אבי זוהר',  dept: 'שירות',  role: 'נציג שירות',   perm: 'מנהל סניף', occ: ['תמיכה', 'שיחות נכנסות'],    resp: ['אזור חיפה'], avail: 'available', branch: 'haifa',    gender: 'm', on: true,  skills: ['consult','followup','facial'], branches: ['haifa','herzliya'],
    sched: [{ branch: 'haifa', from: 8, to: 12 }, { branch: 'herzliya', from: 14, to: 18 }] },  // בוקר חיפה · הפסקה · אחה״צ הרצליה
  { id: 'sa', name: 'שרון אביב', dept: 'שירות',  role: 'נציגת שירות',  perm: 'נציג', occ: ['תמיכה טכנית', 'שיחות נכנסות'], resp: ['תלונות'], avail: 'active', branch: 'bsheva',   gender: 'f', on: true,  skills: ['consult','followup'], branches: ['bsheva'] },
  { id: 'rl', name: 'רותם לוי',  dept: 'מכירות', role: 'נציג',         perm: 'נציג', occ: ['שיחות יוצאות'], resp: ['אזור צפון'], avail: 'offline', branch: 'jlm',      gender: 'm', on: false, skills: ['consult','laser'], branches: ['jlm'] },
  { id: 'dp', name: 'דנה פרל',   dept: 'גבייה',  role: 'נציגת גבייה',  perm: 'נציג', occ: ['גבייה', 'שיחות יוצאות'], resp: ['גבייה', 'חידושים'], avail: 'available', branch: 'herzliya', gender: 'f', on: false, skills: ['followup'], branches: ['herzliya'] },
  { id: 'no', name: 'נועם אור',  dept: 'מכירות', role: 'נציג מכירות',  perm: 'נציג', occ: ['שיחות יוצאות'], resp: ['אזור דרום'], avail: 'offline', branch: 'modiin',   gender: 'm', on: false, skills: ['facial','laser'], branches: ['modiin'] },
];
/* מטפלי לוח התיאום — נגזרים מ-STAFF (אותם אנשים בדיוק) */
let COORD_DOCTORS = [];
/* גזירת מטפלי-הלוח מ-STAFF (מקור-האמת מההגדרות) — נקרא מחדש אחרי עריכות בהגדרות */
function syncCoordStaff() {
  COORD_DOCTORS = STAFF.map(s => ({ key: s.id, name: s.name, branch: (s.branches && s.branches[0]) || s.branch, gender: s.gender, on: s.on, skills: s.skills, sched: s.sched || null, branches: s.branches || [s.branch] }));
  if (typeof window !== 'undefined') window.__coordPool = null;   // בניית מאגר הזמינות מחדש
}
syncCoordStaff();
/* הסניף של מטפל בשעה נתונה — תומך בכמה סניפים עם הפסקה (מחזיר null בהפסקה) */
function coordBranchAt(doc, h) {
  if (doc && doc.sched) { const seg = doc.sched.find(x => h >= x.from && h < x.to); return seg ? seg.branch : null; }
  return doc ? doc.branch : null;
}
/* קטלוג שירותים/מוצרים/טיפולים — מקור-אמת אחד: אורך, קטגוריה, הנחיות מקדימות והנחיות ביצוע.
   ההנחיות מוגדרות כאן (לא במסך העובד) — העובד רק משויך לפי מיומנות למה שקיים בקטלוג. */
const CATALOG_KINDS = ['שירות', 'טיפול', 'מוצר'];
const COORD_TREATMENTS = [
  { key: 'consult',   label: 'ייעוץ ראשוני',      color: 'green',  dur: 30,  equip: false, approval: false, kind: 'שירות',
    pre: 'ללא הכנה מיוחדת · לוודא מסמכים רלוונטיים', instr: 'שיחת אבחון · מיפוי צרכים · הצגת המשך' },
  { key: 'followup',  label: 'מעקב',              color: 'brand',  dur: 30,  equip: false, approval: false, kind: 'שירות',
    pre: 'לעיין בתיק ובטיפול הקודם', instr: 'בדיקת התקדמות · תיעוד · קביעת המשך' },
  { key: 'facial',    label: 'טיפול פנים אסתטי',  color: 'blue',   dur: 60,  equip: true,  approval: false, kind: 'טיפול',
    pre: 'ללא איפור · הימנעות מחשיפה לשמש 24ש׳ לפני', instr: 'ניקוי · פילינג · מסכה · לחות · הנחיות המשך' },
  { key: 'injection', label: 'הזרקות',            color: 'red',    dur: 45,  equip: true,  approval: true,  kind: 'טיפול',
    pre: 'הפסקת מדללי דם 5 ימים לפני (באישור רופא) · צום לא נדרש', instr: 'סימון · חיטוי · הזרקה מדורגת · קירור · הנחיות' },
  { key: 'laser',     label: 'טיפול לייזר',       color: 'orange', dur: 45,  equip: true,  approval: false, kind: 'טיפול',
    pre: 'ללא שיזוף/שעווה 14 יום לפני · גילוח האזור', instr: 'בדיקת עור · הגנת עיניים · מעברי לייזר · קירור · קרם הגנה' },
];
/* ימי הדמו (מאי 2024) — dow: 0=ראשון … 6=שבת */
const COORD_DAYS = [
  { date: '2024-05-23', dow: 4 }, { date: '2024-05-24', dow: 5 },
  { date: '2024-05-26', dow: 0 }, { date: '2024-05-27', dow: 1 },
  { date: '2024-05-28', dow: 2 }, { date: '2024-05-30', dow: 4 },
];
/* מצב פיתוח: "היום" ושעת-הייחוס קבועים (במקום השעון האמיתי) — כדי שהדמו,
   שרוב תאריכיו לפני 2026, לא ייצבע כולו באדום, וכדי לאמת שאין תורים אחורה.
   נשלט מתג הפיתוח בפינה (initDevClock). COORD_TODAY = let כדי שניתן לעדכן. */
let COORD_TODAY = '2024-05-23';
let APP_NOW = { min: 8 * 60 };   // 08:00 של COORD_TODAY

/* ---------- יומן רב-עובדים — נגזר מ-STAFF (3 בעלי היומן עם אירועי דמו) ---------- */
const CAL_OWNERS = STAFF.filter(s => ['yk', 'ml', 'az'].includes(s.id)).map(s => s.name);
/* המשתמש המחובר — רואה פירוט מלא רק ביומן שלו; אחרים = "תפוס" בלבד (אלא אם מנהל ראשי) */
const CURRENT_USER = 'יואב כהן';
const CAL_EVENTS = {
  'יואב כהן': [
    { h: 8,  dur: 1,   t: 'שיחת סטטוס', c: 'brand' },
    { h: 9.5,dur: .5,  t: 'ישראל כהן – פגישה', c: 'green', recId: 1 },
    { h: 9.5,dur: .5,  t: 'שיחת ספק', c: 'blue' },       // חפיפה בשעה 9
    { h: 11, dur: 1,   t: 'ישיבת צוות', c: 'blue' },
    { h: 13, dur: 1,   t: 'הפסקת צהריים', c: 'gray' },
    { h: 16, dur: 1,   t: 'פולו אפ – שרון אביב', c: 'orange', recId: 5 },
  ],
  'מיכל רוזן': [
    { h: 9,  dur: 1.5, t: 'הדרכה', c: 'blue' },
    { h: 11, dur: 1,   t: 'שיחה עם ספק', c: 'green' },
    { h: 14, dur: .5,  t: 'מיכל רוזן – תור', c: 'orange', recId: 4 },
    { h: 14, dur: .5,  t: 'ליאת כהן – פגישה', c: 'green', recId: 15 },  // חפיפה בשעה 14
  ],
  'אבי זוהר': [
    { h: 10, dur: 1,   t: 'אבי רוזן – ייעוץ', c: 'green', recId: 3 },
    { h: 13.5,dur: 1,  t: 'סיור', c: 'brand' },
    { h: 15, dur: 1,   t: 'רונית שגב – גבייה', c: 'orange', recId: 7 },
  ],
};

/* ---------- ציר תקשורת / תיעוד (9) ---------- */
const COMM_TYPES = {
  call:     { label: 'שיחה',            icon: 'phone',    color: 'green'  },
  wa:       { label: 'WhatsApp',        icon: 'whatsapp', color: 'green'  },
  mail:     { label: 'מייל',            icon: 'mail',     color: 'blue'   },
  noanswer: { label: 'אין מענה',        icon: 'phone',    color: 'red'    },
  callback: { label: 'ביקש לחזור מאוחר',icon: 'clock',    color: 'amber'  },
  note:     { label: 'הערה',            icon: 'note',     color: 'gray'   },
};
const COMM_LOG = [
  { type: 'wa',       at: '22/05 08:46', by: 'מערכת',    text: 'נשלח אישור פגישה ב-WhatsApp' },
  { type: 'call',     at: '22/05 08:40', by: 'יואב כהן', text: 'שיחה · 3 דק׳ · הלקוח מעוניין, ביקש פגישה' },
  { type: 'callback', at: '21/05 17:22', by: 'יואב כהן', text: 'הלקוח ביקש שנחזור אליו מחר בבוקר' },
  { type: 'noanswer', at: '21/05 17:20', by: 'יואב כהן', text: 'ניסיון חיוג — אין מענה' },
  { type: 'mail',     at: '21/05 15:00', by: 'יואב כהן', text: 'נשלח חומר שיווקי במייל' },
  { type: 'note',     at: '21/05 14:30', by: 'מיכל רוזן', text: 'ליד איכותי מקמפיין גוגל' },
];
const COMM_ADD_TYPES = ['call', 'wa', 'mail', 'noanswer', 'callback', 'note'];

/* ---------- אנשי קשר לליד/לקוח (ריבוי אנשי קשר + תפקידים) ---------- */
/* תפקידים — מקסימום 6 נפוצים + "אחר"; תפקיד מותאם נכנס לרשימה לפעמים הבאות */
let CONTACT_ROLES = ['איש קשר ראשי', 'מנכ"ל', 'בעלים', 'הנהלת חשבונות', 'אחר'];
const CUSTOM_ROLES = [];
function addCustomRole(role) {
  role = (role || '').trim();
  if (!role || CONTACT_ROLES.includes(role)) return;
  CONTACT_ROLES.splice(CONTACT_ROLES.length - 1, 0, role);   // לפני "אחר"
  CUSTOM_ROLES.push(role);
  while (CONTACT_ROLES.length > 7) {                          // עד 6 + "אחר"
    const oldest = CUSTOM_ROLES.shift();
    const i = CONTACT_ROLES.indexOf(oldest);
    if (i >= 0) CONTACT_ROLES.splice(i, 1); else break;
  }
}
function contactsFor(r) {
  if (!r.contacts) r.contacts = [{ name: r.name, role: 'איש קשר ראשי', phone: r.phone || '', mail: r.mail || '', primary: true }];
  return r.contacts;
}
/* סנכרון איש הקשר הראשי לנתוני הרשומה (טלפון/מייל למעלה + לשיחה יוצאת) */
function syncPrimaryContact(r) {
  const p = contactsFor(r).find(c => c.primary) || contactsFor(r)[0];
  if (!p) return;
  r.phone = p.phone || '';
  r.mail = p.mail || '';
}

/* ציר תקשורת פר-רשומה — נגזר מהנתונים האמיתיים של הליד */
function commLogFor(r) {
  if (!r.commLog) r.commLog = buildCommLog(r);
  return r.commLog;
}
function buildCommLog(r) {
  const log = [];
  if (r.meeting) {
    log.push({ type: 'wa',   at: '22/05 08:46', by: 'מערכת',   text: `נשלח אישור פגישה ב-WhatsApp (${r.meeting.date} ${r.meeting.time})` });
    log.push({ type: 'call', at: '22/05 08:40', by: r.assignee, text: `שיחה · 3 דק׳ · ${r.name.split(' ')[0]} אישר/ה את הפגישה` });
  }
  if (r.next?.type === 'followup') log.push({ type: 'callback', at: '21/05 17:22', by: r.assignee, text: `הלקוח ביקש שנחזור אליו — נקבע פולו-אפ ${r.next.at || ''}` });
  if (r.overdue) log.push({ type: 'noanswer', at: '21/05 17:20', by: r.assignee, text: 'ניסיון חיוג — אין מענה' });
  if (r.journey === 'billing') log.push({ type: 'mail', at: '21/05 15:00', by: 'מערכת', text: 'נשלחה דרישת תשלום במייל' });
  if (r.journey === 'support') log.push({ type: 'call', at: '21/05 16:05', by: r.assignee, text: `שיחת אבחון · ${r.subject}` });
  if (r.journey === 'upsell')  log.push({ type: 'mail', at: '21/05 12:10', by: r.assignee, text: 'נשלחה הצעת הרחבה במייל' });
  log.push({ type: 'note', at: '21/05 14:30', by: 'מערכת', text: `הפנייה נקלטה · מקור: ${r.source} · מסלול ${(JOURNEY_TYPES[r.journey] || {}).label || ''}` });
  return log;
}

/* ============================================================
   26. מדדים ודוחות
   ============================================================ */
const METRICS = [
  { label: 'זמן תגובה לליד חדש',   value: '4.2', unit: 'דק\'',  trend: -18, good: 'down', icon: 'clock' },
  { label: 'זמן עד שיחה ראשונה',   value: '11',  unit: 'דק\'',  trend: -9,  good: 'down', icon: 'phone' },
  { label: 'זמן עד קביעת פגישה',   value: '1.4', unit: 'ימים', trend: -22, good: 'down', icon: 'calendar' },
  { label: 'אחוז הגעה',            value: '87',  unit: '%',    trend: 5,   good: 'up',   icon: 'check' },
  { label: 'אחוז ביטולים',         value: '6',   unit: '%',    trend: -3,  good: 'down', icon: 'close' },
  { label: 'אחוז אי-הגעה',         value: '4',   unit: '%',    trend: -2,  good: 'down', icon: 'alert' },
  { label: 'זמן ממוצע לסגירה',     value: '3.1', unit: 'ימים', trend: -11, good: 'down', icon: 'tasks' },
  { label: 'ניצול יומן',           value: '78',  unit: '%',    trend: 8,   good: 'up',   icon: 'layers' },
  { label: 'צמצום פערים',          value: '64',  unit: '%',    trend: 12,  good: 'up',   icon: 'target' },
  { label: 'עמידה ב-SLA',          value: '92',  unit: '%',    trend: 4,   good: 'up',   icon: 'flag' },
  { label: 'המרה ליד → פגישה',     value: '41',  unit: '%',    trend: 7,   good: 'up',   icon: 'leads' },
  { label: 'המרה פגישה → עסקה',    value: '33',  unit: '%',    trend: -2,  good: 'up',   icon: 'reports' },
];
const FUNNEL = [
  { label: 'לידים',    value: 120, color: 'blue'  },
  { label: 'פגישות',   value: 49,  color: 'brand' },
  { label: 'הצעות',    value: 31,  color: 'amber' },
  { label: 'עסקאות',   value: 16,  color: 'green' },
];
const REP_STATS = [
  { name: 'יואב כהן',  meetings: 34, util: 82 },
  { name: 'מיכל רוזן', meetings: 28, util: 74 },
  { name: 'אבי זוהר',  meetings: 21, util: 61 },
  { name: 'רותם לוי',  meetings: 17, util: 55 },
];
const FOLLOWUP_STATS = { total: 142, done: 118, overdue: 9, scheduled: 15 };

/* ============================================================
   ניהול עובדים – מחלקות · תפקידים · תחומי עיסוק ואחריות
   ============================================================ */
const DEPARTMENTS    = ['מכירות', 'שירות', 'גבייה', 'תפעול', 'הנהלה'];
const ROLE_PRESETS   = ['נציג', 'נציג בכיר', 'מנהל מוקד', 'מנהל', 'אדמין'];
const OCCUPATIONS    = ['שיחות נכנסות', 'שיחות יוצאות', 'פגישות', 'הדרכות', 'התקנות', 'גבייה', 'שימור', 'תמיכה טכנית'];
const RESPONSIBILITIES = ['לידים חדשים', 'לקוחות VIP', 'אזור צפון', 'אזור מרכז', 'אזור דרום', 'חידושים', 'תלונות', 'גבייה'];
const AVAIL_STATES = {
  available: { label: 'זמין ונגיש', color: '#16A34A' },
  active:    { label: 'פעיל · לא בדף', color: '#2F6BEB' },
  offline:   { label: 'לא מחובר', color: '#9A9EB1' },
};
/* STAFF מוגדר למעלה כמקור-אמת יחיד (כולל שדות סניף/מגדר/מיומנות ללוח התיאום) */

/* ============================================================
   19. הרשאות – מטריצת תפקידים
   ============================================================ */
/* היררכיית ההרשאות (מחוברת ממערכת חיצונית): עובד → מנהל סניף → מנהל רשת → אדמין */
const ROLES = ['נציג', 'מנהל סניף', 'מנהל רשת', 'אדמין'];
const PERMISSIONS = [
  { label: 'צפייה',                grants: [1,1,1,1] },
  { label: 'עריכה',                grants: [1,1,1,1] },
  { label: 'קביעת פגישה',          grants: [1,1,1,1] },
  { label: 'שינוי גורם מטפל',      grants: [0,1,1,1] },
  { label: 'צפייה ביומן אחר',      grants: [0,1,1,1] },
  { label: 'ביטול',               grants: [1,1,1,1] },
  { label: 'שינוי Workflow',       grants: [0,0,1,1] },
  { label: 'דריסת מגבלת זמן',      grants: [0,0,1,1] },
  { label: 'קביעה בשעה חסומה',     grants: [0,1,1,1] },
  { label: 'אישור חריגה',          grants: [0,1,1,1] },
  { label: 'צפייה בהקלטות',        grants: [0,1,1,1] },
  { label: 'מחיקת תיעוד',          grants: [0,0,0,1] },
  { label: 'ייצוא מידע',           grants: [0,1,1,1] },
  { label: 'ניהול הסכמי עובדים',   grants: [0,0,1,1] },
];

/* ============================================================
   25.5 רשימת המתנה (Waitlist)
   ============================================================ */
const WAITLIST = [
  { name: 'גיל שמש',   req: 'היום 10:00–11:00', svc: 'פגישה',    since: '08:15', pos: 1 },
  { name: 'תמר גל',    req: 'מחר בבוקר',        svc: 'תור שירות', since: 'אתמול', pos: 2 },
  { name: 'דור אוחיון',req: 'היום אחה"צ',       svc: 'פולו-אפ',   since: '09:40', pos: 3 },
];

/* ============================================================
   שלב ד' – המלצות AI
   ============================================================ */
const AI_INSIGHTS = [
  { type: 'סיכון אי-הגעה', name: 'יואב בן דוד', level: 'high',   text: 'סבירות 72% לאי-הגעה · הליד לא ענה ל-2 ניסיונות', action: 'שלח תזכורת WhatsApp' },
  { type: 'זמן אופטימלי',  name: 'דנה לוי',     level: 'info',   text: 'ההמרה הגבוהה ביותר שלה בשעות הבוקר (09:00–11:00)', action: 'הצע 09:30' },
  { type: 'פעולה מומלצת',  name: 'אבי רוזן',    level: 'info',   text: 'לא היה מגע 4 ימים אחרי הצעת המחיר', action: 'צור פולו-אפ חם' },
  { type: 'עומס צפוי',     name: 'יום חמישי',   level: 'medium', text: 'עומס גבוה ב-14:00–16:00 · שקול פתיחת חלון נוסף', action: 'הוסף חלון' },
];

/* ---------- ניווט צד ---------- */
const NAV = [
  { key: 'home',      label: 'ראשי',      icon: 'home' },
  { key: 'leads',     label: 'לידים',     icon: 'leads' },
  { key: 'meetings',  label: 'פגישות',    icon: 'calendar', active: true },
  { key: 'calls',     label: 'שיחות',     icon: 'phone' },
  { key: 'whatsapp',  label: 'וואטסאפ',   icon: 'whatsapp' },
  { key: 'mail',      label: 'דוא"ל',     icon: 'mail' },
  { key: 'docs',      label: 'מסמכים',    icon: 'docs' },
  { key: 'clients',   label: 'לקוחות',    icon: 'clients' },
];
/* קבוצת "ניהול" — מתקפלת בסיידבר כדי לא לתפוס מקום */
const NAV_MANAGE = [
  { key: 'reports',    label: 'דוחות',       icon: 'reports' },
  { key: 'automation', label: 'אוטומציות',   icon: 'bolt' },
  { key: 'contracts',  label: 'מערכת חוזים', icon: 'docs' },
  { key: 'settings',   label: 'הגדרות',      icon: 'settings' },
];
