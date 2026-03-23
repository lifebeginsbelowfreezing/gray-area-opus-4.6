interface Props {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  isConnected?: boolean;
  highlight?: boolean;
}

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
};

export default function PlayerAvatar({
  name,
  color,
  size = 'md',
  isConnected = true,
  highlight = false,
}: Props) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={`
        ${sizes[size]} rounded-full flex items-center justify-center font-bold
        shrink-0 transition-all duration-200
        ${isConnected ? '' : 'opacity-40'}
        ${highlight ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-brand-950' : ''}
      `}
      style={{ backgroundColor: color }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
