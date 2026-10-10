// Inline SVG icons for the HUD, drawn to read like chunky toy-game art.
const svg = (vb, body) => `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`

export const ICONS = {
  wind: svg(
    '0 0 40 40',
    '<g fill="none" stroke-linecap="round"><g stroke="#121212" stroke-width="8"><path d="M5 14 H23 a5 5 0 1 0 -5 -5"/><path d="M5 22 H31 a5.5 5.5 0 1 1 -5.5 5.5"/><path d="M5 30 H17"/></g><g stroke="#bff3ff" stroke-width="4"><path d="M5 14 H23 a5 5 0 1 0 -5 -5"/><path d="M5 22 H31 a5.5 5.5 0 1 1 -5.5 5.5"/><path d="M5 30 H17"/></g></g>',
  ),
  logo: svg('0 0 40 40', '<path d="M8 32 C8 14 20 6 34 6 C34 22 26 32 10 32 Z" fill="#5fd84a" stroke="#fff" stroke-width="2.5"/><path d="M10 31 L26 15" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>'),
  menu: svg('0 0 40 40', '<path d="M8 12h24M8 20h24M8 28h24" stroke="#fff" stroke-width="3" stroke-linecap="round"/>'),
  chat: svg('0 0 40 40', '<path d="M8 9h24a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H18l-7 6v-6H8a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2z" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>'),
  tornado: svg(
    '0 0 64 64',
    `<defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bff6ff"/><stop offset="1" stop-color="#1fa6e0"/></linearGradient></defs>
    <g fill="none" stroke="#0c3a5a" stroke-width="9" stroke-linecap="round">
      <path d="M8 12c10-6 38-6 48 0"/><path d="M12 24c8-5 30-5 38 0"/><path d="M18 36c6-4 20-4 26 0"/><path d="M24 47c4-3 12-3 16 0"/><path d="M30 57c2-2 4-2 6 0"/></g>
    <g fill="none" stroke="url(#tg)" stroke-width="5" stroke-linecap="round">
      <path d="M8 12c10-6 38-6 48 0"/><path d="M12 24c8-5 30-5 38 0"/><path d="M18 36c6-4 20-4 26 0"/><path d="M24 47c4-3 12-3 16 0"/><path d="M30 57c2-2 4-2 6 0"/></g>`,
  ),
  gun: svg(
    '0 0 200 120',
    `<defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fe8ff"/><stop offset="1" stop-color="#1a4f9a"/></linearGradient></defs>
    <g transform="rotate(-18 100 60)" stroke="#0a1a2e" stroke-width="5" stroke-linejoin="round">
      <rect x="30" y="40" width="110" height="44" rx="10" fill="url(#gb)"/>
      <rect x="14" y="48" width="26" height="28" rx="6" fill="#9ff4ff"/>
      <ellipse cx="148" cy="62" rx="26" ry="34" fill="#1e3a6a"/>
      <ellipse cx="148" cy="62" rx="17" ry="24" fill="#6ff0ff"/>
      <ellipse cx="148" cy="62" rx="6" ry="9" fill="#0a1a2e"/>
      <rect x="62" y="22" width="44" height="22" rx="6" fill="#2a6ad0"/>
      <rect x="70" y="80" width="18" height="26" rx="5" fill="#1a3a6a"/>
    </g>
    <g fill="#bff8ff" opacity=".9"><circle cx="20" cy="40" r="4"/><circle cx="8" cy="70" r="3"/><circle cx="34" cy="98" r="3"/></g>`,
  ),
  pencil: svg(
    '0 0 64 64',
    `<g transform="rotate(40 32 32)" stroke="#2a1a0a" stroke-width="3" stroke-linejoin="round">
      <rect x="24" y="2" width="16" height="10" rx="3" fill="#ff8fb0"/>
      <rect x="24" y="12" width="16" height="5" fill="#d8d8e0"/>
      <rect x="24" y="17" width="16" height="30" fill="#ffcc2a"/>
      <path d="M24 47 L40 47 L32 62 Z" fill="#f6d2a2"/>
      <path d="M29.5 57 L34.5 57 L32 62 Z" fill="#333"/></g>`,
  ),
  book: svg(
    '0 0 64 64',
    `<g stroke="#0a1a3a" stroke-width="3" stroke-linejoin="round">
      <path d="M8 18 L34 8 L56 20 L30 32 Z" fill="#4fa0ff"/>
      <path d="M8 18 L30 32 L30 56 L8 42 Z" fill="#2a6ad8"/>
      <path d="M30 32 L56 20 L56 44 L30 56 Z" fill="#f2f2f2"/>
      <path d="M34 36 L52 28 M34 42 L52 34 M34 48 L52 40" stroke="#b8c4d8" stroke-width="2"/>
      <path d="M44 14 L44 26 L48 23 L52 27 L52 17" fill="#e23a3a" stroke-width="2"/></g>`,
  ),
  basket: svg(
    '0 0 64 64',
    `<g stroke="#3a0a0a" stroke-width="3" stroke-linejoin="round">
      <path d="M18 28 C18 6 46 6 46 28" fill="none" stroke-width="5"/>
      <path d="M18 28 C18 6 46 6 46 28" fill="none" stroke="#3aa0ff" stroke-width="2.5"/>
      <path d="M6 26 L58 26 L52 54 L12 54 Z" fill="#e8283a"/>
      <path d="M6 26 L58 26 L56 33 L8 33 Z" fill="#ff5a6a"/>
      <path d="M20 36 L22 50 M32 36 L32 50 M44 36 L42 50" stroke="#a01020" stroke-width="3"/></g>`,
  ),
  gear: svg(
    '0 0 64 64',
    `<g stroke="#1a1a24" stroke-width="3" stroke-linejoin="round">
      <path d="M28 4h8l2 8 6 3 7-5 6 6-5 7 3 6 8 2v8l-8 2-3 6 5 7-6 6-7-5-6 3-2 8h-8l-2-8-6-3-7 5-6-6 5-7-3-6-8-2v-8l8-2 3-6-5-7 6-6 7 5 6-3z" fill="#9aa4b8"/>
      <circle cx="32" cy="32" r="10" fill="#4a5468"/></g>`,
  ),
  rebirth: `<img src="${import.meta.env.BASE_URL}UI/rebirth.png" alt="" draggable="false" style="display:block;width:100%;height:100%;object-fit:contain">`,
  invite: svg(
    '0 0 64 64',
    `<g stroke="#2a2a0a" stroke-width="3" stroke-linejoin="round">
      <rect x="18" y="4" width="26" height="22" rx="8" fill="#ffd21a"/>
      <circle cx="26" cy="14" r="2" fill="#222" stroke="none"/><circle cx="36" cy="14" r="2" fill="#222" stroke="none"/>
      <path d="M25 19 Q31 23 37 19" fill="none" stroke-width="2"/>
      <rect x="12" y="28" width="38" height="28" rx="5" fill="#2a7ae8"/>
      <rect x="40" y="38" width="20" height="20" rx="4" fill="#3ad24a"/>
      <path d="M50 42 L50 54 M44 48 L56 48" stroke="#fff" stroke-width="4"/></g>`,
  ),
  calendar: svg(
    '0 0 64 64',
    `<g stroke="#1a1a2a" stroke-width="3" stroke-linejoin="round">
      <rect x="6" y="12" width="52" height="46" rx="8" fill="#f4f4fa"/>
      <path d="M6 20 a8 8 0 0 1 8 -8 h36 a8 8 0 0 1 8 8 v6 H6 Z" fill="#e8283a"/>
      <circle cx="20" cy="12" r="5" fill="none" stroke="#a83ad8" stroke-width="4"/>
      <circle cx="44" cy="12" r="5" fill="none" stroke="#a83ad8" stroke-width="4"/></g>
    <text x="32" y="51" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="24" fill="#2a2a3a">31</text>`,
  ),
  smiley: svg('0 0 40 40', '<circle cx="20" cy="20" r="16" fill="#ffd21a" stroke="#7a5a00" stroke-width="2.5"/><circle cx="14" cy="16" r="2.4" fill="#3a2a00"/><circle cx="26" cy="16" r="2.4" fill="#3a2a00"/><path d="M12 23 Q20 31 28 23" fill="none" stroke="#3a2a00" stroke-width="2.6" stroke-linecap="round"/>'),
  leaf: svg('0 0 40 40', '<path d="M6 34 C6 16 18 6 36 4 C36 22 26 34 8 34 Z" fill="#3ad24a" stroke="#0a4a0a" stroke-width="2.5"/><path d="M8 33 L26 15" stroke="#0a4a0a" stroke-width="2.5" stroke-linecap="round"/>'),
  backpack: svg('0 0 40 40', '<path d="M14 9 a6 6 0 0 1 12 0" fill="none" stroke="#5a0a0a" stroke-width="3"/><rect x="7" y="9" width="26" height="27" rx="8" fill="#e8483a" stroke="#5a0a0a" stroke-width="2.5"/><rect x="12" y="22" width="16" height="10" rx="3" fill="#c8302a" stroke="#5a0a0a" stroke-width="2"/>'),
  orb: svg('0 0 40 40', '<circle cx="20" cy="20" r="15" fill="#fff" stroke="#1a1a2a" stroke-width="2.5"/><path d="M5 20 a15 15 0 0 1 30 0 Z" fill="#e8283a" stroke="#1a1a2a" stroke-width="2.5"/><circle cx="20" cy="20" r="4.5" fill="#fff" stroke="#1a1a2a" stroke-width="2.5"/>'),
  cash: svg(
    '0 0 48 40',
    `<g stroke="#0a3a0a" stroke-width="2.2" stroke-linejoin="round">
      <path d="M4 22 L26 12 L44 20 L22 30 Z" fill="#7ae85a"/><path d="M4 22 L22 30 L22 36 L4 28 Z" fill="#3aa82a"/><path d="M22 30 L44 20 L44 26 L22 36 Z" fill="#4ac83a"/>
      <path d="M4 16 L26 6 L44 14 L22 24 Z" fill="#9af27a"/><path d="M4 16 L22 24 L22 26 L4 18 Z" fill="#3aa82a"/>
      <path d="M17 13 L30 18" stroke="#ffd21a" stroke-width="3"/></g>`,
  ),
  grid: svg('0 0 64 64', '<g fill="#fff"><rect x="6" y="6" width="16" height="16"/><rect x="24" y="6" width="16" height="16"/><rect x="42" y="6" width="16" height="16"/><rect x="6" y="24" width="16" height="16"/><rect x="24" y="24" width="16" height="16"/><rect x="42" y="24" width="16" height="16"/><rect x="6" y="42" width="16" height="16"/><rect x="24" y="42" width="16" height="16"/><rect x="42" y="42" width="16" height="16"/></g>'),
  key: svg('0 0 64 64', '<g fill="none" stroke="#ffc21a" stroke-width="5"><rect x="22" y="4" width="20" height="20" rx="5"/><path d="M32 24 V60 M32 44 H42 M32 54 H40"/></g>'),
  vacuumTool: svg('0 0 64 64', '<path d="M18 6 L14 50 L58 50" fill="none" stroke="#2a2a2a" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/><path d="M18 6 L14 50 L58 50" fill="none" stroke="#f0f0f4" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><rect x="24" y="44" width="34" height="12" rx="3" fill="#d8d8e0" stroke="#2a2a2a" stroke-width="3"/>'),
  gem: svg('0 0 20 20', '<path d="M10 1 L18 5.5 L18 14.5 L10 19 L2 14.5 L2 5.5 Z" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M10 6 L14 8.3 L14 11.7 L10 14 L6 11.7 L6 8.3 Z" fill="currentColor"/>'),
  // --- Upgrades window ---
  upArrow: svg(
    '0 0 64 64',
    `<g stroke="#0a3a0a" stroke-width="3" stroke-linejoin="round">
      <path d="M32 4 L58 32 L44 32 L44 60 L20 60 L20 32 L6 32 Z" fill="#2fb83a"/>
      <path d="M32 4 L58 32 L44 32 L44 60 L32 60 Z" fill="#1f8a2a"/>
      <path d="M32 10 L14 29 L24 29 L24 54" fill="none" stroke="#9cff7a" stroke-width="3" stroke-linecap="round"/></g>`,
  ),
  upRange: svg(
    '0 0 64 64',
    `<g stroke="#0a2a5a" stroke-width="3" stroke-linejoin="round">
      <circle cx="32" cy="32" r="19" fill="none" stroke-width="9"/>
      <circle cx="32" cy="32" r="19" fill="none" stroke="#5ab8ff" stroke-width="5"/>
      <path d="M32 2 L39 11 L25 11 Z M32 62 L39 53 L25 53 Z M2 32 L11 25 L11 39 Z M62 32 L53 25 L53 39 Z" fill="#9adcff"/>
      <path d="M28 20 h8 v8 h8 v8 h-8 v8 h-8 v-8 h-8 v-8 h8 Z" fill="#ffc21a"/></g>`,
  ),
  upAgility: svg(
    '0 0 64 64',
    `<g stroke="#0a2a5a" stroke-width="3" stroke-linejoin="round">
      <path d="M10 40 A23 23 0 0 1 48 12 L52 6 L56 22 L40 20 L44 16 A17 17 0 0 0 16 40 Z" fill="#3a9aff"/>
      <path d="M54 24 A23 23 0 0 1 16 52 L12 58 L8 42 L24 44 L20 48 A17 17 0 0 0 48 24 Z" fill="#7ad0ff"/>
      <path d="M36 8 L20 36 L31 36 L26 58 L46 26 L35 26 L42 8 Z" fill="#ffd21a"/></g>`,
  ),
  upCapacity: svg(
    '0 0 64 64',
    `<g stroke="#3a1a0a" stroke-width="3" stroke-linejoin="round">
      <path d="M12 28 Q12 22 20 22 L44 22 Q52 22 52 28 L56 54 Q56 60 50 60 L14 60 Q8 60 8 54 Z" fill="#a8602a"/>
      <path d="M10 34 L54 34 L55 42 L9 42 Z" fill="#7a3e14"/>
      <rect x="26" y="36" width="12" height="10" rx="2" fill="#ffc21a"/>
      <circle cx="22" cy="20" r="6" fill="#ffd21a"/><circle cx="34" cy="17" r="6" fill="#ffd21a"/><circle cx="44" cy="21" r="6" fill="#ffd21a"/>
      <path d="M32 0 L44 12 L37 12 L37 22 L27 22 L27 12 L20 12 Z" fill="#3ad24a"/></g>`,
  ),
  upWalk: svg(
    '0 0 64 64',
    `<g fill="none" stroke="#2a8aff" stroke-width="4" stroke-linecap="round"><path d="M4 20 Q16 16 24 22M2 32 Q14 28 22 34M6 44 Q16 42 24 46"/></g>
    <g stroke="#4a3200" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" fill="#ffc21a">
      <circle cx="42" cy="12" r="7"/>
      <path d="M34 22 L48 22 L50 36 L40 36 Z"/>
      <path d="M48 24 L58 18 L60 24 L50 30 Z"/>
      <path d="M34 24 L24 28 L26 34 L36 32 Z"/>
      <path d="M40 36 L34 48 L26 46 L24 52 L38 56 L46 38 Z"/>
      <path d="M46 38 L54 44 L58 54 L50 56 L48 50 L42 46 Z"/></g>`,
  ),
  vacFlame: svg(
    '0 0 64 64',
    `<g stroke="#0a1a4a" stroke-width="3" stroke-linejoin="round">
      <path d="M30 4 C34 14 50 22 50 40 C50 52 42 60 32 60 C20 60 12 52 12 42 C12 32 20 28 22 18 C26 22 28 14 30 4 Z" fill="#6a5af0"/>
      <path d="M32 24 C36 32 44 36 44 44 C44 52 38 56 32 56 C26 56 20 52 20 46 C20 38 28 34 32 24 Z" fill="#9a8aff"/>
      <circle cx="27" cy="46" r="3" fill="#fff"/><circle cx="37" cy="46" r="3" fill="#fff"/><circle cx="27" cy="46" r="1.2" fill="#121240"/><circle cx="37" cy="46" r="1.2" fill="#121240"/></g>`,
  ),
  clover: svg('0 0 20 20', '<g fill="currentColor"><circle cx="10" cy="5.5" r="4"/><circle cx="14.5" cy="10" r="4"/><circle cx="10" cy="14.5" r="4"/><circle cx="5.5" cy="10" r="4"/></g>'),
}

// A white-tile blower picture for the Vacuums window: [body, accent] colours.
export const vacuumIcon = ([body, accent]) =>
  svg(
    '0 0 96 96',
    `<rect width="96" height="96" fill="#fff"/>
    <g stroke="#1a1a22" stroke-width="3" stroke-linejoin="round">
      <rect x="10" y="40" width="46" height="22" rx="8" fill="${body}"/>
      <rect x="52" y="44" width="30" height="14" rx="4" fill="${accent}"/>
      <ellipse cx="84" cy="51" rx="6" ry="12" fill="#3a3a46"/>
      <rect x="22" y="58" width="14" height="26" rx="5" fill="${accent}"/>
      <rect x="20" y="28" width="26" height="14" rx="5" fill="${accent}"/>
      <circle cx="30" cy="51" r="6" fill="#d8d8e0"/></g>`,
  )

// Picture for the Auras window: a gift box, or a blocky character wrapped in a glow [glow, shirt, pants].
export const auraIcon = (look) =>
  look === 'gift'
    ? svg(
        '0 0 96 96',
        `<rect width="96" height="96" fill="#1c1e2e"/>
        <g stroke="#10101c" stroke-width="3" stroke-linejoin="round">
          <rect x="22" y="44" width="52" height="40" rx="3" fill="#5a2ad0"/>
          <rect x="16" y="34" width="64" height="16" rx="3" fill="#7a3af0"/>
          <rect x="42" y="34" width="12" height="50" fill="#ffa21a"/>
          <path d="M48 34 C34 12 18 22 30 32 Z M48 34 C62 12 78 22 66 32 Z" fill="#ffa21a"/></g>`,
      )
    : svg(
        '0 0 96 96',
        `<defs><radialGradient id="ag${look[0].slice(1)}"><stop offset="0" stop-color="${look[0]}" stop-opacity=".95"/><stop offset="1" stop-color="${look[0]}" stop-opacity="0"/></radialGradient></defs>
        <rect width="96" height="96" fill="#1c1e2e"/>
        <ellipse cx="48" cy="50" rx="46" ry="48" fill="url(#ag${look[0].slice(1)})"/>
        <g stroke="#10101c" stroke-width="3" stroke-linejoin="round">
          <rect x="35" y="8" width="26" height="24" rx="6" fill="#f2c79a"/>
          <rect x="30" y="32" width="36" height="32" rx="3" fill="${look[1]}"/>
          <rect x="18" y="33" width="12" height="28" rx="3" fill="#f2c79a"/><rect x="66" y="33" width="12" height="28" rx="3" fill="#f2c79a"/>
          <rect x="32" y="64" width="15" height="26" rx="2" fill="${look[2]}"/><rect x="49" y="64" width="15" height="26" rx="2" fill="${look[2]}"/>
          <circle cx="42" cy="19" r="2" fill="#10101c" stroke="none"/><circle cx="54" cy="19" r="2" fill="#10101c" stroke="none"/></g>`,
      )
