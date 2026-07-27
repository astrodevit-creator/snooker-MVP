
import React, { createContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { User, Role } from '../types';
import { supabase, isMissingTableError, formatError } from '../lib/supabase';

interface NewUserInput {
  email: string;
  password: string;
  role: Role;
  allowedTables?: string | null;
}

interface UserContextType {
  users: User[];
  addUser: (user: NewUserInput) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  isLoading: boolean;
  isTableMissing: boolean;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

const USERS_CACHE_KEY = 'snooker_users_cache';

// Safe columns only — the password hash is never selected by the client, it's only
// ever compared server-side inside the verify_login/create_staff_user SQL functions.
const SAFE_USER_COLUMNS = 'id, email, role, "allowedTables"';

const DEFAULT_USERS: User[] = [
  { id: '00000000-0000-0000-0000-000000000001', email: 'admin@snooker.club', role: Role.ADMIN },
  { id: '00000000-0000-0000-0000-000000000002', email: 'user@snooker.club', role: Role.USER }
];

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => {
    const cached = localStorage.getItem(USERS_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const hasLegacyIds = parsed.some((u: any) => !u.id || u.id.length < 10);
        if (hasLegacyIds) {
          localStorage.removeItem(USERS_CACHE_KEY);
          return DEFAULT_USERS;
        }
        return parsed;
      } catch (e) {
        return DEFAULT_USERS;
      }
    }
    return DEFAULT_USERS;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isTableMissing, setIsTableMissing] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(SAFE_USER_COLUMNS);

      if (error) throw error;

      const userData = data || [];
      if (userData.length > 0) {
        setUsers(userData as User[]);
        localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(userData));
      }
      setIsTableMissing(false);
    } catch (err: any) {
      if (isMissingTableError(err)) {
        setIsTableMissing(true);
      }
      const isFetchError = err.message === 'Failed to fetch' || err.name === 'TypeError';
      console.warn('User fetch failed:', isFetchError ? 'Offline Mode' : formatError(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const addUser = useCallback(async (newUser: NewUserInput) => {
    try {
      // Hashing happens server-side inside create_staff_user — the plaintext password
      // is only ever sent over the connection for this one RPC call, never stored as-is.
      const { error } = await supabase.rpc('create_staff_user', {
        p_email: newUser.email,
        p_password: newUser.password,
        p_role: newUser.role,
        p_allowed_tables: newUser.allowedTables ?? null,
      });

      if (error) throw error;
      await fetchUsers();
    } catch (err: any) {
      alert(`Error adding user: ${formatError(err)}`);
    }
  }, [fetchUsers]);

  const deleteUser = useCallback(async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      const updatedUsers = users.filter(user => user.id !== userId);
      setUsers(updatedUsers);
      localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(updatedUsers));
    } catch (err: any) {
      alert(`Error deleting user: ${formatError(err)}`);
    }
  }, [users]);

  return (
    <UserContext.Provider value={{ users, addUser, deleteUser, isLoading, isTableMissing }}>
      {children}
    </UserContext.Provider>
  );
};
