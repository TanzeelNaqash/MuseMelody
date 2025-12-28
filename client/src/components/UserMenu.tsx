import React from 'react';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { LogOut, User, Settings } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';

export function UserMenu() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [, setLocation] = useLocation();

  if (!user) return null;

  const safeEmail = user.email ?? '';

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName[0].toUpperCase();
    }
    if (lastName) {
      return lastName[0].toUpperCase();
    }
    return safeEmail.charAt(0).toUpperCase() || 'U';
  };

  const getDisplayName = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    if (user.firstName) {
      return user.firstName;
    }
    if (user.lastName) {
      return user.lastName;
    }
    return safeEmail || 'User';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
        <Avatar className="h-8 w-8">
  <AvatarImage 
    src={
      user.profileImageUrl && 
      !user.profileImageUrl.includes("picture/1") && 
      !user.profileImageUrl.includes("picture/3") 
        ? user.profileImageUrl 
        : undefined
    } 
    alt={getDisplayName()} 
  />
  <AvatarFallback>
    {getInitials(user.firstName, user.lastName)}
  </AvatarFallback>
</Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{getDisplayName()}</p>
            {safeEmail && (
              <p className="text-xs leading-none text-muted-foreground">
                {safeEmail}
              </p>
            )}
            {user.isEmailVerified === false && (
              <p className="text-xs text-amber-600">
                {t('auth.emailNotVerified')}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLocation('/profile')}>
          <User className="mr-2 h-4 w-4" />
          <span>{t('profile.profile')}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLocation('/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>{t('settings.settings')}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t('auth.signOut')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
