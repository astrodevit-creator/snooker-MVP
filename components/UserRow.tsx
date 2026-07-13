
import React, { useState } from 'react';
import { User } from '../types';
import { Button } from './ui/Button';

interface UserRowProps {
  user: User;
  // Fix: currentUser from AuthContext does not include the password property
  currentUser: Omit<User, 'password'> | null;
  onDelete: (userId: string) => void;
}

const UserRow: React.FC<UserRowProps> = ({ user, currentUser, onDelete }) => {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleDelete = () => {
    onDelete(user.id);
    setIsConfirming(false);
  };

  const isCurrentUser = user.id === currentUser?.id;

  return (
    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
      {/* Desktop View */}
      <td className="p-4 align-middle font-semibold hidden md:table-cell">{user.email}</td>
      <td className="p-4 align-middle capitalize hidden md:table-cell">
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${user.role === 'admin' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}>
          {user.role}
        </span>
      </td>
      <td className="p-4 align-middle hidden md:table-cell font-bold text-xs">
        {user.role === 'admin' ? (
          <span className="text-emerald-600 bg-emerald-500/10 px-2 py-1 rounded-lg text-[10px] font-black uppercase border border-emerald-500/15">Toutes</span>
        ) : user.allowedTables ? (
          <span className="text-blue-600 bg-blue-500/10 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border border-blue-500/15">{user.allowedTables}</span>
        ) : (
          <span className="text-zinc-500 bg-zinc-500/10 px-2 py-1 rounded-lg text-[10px] font-black uppercase border border-zinc-500/15">Toutes</span>
        )}
      </td>
      <td className="p-4 align-middle text-right hidden md:table-cell">
        {isConfirming ? (
          <div className="flex items-center justify-end gap-1.5 animate-in zoom-in-95 duration-200">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="text-xs font-black uppercase h-8 px-3"
            >
              Confirmer
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfirming(false)}
              className="text-xs font-black uppercase h-8 px-3"
            >
              Annuler
            </Button>
          </div>
        ) : (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setIsConfirming(true)}
            disabled={isCurrentUser}
            className="text-xs font-bold uppercase h-8 px-4"
          >
            Supprimer
          </Button>
        )}
      </td>

      {/* Mobile View */}
      <td className="p-4 align-middle md:hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="grid gap-1">
            <p className="font-bold text-sm text-foreground">{user.email}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] font-black uppercase text-muted-foreground bg-muted px-2 py-0.5 rounded border capitalize">
                {user.role}
              </span>
              <span className="text-[9px] font-black uppercase text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/10">
                Tables: {user.role === 'admin' ? 'Toutes' : (user.allowedTables || 'Toutes')}
              </span>
            </div>
          </div>
          {isConfirming ? (
            <div className="flex items-center gap-1 animate-in zoom-in-95 duration-200">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                className="text-[9px] font-black uppercase h-8 px-2"
              >
                Confirmer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsConfirming(false)}
                className="text-[9px] font-black uppercase h-8 px-2"
              >
                Annuler
              </Button>
            </div>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsConfirming(true)}
              disabled={isCurrentUser}
              className="flex-shrink-0 text-[10px] font-black uppercase h-8 px-3"
            >
              Supprimer
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
};

export default UserRow;
