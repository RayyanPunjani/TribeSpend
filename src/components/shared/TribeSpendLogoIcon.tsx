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
      <path
        d="M18.5 16.5A22 22 0 0 1 48.8 17.9"
        stroke="#99f6e4"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M53.6 27.2A22 22 0 0 1 45.7 50.1"
        stroke="#34d399"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M20.7 51.2A22 22 0 0 1 10.7 28.4"
        stroke="#2dd4bf"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <circle cx="17" cy="16" r="4.4" fill="#ccfbf1" />
      <circle cx="53.5" cy="26.5" r="4.4" fill="#86efac" />
      <circle cx="20.5" cy="51.5" r="4.4" fill="#5eead4" />

      <circle cx="32" cy="32" r="18" fill="#0f766e" fillOpacity="0.92" />
      <circle cx="32" cy="32" r="17" stroke="#5eead4" strokeOpacity="0.3" strokeWidth="1.5" />

      <text
        x="32"
        y="34"
        textAnchor="middle"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="16"
        fontWeight="800"
        letterSpacing="0"
        fill="#f8fafc"
      >
        TS
      </text>

      <rect x="22" y="43" width="4" height="7" rx="1.4" fill="#bbf7d0" />
      <rect x="30" y="39" width="4" height="11" rx="1.4" fill="#86efac" />
      <rect x="38" y="35" width="4" height="15" rx="1.4" fill="#34d399" />
    </svg>
  )
}
