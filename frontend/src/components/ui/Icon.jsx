/**
 * Inline icon set.
 *
 * Hand-drawn 24x24 stroke icons rather than an icon dependency: it keeps the
 * bundle small, guarantees a consistent 1.6px stroke weight and means no
 * external font or sprite is fetched at runtime.
 */
const PATHS = {
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 18l-6-6 6-6',
  arrowUpRight: 'M7 17 17 7M9 7h8v8',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M6 15l6-6 6 6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronLeft: 'M15 6l-6 6 6 6',
  calendar: 'M8 3v3M16 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  clock: 'M12 8v4l2.5 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  mapPin: 'M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  car: 'M5 17h14M4 17v-4.2c0-.6.3-1.2.9-1.5l1.5-.8 1.6-3.1A2 2 0 0 1 9.8 6h4.4a2 2 0 0 1 1.8 1.4l1.6 3.1 1.5.8c.6.3.9.9.9 1.5V17M7 19.5h1.5M15.5 19.5H17M6.5 13.5h1M16.5 13.5h1',
  users: 'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.6a3.5 3.5 0 0 1 0 6.8',
  user: 'M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5a7.5 7.5 0 0 1 15 0',
  fuel: 'M4 20V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14M3 20h11M4 11h8M15 8h2.5a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-2-3',
  zap: 'M13 3 5.5 13.5H11l-1 7.5 7.5-10.5H12l1-7.5Z',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H2.8a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.2 8.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9.9 4.1V4a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 16.8 5.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  seat: 'M7 4h4a3 3 0 0 1 3 3v6H7V4ZM14 13h3v4a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-1M5 20h14',
  door: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7V3ZM14 3l5 2v14l-5 2M13 12h.01',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.9-5.2 2.9 1-5.9L3.5 9.7l5.9-.8L12 3.5Z',
  check: 'M4 12.5 9.5 18 20 6.5',
  checkCircle: 'M9 12.5l2.2 2.2L15.5 10M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  x: 'M6 6l12 12M18 6 6 18',
  alert: 'M12 9v4M12 16.5h.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z',
  info: 'M12 16v-4M12 8h.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.5-3.5',
  filter: 'M4 6h16M7 12h10M10 18h4',
  menu: 'M4 7h16M4 12h16M4 17h16',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  edit: 'M4 20h4l10-10-4-4L4 16v4ZM14.5 5.5l4 4',
  trash: 'M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13M10 11v6M14 11v6',
  download: 'M12 4v11M8 11l4 4 4-4M5 20h14',
  upload: 'M12 16V5M8 9l4-4 4 4M5 20h14',
  logout: 'M15 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9M12 12h9M17 8.5 20.5 12 17 15.5',
  bell: 'M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15L18 15.5ZM10 21h4',
  wrench: 'M14.5 4.5a4.5 4.5 0 0 0 5.9 5.9L21 11l-9.5 9.5a2.5 2.5 0 0 1-3.5-3.5L17.5 7.5l-3-3Z',
  shield: 'M12 3l7 3v5.5c0 4.4-2.9 8.2-7 9.5-4.1-1.3-7-5.1-7-9.5V6l7-3ZM9 12.5l2 2 4-4',
  card: 'M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9ZM3 10h18M6.5 14.5h4',
  cash: 'M3 7h18v10H3V7ZM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v4M18 10v4',
  chart: 'M4 20V4M4 20h16M8 16V9M12.5 16v-4M17 16V6',
  dashboard: 'M4 13h6V4H4v9ZM14 20h6v-9h-6v9ZM4 20h6v-4H4v4ZM14 8h6V4h-6v4Z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  sparkles: 'M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3ZM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z',
  leaf: 'M4 20s2-9 8.5-12.5C15.6 5.5 20 5 20 5s.5 5.5-2.5 9C14 18 4 20 4 20ZM4 20c2-5 5-8 8.5-10',
  gauge: 'M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 12l4-4M4 19a9 9 0 1 1 16 0',
  file: 'M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-6-6ZM13 3v6h6M9 13h6M9 17h4',
  key: 'M15 8.5a4.5 4.5 0 1 0-4.2 4.5L9 15H7v2H5v2H3v-3l8.3-6.2A4.5 4.5 0 0 1 15 8.5ZM16 8h.01',
  mail: 'M3 7l9 6 9-6M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  phone: 'M6 3h3l1.5 4-2 1.5a12 12 0 0 0 5 5L15 11.5 19 13v3a2 2 0 0 1-2.2 2A15 15 0 0 1 4 5.2 2 2 0 0 1 6 3Z',
  eye: 'M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12ZM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  eyeOff: 'M4 4l16 16M9.9 5A7.8 7.8 0 0 1 12 6.5c6 0 9.5 5.5 9.5 5.5a17 17 0 0 1-2.4 3M6.4 8.2A16.6 16.6 0 0 0 2.5 12S6 17.5 12 17.5c1 0 2-.2 2.9-.6M10 10a2.5 2.5 0 0 0 3.5 3.5',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.5 9h17M3.5 15h17M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z',
  phoneCall: 'M6 3h3l1.5 4-2 1.5a12 12 0 0 0 5 5L15 11.5 19 13v3a2 2 0 0 1-2.2 2A15 15 0 0 1 4 5.2 2 2 0 0 1 6 3Z',
  building: 'M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15M14 21V10h4a2 2 0 0 1 2 2v9M3 21h18M7 8h2M7 12h2M7 16h2M17 13h1M17 17h1',
  tag: 'M20 12.5 12.5 20 4 11.5V4h7.5L20 12.5ZM7.5 7.5h.01',
  cloudDownload: 'M12 15V6M9 9l3-3 3 3M7 19h10a4 4 0 0 0 .6-8 5.5 5.5 0 0 0-10.6-1A3.5 3.5 0 0 0 7 19Z',
};

export default function Icon({ name, size = 18, className = '', strokeWidth = 1.6, ...rest }) {
  const path = PATHS[name] || PATHS.info;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {path.split(' M').map((segment, index) => (
        <path key={index} d={index === 0 ? segment : `M${segment}`} />
      ))}
    </svg>
  );
}

export const ICON_NAMES = Object.keys(PATHS);
