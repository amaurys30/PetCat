import { useId } from "react";

/*
 * Ilustraciones propias de PetCat (formas simples con los colores de la marca). Son
 * decorativas: el texto de la página dice lo mismo, así que van con un aria-label corto.
 */

const PIEL_PERRO = "#E9A75E";
const PIEL_PERRO_OSCURA = "#C47B3A";
const CREMA = "#FCE9CF";
const GATO = "#3C4A5E";
const GATO_CLARO = "#F5F7F8";
const INK = "#1E2A3B";
const ROSA = "#F28B8B";

function Degradado({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#17B5AB" />
      <stop offset="100%" stopColor="#0B6F69" />
    </linearGradient>
  );
}

/** Perro sentado, de frente. `x`/`y`: esquina superior izquierda (ocupa unos 190 × 230). */
function Perro({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* cola */}
      <path d="M150 168 q40 -10 38 -52" stroke={PIEL_PERRO_OSCURA} strokeWidth="14" strokeLinecap="round" fill="none" />
      {/* cuerpo */}
      <ellipse cx="95" cy="168" rx="62" ry="58" fill={PIEL_PERRO} />
      <ellipse cx="95" cy="182" rx="34" ry="40" fill={CREMA} />
      {/* patas */}
      <rect x="58" y="196" width="28" height="36" rx="14" fill={PIEL_PERRO} />
      <rect x="104" y="196" width="28" height="36" rx="14" fill={PIEL_PERRO} />
      <ellipse cx="72" cy="228" rx="16" ry="8" fill={CREMA} />
      <ellipse cx="118" cy="228" rx="16" ry="8" fill={CREMA} />
      {/* collar */}
      <rect x="52" y="112" width="86" height="14" rx="7" fill="#0D7F78" />
      <circle cx="95" cy="134" r="9" fill="#F29921" />
      {/* orejas */}
      <ellipse cx="42" cy="62" rx="20" ry="40" transform="rotate(18 42 62)" fill={PIEL_PERRO_OSCURA} />
      <ellipse cx="148" cy="62" rx="20" ry="40" transform="rotate(-18 148 62)" fill={PIEL_PERRO_OSCURA} />
      {/* cabeza */}
      <circle cx="95" cy="66" r="54" fill={PIEL_PERRO} />
      <ellipse cx="95" cy="90" rx="32" ry="24" fill={CREMA} />
      <circle cx="74" cy="56" r="6" fill={INK} />
      <circle cx="116" cy="56" r="6" fill={INK} />
      <circle cx="76" cy="54" r="2" fill="#FFFFFF" />
      <circle cx="118" cy="54" r="2" fill="#FFFFFF" />
      <ellipse cx="95" cy="80" rx="10" ry="7" fill={INK} />
      <path d="M95 87 v8 M85 96 q10 8 20 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M90 99 q5 14 10 0 z" fill={ROSA} />
    </g>
  );
}

/** Gato sentado, de perfil a tres cuartos (ocupa unos 120 × 150). */
function Gato({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M92 128 q36 4 30 -40" stroke={GATO} strokeWidth="11" strokeLinecap="round" fill="none" />
      <ellipse cx="60" cy="108" rx="40" ry="40" fill={GATO} />
      <ellipse cx="58" cy="116" rx="20" ry="26" fill={GATO_CLARO} />
      <rect x="34" y="128" width="20" height="22" rx="10" fill={GATO} />
      <rect x="64" y="128" width="20" height="22" rx="10" fill={GATO} />
      <path d="M22 34 L30 0 L50 22 Z" fill={GATO} />
      <path d="M98 34 L90 0 L70 22 Z" fill={GATO} />
      <path d="M30 26 L33 12 L42 22 Z" fill={ROSA} />
      <path d="M90 26 L87 12 L78 22 Z" fill={ROSA} />
      <circle cx="60" cy="46" r="38" fill={GATO} />
      <ellipse cx="46" cy="44" rx="6" ry="8" fill="#F2D06B" />
      <ellipse cx="74" cy="44" rx="6" ry="8" fill="#F2D06B" />
      <ellipse cx="46" cy="45" rx="2" ry="6" fill={INK} />
      <ellipse cx="74" cy="45" rx="2" ry="6" fill={INK} />
      <path d="M56 58 h8 l-4 5 z" fill={ROSA} />
      <path d="M60 63 q-5 6 -10 2 M60 63 q5 6 10 2" stroke={GATO_CLARO} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M30 58 h-18 M30 64 l-16 5 M90 58 h18 M90 64 l16 5" stroke={GATO_CLARO} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function Huella({ x, y, escala = 1, color }: { x: number; y: number; escala?: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`} fill={color}>
      <ellipse cx="0" cy="8" rx="9" ry="8" />
      <circle cx="-9" cy="-5" r="4" />
      <circle cx="-3" cy="-10" r="4" />
      <circle cx="4" cy="-10" r="4" />
      <circle cx="10" cy="-5" r="4" />
    </g>
  );
}

function Check({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="10" fill="#E3F6F3" />
      <path d="M-4.5 0.5 l3 3 l6 -6.5" stroke="#0D7F78" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </g>
  );
}

/** Hero de la landing: perro y gato junto a un celular con el carnet de vacunas y un recordatorio. */
export function IlustracionDuenos({ className }: { className?: string }) {
  const id = useId();
  const degradado = `${id}-marca`;
  const sombra = `${id}-sombra`;
  return (
    <svg
      viewBox="0 0 560 480"
      className={className}
      role="img"
      aria-label="Un perro y un gato junto a un celular con el carnet de vacunas y un recordatorio"
    >
      <defs>
        <Degradado id={degradado} />
        <filter id={sombra} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#1E2A3B" floodOpacity="0.16" />
        </filter>
      </defs>

      <circle cx="300" cy="250" r="200" fill={`url(#${degradado})`} />
      <circle cx="96" cy="96" r="34" fill="#FFF2D9" />
      <circle cx="500" cy="420" r="22" fill="#EEE8FB" />
      <Huella x={470} y={70} escala={1.4} color="#FFFFFF" />
      <Huella x={130} y={420} escala={1.1} color="#F29921" />

      {/* celular */}
      <g filter={`url(#${sombra})`}>
        <rect x="290" y="64" width="190" height="340" rx="30" fill="#FFFFFF" />
      </g>
      <rect x="352" y="78" width="66" height="8" rx="4" fill="#EEF2F4" />
      <circle cx="326" cy="122" r="18" fill="#FFF2D9" />
      <Huella x={326} y={122} escala={0.75} color="#C47B3A" />
      <rect x="352" y="110" width="80" height="10" rx="5" fill="#1E2A3B" />
      <rect x="352" y="128" width="56" height="8" rx="4" fill="#9AA6B2" />
      <rect x="306" y="160" width="158" height="30" rx="10" fill="#F0FAF9" />
      <text x="318" y="180" fontSize="12" fontWeight="700" fill="#0B6F69" fontFamily="Inter Variable, sans-serif">
        Carnet de vacunas
      </text>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <Check x={322} y={214 + i * 38} />
          <rect x="340" y={208 + i * 38} width={i === 1 ? 70 : 92} height="8" rx="4" fill="#1E2A3B" opacity="0.8" />
          <rect x="340" y={220 + i * 38} width="54" height="6" rx="3" fill="#9AA6B2" />
        </g>
      ))}
      <rect x="306" y="330" width="158" height="44" rx="14" fill="#0D7F78" />
      <text x="385" y="357" fontSize="13" fontWeight="700" fill="#FFFFFF" textAnchor="middle" fontFamily="Inter Variable, sans-serif">
        Agendar cita
      </text>

      {/* recordatorio */}
      <g filter={`url(#${sombra})`}>
        <rect x="360" y="18" width="190" height="62" rx="16" fill="#FFFFFF" />
      </g>
      <circle cx="390" cy="49" r="16" fill="#FFF2D9" />
      <path
        d="M383 53 h14 l-2 -3 v-5 a5 5 0 0 0 -10 0 v5 z M388 56 a2 2 0 0 0 4 0"
        stroke="#A86100"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      <text x="414" y="45" fontSize="12" fontWeight="700" fill="#1E2A3B" fontFamily="Inter Variable, sans-serif">
        Vacuna de Max
      </text>
      <text x="414" y="62" fontSize="11" fill="#5B6B7C" fontFamily="Inter Variable, sans-serif">
        Mañana, 9:00 a. m.
      </text>

      <Perro x={70} y={210} />
      <Gato x={236} y={318} />
    </svg>
  );
}

/** Hero de negocios: la agenda del panel con citas confirmadas y pendientes, y un perro que se asoma. */
export function IlustracionNegocios({ className }: { className?: string }) {
  const id = useId();
  const degradado = `${id}-marca`;
  const sombra = `${id}-sombra`;
  const citas = [
    { x: 150, y: 150, h: 46, color: "#E3F6F3", borde: "#0D7F78" },
    { x: 150, y: 214, h: 64, color: "#FFF2D9", borde: "#F29921" },
    { x: 262, y: 128, h: 70, color: "#E3F6F3", borde: "#0D7F78" },
    { x: 262, y: 236, h: 44, color: "#EEE8FB", borde: "#7C5CD6" },
    { x: 374, y: 170, h: 58, color: "#E3F6F3", borde: "#0D7F78" },
  ];
  return (
    <svg
      viewBox="0 0 560 480"
      className={className}
      role="img"
      aria-label="La agenda del panel de PetCat con citas confirmadas y pendientes, y un perro que se asoma"
    >
      <defs>
        <Degradado id={degradado} />
        <filter id={sombra} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#1E2A3B" floodOpacity="0.16" />
        </filter>
      </defs>

      <rect x="40" y="40" width="480" height="400" rx="48" fill={`url(#${degradado})`} />
      <Huella x={490} y={80} escala={1.3} color="#FFFFFF" />
      <circle cx="70" cy="420" r="26" fill="#FFF2D9" />

      <g filter={`url(#${sombra})`}>
        <rect x="80" y="70" width="400" height="260" rx="20" fill="#FFFFFF" />
      </g>
      <text x="104" y="104" fontSize="15" fontWeight="700" fill="#1E2A3B" fontFamily="Inter Variable, sans-serif">
        Agenda de hoy
      </text>
      <rect x="388" y="88" width="72" height="24" rx="12" fill="#E3F6F3" />
      <text x="424" y="104" fontSize="11" fontWeight="700" fill="#0B6F69" textAnchor="middle" fontFamily="Inter Variable, sans-serif">
        8 citas
      </text>
      {["8:00", "10:00", "12:00", "14:00"].map((h, i) => (
        <g key={h}>
          <text x="100" y={142 + i * 48} fontSize="10" fill="#5B6B7C" fontFamily="Inter Variable, sans-serif">
            {h}
          </text>
          <rect x="140" y={138 + i * 48} width="320" height="1" fill="#E3E8EC" />
        </g>
      ))}
      {citas.map((c, i) => (
        <g key={i}>
          <rect x={c.x} y={c.y} width="100" height={c.h} rx="8" fill={c.color} />
          <rect x={c.x} y={c.y} width="4" height={c.h} rx="2" fill={c.borde} />
          <rect x={c.x + 12} y={c.y + 10} width="60" height="7" rx="3.5" fill="#1E2A3B" opacity="0.75" />
          <rect x={c.x + 12} y={c.y + 23} width="40" height="6" rx="3" fill="#5B6B7C" opacity="0.6" />
        </g>
      ))}

      {/* tarjeta de confirmación */}
      <g filter={`url(#${sombra})`}>
        <rect x="300" y="300" width="200" height="64" rx="16" fill="#FFFFFF" />
      </g>
      <Check x={330} y={332} />
      <text x="350" y="327" fontSize="12" fontWeight="700" fill="#1E2A3B" fontFamily="Inter Variable, sans-serif">
        Cita confirmada
      </text>
      <text x="350" y="344" fontSize="11" fill="#5B6B7C" fontFamily="Inter Variable, sans-serif">
        Recordatorio enviado
      </text>

      {/* perro que se asoma */}
      <g transform="translate(96 300)">
        <ellipse cx="38" cy="30" rx="16" ry="32" transform="rotate(18 38 30)" fill={PIEL_PERRO_OSCURA} />
        <ellipse cx="142" cy="30" rx="16" ry="32" transform="rotate(-18 142 30)" fill={PIEL_PERRO_OSCURA} />
        <circle cx="90" cy="60" r="56" fill={PIEL_PERRO} />
        <ellipse cx="90" cy="84" rx="30" ry="22" fill={CREMA} />
        <circle cx="70" cy="52" r="6" fill={INK} />
        <circle cx="110" cy="52" r="6" fill={INK} />
        <ellipse cx="90" cy="76" rx="9" ry="6.5" fill={INK} />
        <path d="M80 92 q10 8 20 0" stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none" />
        <rect x="30" y="100" width="34" height="26" rx="13" fill={PIEL_PERRO} />
        <rect x="116" y="100" width="34" height="26" rx="13" fill={PIEL_PERRO} />
      </g>
    </svg>
  );
}

/** Ilustración pequeña de la banda para negocios: un maletín veterinario con una cruz. */
export function IlustracionBanda({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 180" className={className} aria-hidden>
      <circle cx="110" cy="96" r="78" fill="#FFFFFF" opacity="0.12" />
      <rect x="50" y="62" width="120" height="86" rx="18" fill="#FFFFFF" />
      <path d="M86 62 v-12 a10 10 0 0 1 10 -10 h28 a10 10 0 0 1 10 10 v12" stroke="#FFFFFF" strokeWidth="8" fill="none" />
      <rect x="100" y="84" width="20" height="44" rx="5" fill="#F29921" />
      <rect x="88" y="96" width="44" height="20" rx="5" fill="#F29921" />
      <Huella x={180} y={40} escala={1} color="#FFF2D9" />
      <Huella x={36} y={150} escala={0.8} color="#FFF2D9" />
    </svg>
  );
}
