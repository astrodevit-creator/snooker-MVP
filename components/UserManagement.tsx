
import React, { useState } from 'react';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../hooks/useAuth';
import { Role } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { TABLES } from '../constants';
import UserRow from './UserRow';

const UserManagement: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { users, addUser, deleteUser } = useUsers();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(Role.USER);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert('Email and password are required.');
      return;
    }
    
    const allowedTables = role === Role.USER && selectedTables.length > 0 
      ? selectedTables.join(', ') 
      : null;

    addUser({ email, password, role, allowedTables });
    
    setEmail('');
    setPassword('');
    setRole(Role.USER);
    setSelectedTables([]);
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Ajouter un nouvel utilisateur</CardTitle>
          <CardDescription>Créer un compte d'accès pour un staff ou administrateur.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddUser} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid w-full items-center gap-1.5">
                <label htmlFor="newUserEmail" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
                <Input id="newUserEmail" type="email" placeholder="new.user@snooker.club" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <label htmlFor="newUserPass" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Mot de passe</label>
                <Input id="newUserPass" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className="h-11" />
              </div>
              <div className="grid w-full items-center gap-1.5">
                <label htmlFor="newUserRole" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rôle</label>
                <Select id="newUserRole" value={role} onChange={e => setRole(e.target.value as Role)} className="h-11">
                  <option value={Role.USER}>Utilisateur (Staff)</option>
                  <option value={Role.ADMIN}>Administrateur</option>
                </Select>
              </div>
            </div>

            {role === Role.USER && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Tables Autorisées (Laisser vide pour TOUTES les tables)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3 rounded-2xl border">
                  {TABLES.map(t => {
                    const isSelected = selectedTables.includes(t.name);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTables(selectedTables.filter(name => name !== t.name));
                          } else {
                            setSelectedTables([...selectedTables, t.name]);
                          }
                        }}
                        className={`py-3 px-4 rounded-xl text-xs font-black uppercase border transition-all text-center flex items-center justify-center gap-2 ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-background hover:bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="submit" className="w-full md:w-auto h-11 px-8 uppercase font-black text-xs tracking-wider shadow-lg">
                Créer l'utilisateur
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="border border-border rounded-2xl overflow-hidden shadow-sm bg-card">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm border-collapse">
            <thead className="[&_tr]:border-b bg-muted/30">
              <tr className="border-b transition-colors hover:bg-muted/50">
                <th className="h-12 px-4 text-left align-middle font-black uppercase text-[10px] tracking-widest text-muted-foreground hidden md:table-cell">Email</th>
                <th className="h-12 px-4 text-left align-middle font-black uppercase text-[10px] tracking-widest text-muted-foreground hidden md:table-cell">Rôle</th>
                <th className="h-12 px-4 text-left align-middle font-black uppercase text-[10px] tracking-widest text-muted-foreground hidden md:table-cell">Tables gérées</th>
                <th className="h-12 px-4 text-right align-middle font-black uppercase text-[10px] tracking-widest text-muted-foreground hidden md:table-cell">Actions</th>
                <th className="h-12 px-4 text-left align-middle font-black uppercase text-[10px] tracking-widest text-muted-foreground md:hidden">Utilisateurs</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(user => (
                <UserRow 
                  key={user.id}
                  user={user}
                  currentUser={currentUser}
                  onDelete={deleteUser}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
