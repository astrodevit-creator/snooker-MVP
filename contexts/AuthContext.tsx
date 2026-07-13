
import React, { createContext, useState, ReactNode } from 'react';
import { User } from '../types';
import { useUsers } from '../hooks/useUsers';

interface AuthContextType {
  user: Omit<User, 'password'> | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Omit<User, 'password'> | null>(null);
  const { findUserByEmail } = useUsers();

  const login = async (email: string, password: string): Promise<void> => {
    const foundUser = findUserByEmail(email);

    if (foundUser && foundUser.password === password) {
      // For security, don't store the password in the session user object
      const { password: _, ...userToStore } = foundUser;
      setUser(userToStore);
      return Promise.resolve();
    } else {
      return Promise.reject(new Error('Invalid email or password.'));
    }
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