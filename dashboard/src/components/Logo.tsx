interface LogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  variant?: 'light' | 'dark'
}

export function Logo({ className = '', size = 'md', showText = false, variant = 'light' }: LogoProps) {
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  const iconSize = sizes[size]

  if (showText) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className={`${iconSize} rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center`}>
          <svg viewBox="0 0 100 100" className="w-4/5 h-4/5">
            <path d="M58 12 L30 52 L46 52 L40 88 L70 42 L52 42 Z" fill="white"/>
          </svg>
        </div>
        <span className="text-xl font-bold">
          <span className={variant === 'light' ? 'text-white' : 'text-slate-900'}>Roizen</span>
          <span className="text-green-500">Labs</span>
        </span>
      </div>
    )
  }

  return (
    <div className={`${iconSize} rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 100 100" className="w-4/5 h-4/5">
        <path d="M58 12 L30 52 L46 52 L40 88 L70 42 L52 42 Z" fill="white"/>
      </svg>
    </div>
  )
}

export default Logo
