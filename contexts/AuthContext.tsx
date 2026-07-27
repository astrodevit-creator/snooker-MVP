
import React, { createContext, useState, ReactNode } from 'react';
import { User } from '../types';
import { supabase, formatError } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string): Promise<void> => {
    // Credentials are verified server-side via a SECURITY DEFINER function so the
    // client never fetches password hashes directly (see verify_login in the Supabase SQL script).
    const { data, error } = await supabase.rpc('verify_login', {
      p_email: email,
      p_password: password,
    });

    if (error) {
      throw new Error(formatError(error));
    }

    const foundUser = Array.isArray(data) ? data[0] : data;
    if (!foundUser) {
      throw new Error('Invalid email or password.');
    }

    const userToStore: User = {
      id: foundUser.id,
      email: foundUser.email,
      role: foundUser.role,
      allowedTables: foundUser.allowedTables ?? null,
    };
    setUser(userToStore);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
