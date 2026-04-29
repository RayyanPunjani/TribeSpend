type TribeSpendLogoIconProps = {
  className?: string
  title?: string
}

export default function TribeSpendLogoIcon({
  className = 'w-8 h-8',
  title = 'TribeSpend',
}: TribeSpendLogoIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="18" fill="#0f766e" />
      <rect x="3" y="3" width="58" height="58" rx="16" stroke="#5eead4" strokeOpacity="0.24" strokeWidth="2" />

      <path
        d="M18 20.8A20 20 0 0 1 48.8 18"
        stroke="#99f6e4"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M51.8 25.5A20 20 0 0 1 48.4 46.5"
        stroke="#34d399"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M20.3 48.1A20 20 0 0 1 12.4 29.7"
        stroke="#2dd4bf"
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      <circle cx="16" cy="19" r="3.5" fill="#ccfbf1" />
      <circle cx="52" cy="24" r="3.5" fill="#86efac" />
      <circle cx="20" cy="49" r="3.5" fill="#5eead4" />

      <text
        x="32"
        y="35"
        textAnchor="middle"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="17"
        fontWeight="800"
        letterSpacing="0"
        fill="#f8fafc"
      >
        TS
      </text>

      <rect x="21" y="43" width="4" height="7" rx="1.5" fill="#bbf7d0" />
      <rect x="30" y="39" width="4" height="11" rx="1.5" fill="#86efac" />
      <rect x="39" y="35" width="4" height="15" rx="1.5" fill="#34d399" />
    </svg>
  )
}
