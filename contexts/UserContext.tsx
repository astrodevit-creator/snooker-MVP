
import React, { createContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { User, Role } from '../types';
import { supabase, isMissingTableError, formatError } from '../lib/supabase';

interface UserContextType {
  users: User[];
  addUser: (user: Omit<User, 'id'>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  findUserByEmail: (email: string) => User | undefined;
  isLoading: boolean;
  isTableMissing: boolean;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

const USERS_CACHE_KEY = 'snooker_users_cache';

// Using valid UUID formats for default users to ensure compatibility with DB foreign keys
const DEFAULT_USERS: User[] = [
  { id: '00000000-0000-0000-0000-000000000001', email: 'admin@snooker.club', password: 'admin', role: Role.ADMIN },
  { id: '00000000-0000-0000-0000-000000000002', email: 'user@snooker.club', password: 'user', role: Role.USER }
];

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>(() => {
    const cached = localStorage.getItem(USERS_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Force migration if any user has a legacy non-UUID ID (less than 10 chars)
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
        .select('*');
      
      if (error) throw error;
      
      const userData = data || [];
      if (userData.length > 0) {
        setUsers(userData);
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

  const addUser = useCallback(async (newUser: Omit<User, 'id'>) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([{ ...newUser }])
        .select();

      if (error) throw error;
      if (data) {
        const updatedUsers = [...users, data[0]];
        setUsers(updatedUsers);
        localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(updatedUsers));
      }
    } catch (err: any) {
      alert(`Error adding user: ${formatError(err)}`);
    }
  }, [users]);
  
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

  const findUserByEmail = useCallback((email: string) => {
    return users.find(user => user.email.toLowerCase() === email.toLowerCase());
  }, [users]);
  
  return (
    <UserContext.Provider value={{ users, addUser, deleteUser, findUserByEmail, isLoading, isTableMissing }}>
      {children}
    </UserContext.Provider>
  );
};
