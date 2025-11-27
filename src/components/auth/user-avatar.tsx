import type { User } from '@/types';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function getInitials(name: string) {
  const [firstName, lastName] = name.split(' ');
  return firstName && lastName
    ? `${firstName.charAt(0)}${lastName.charAt(0)}`
    : firstName.charAt(0);
}

export function UserAvatar({ user }: { user: User }) {
  return (
    <Avatar>
      {user.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName ?? ''} />}
      <AvatarFallback 
        className="text-primary-foreground" 
        style={{ backgroundColor: 'hsl(var(--primary))' }}
      >
        {user.displayName && getInitials(user.displayName)}
      </AvatarFallback>
    </Avatar>
  );
}
