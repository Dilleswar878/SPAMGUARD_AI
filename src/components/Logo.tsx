interface LogoProps {
  className?: string;
}

export function Logo({ className = 'w-8 h-8' }: LogoProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sgShieldGrad" x1="4" y1="3" x2="32" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="55%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#D946EF" />
        </linearGradient>
      </defs>
      <path
        d="M18 3L5.5 8.2V17.4C5.5 25.1 10.8 31.8 18 33.8C25.2 31.8 30.5 25.1 30.5 17.4V8.2L18 3Z"
        className="fill-slate-900 dark:fill-[#0B1221]"
        stroke="url(#sgShieldGrad)"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M12.75 18.25L16.35 21.85L23.5 14.3"
        stroke="#22D3EE"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
