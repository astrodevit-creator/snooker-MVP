
import React, { useState } from 'react';
import { useTables } from '../hooks/useTables';
import { TableConfig, TableType } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/Card';
import { Badge } from './ui/Badge';

const emptyForm = { name: '', type: TableType.MINI, hourlyRate: '60', ratePerGame: '20' };

const TableManagement: React.FC = () => {
  const { tables, addTable, updateTable, deleteTable } = useTables();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; hourlyRate: string; ratePerGame: string }>({ name: '', hourlyRate: '', ratePerGame: '' });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sortedTables = [...tables].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('Le nom de la table est requis.');
      return;
    }
    addTable({
      name: form.name.trim(),
      type: form.type,
      hourlyRate: Number(form.hourlyRate) || 0,
      ratePerGame: Number(form.ratePerGame) || 0,
      active: true,
      sortOrder: sortedTables.length,
    });
    setForm(emptyForm);
  };

  const startEditing = (table: TableConfig) => {
    setEditingId(table.id);
    setEditForm({ name: table.name, hourlyRate: String(table.hourlyRate), ratePerGame: String(table.ratePerGame) });
  };

  const saveEditing = (table: TableConfig) => {
    updateTable(table.id, {
      name: editForm.name.trim() || table.name,
      hourlyRate: Number(editForm.hourlyRate) || 0,
      ratePerGame: Number(editForm.ratePerGame) || 0,
    });
    setEditingId(null);
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Ajouter une table</CardTitle>
          <CardDescription>Chaque table a un tarif à l'heure (informatif) et un tarif par partie (utilisé pour la facturation).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddTable} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="grid gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Nom</label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Royal 3" className="h-11" required />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</label>
              <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as TableType })} className="h-11">
                <option value={TableType.MINI}>Mini</option>
                <option value={TableType.ROYAL}>Royal / Big</option>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">MAD / Heure</label>
              <Input type="number" min="0" value={form.hourlyRate} onChange={e => setForm({ ...form, hourlyRate: e.target.value })} className="h-11" />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">MAD / Partie</label>
              <Input type="number" min="0" value={form.ratePerGame} onChange={e => setForm({ ...form, ratePerGame: e.target.value })} className="h-11" />
            </div>
            <Button type="submit" className="h-11 font-black uppercase text-xs tracking-wider shadow-lg">Ajouter</Button>
          </form>
        </CardContent>
      </Card>

      <div className="border border-border rounded-2xl overflow-hidden shadow-sm bg-card divide-y">
        {sortedTables.map(table => (
          <div key={table.id} className="p-4">
            {editingId === table.id ? (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="h-11 font-bold" />
                <div className="grid gap-1">
                  <label className="text-[10px] font-black uppercase text-muted-foreground">MAD / Heure</label>
                  <Input type="number" min="0" value={editForm.hourlyRate} onChange={e => setEditForm({ ...editForm, hourlyRate: e.target.value })} className="h-11" />
                </div>
                <div className="grid gap-1">
                  <label className="text-[10px] font-black uppercase text-muted-foreground">MAD / Partie</label>
                  <Input type="number" min="0" value={editForm.ratePerGame} onChange={e => setEditForm({ ...editForm, ratePerGame: e.target.value })} className="h-11" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => saveEditing(table)} className="flex-1 h-11 font-black uppercase text-xs">Sauver</Button>
                  <Button variant="outline" onClick={() => setEditingId(null)} className="h-11 font-black uppercase text-xs">Annuler</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Badge variant={table.type === TableType.ROYAL ? 'default' : 'secondary'} className="uppercase font-black text-[9px]">
                    {table.type === TableType.ROYAL ? 'Royal' : 'Mini'}
                  </Badge>
                  <div>
                    <p className="font-black text-sm">{table.name}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                      {table.hourlyRate} MAD / Heure &middot; {table.ratePerGame} MAD / Partie
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {confirmDeleteId === table.id ? (
                    <>
                      <Button size="sm" variant="destructive" className="h-9 text-[10px] font-black uppercase" onClick={() => { deleteTable(table.id); setConfirmDeleteId(null); }}>Confirmer</Button>
                      <Button size="sm" variant="ghost" className="h-9 text-[10px] font-black uppercase" onClick={() => setConfirmDeleteId(null)}>Annuler</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" className="h-9 text-[10px] font-black uppercase" onClick={() => startEditing(table)}>Modifier</Button>
                      <Button size="sm" variant="destructive" className="h-9 text-[10px] font-black uppercase" onClick={() => setConfirmDeleteId(table.id)}>Supprimer</Button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {sortedTables.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-xs font-black uppercase tracking-widest opacity-50">
            Aucune table configurée
          </div>
        )}
      </div>
    </div>
  );
};

export default TableManagement;
