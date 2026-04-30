import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #00C75A 0%, #008C40 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 110,
        }}
      >
        {/* Stylized ₩ — two Vs (W) with two crossbars */}
        <svg viewBox="0 0 100 100" width={340} height={340}>
          {/* drop shadow */}
          <g style={{ filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.18))' }}>
            <path
              d="M16 26 L36 76 L50 38 L64 76 L84 26"
              fill="none"
              stroke="#fff"
              strokeWidth={11}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <line x1={18} y1={42} x2={82} y2={42} stroke="#fff" strokeWidth={7} strokeLinecap="round" />
            <line x1={18} y1={58} x2={82} y2={58} stroke="#fff" strokeWidth={7} strokeLinecap="round" />
          </g>
        </svg>
      </div>
    ),
    { ...size },
  );
}
