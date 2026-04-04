'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion } from 'framer-motion';
import {
  Trophy,
  Target,
  Shield,
  Users,
  PencilLine,
  Crown,
  BarChart3,
  FileText,
  Medal,
  FileSpreadsheet,
  ScrollText,
  History,
  NotebookPen,
  Database,
  StickyNote,
  Lock,
  LogOut,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { hasSupabaseEnv, supabase } from '@/lib/supabase/client';
import {
  loadDashboardData,
  saveClubSettings,
  savePlayerMembership,
  deleteMembership,
  syncBrawlStars,
  closeAndOpenNextSeason,
  saveSeason,
  getStaffMe,
  signInStaffWithGoogle,
  signOutStaff,
  saveStaffDisplayName,
  type Club,
  type Player,
  type AdminLogEntry,
  type StaffMe,
} from '@/lib/supabase/repository';

const MOCK_CLUBS: Club[] = [
  { id: 'club-1', name: 'Prairie Étoilée', color: 'orange', objective: 2500, bigObjective: 3500, president: 'Jinx', vicePresidents: 'Ordi fou, Nasv', powerRank: 1 },
  { id: 'club-2', name: 'Prairie Céleste', color: 'green', objective: 2200, bigObjective: 3200, president: 'Grey', vicePresidents: 'Math', powerRank: 2 },
  { id: 'club-3', name: 'Prairie Fleurie', color: 'white', objective: 2000, bigObjective: 3000, president: 'Meister', vicePresidents: 'Jinx', powerRank: 3 },
  { id: 'club-4', name: 'Prairie Gelée', color: 'orange', objective: 1800, bigObjective: 2800, president: 'Mox', vicePresidents: '', powerRank: 4 },
  { id: 'club-5', name: 'Prairie Brûlée', color: 'green', objective: 1600, bigObjective: 2600, president: 'Aguiib', vicePresidents: 'purplemoon (Grey), drk', powerRank: 5 },
  { id: 'club-6', name: 'Prairie Sauvage', color: 'white', objective: 1400, bigObjective: 2400, president: 'Jinx', vicePresidents: 'Ordi fou', powerRank: 6 },
  { id: 'club-7', name: 'Mini Prairie', color: 'orange', objective: 1200, bigObjective: 2200, president: 'Mox', vicePresidents: 'Nasv, Aguiib', powerRank: 7 },
];

const MOCK_PLAYERS: Player[] = [
  { id: '1', name: 'Jinx', role: 'Président', clubId: 'club-1', current: 58122, end: 61240, active: true, warnings: 0, notes: 'Président principal', lastSeen: 'Aujourd’hui', seasonHistory: [2800, 3100, 2900], isNew: false },
  { id: '2', name: 'Ordi fou', role: 'Vice-président', clubId: 'club-1', current: 53010, end: 55320, active: true, warnings: 1, notes: 'Très impliqué', lastSeen: 'Hier', seasonHistory: [1900, 2100, 2310], isNew: false },
  { id: '3', name: 'Nasv', role: 'Vice-président', clubId: 'club-1', current: 47250, end: 48690, active: true, warnings: 0, notes: 'Aide sur plusieurs clubs', lastSeen: 'Aujourd’hui', seasonHistory: [1100, 1500, 1440], isNew: false },
  { id: '4', name: 'Grey', role: 'Président', clubId: 'club-2', current: 40210, end: 43110, active: true, warnings: 0, notes: '', lastSeen: 'Aujourd’hui', seasonHistory: [2400, 2600, 2900], isNew: false },
  { id: '5', name: 'Math', role: 'Vice-président', clubId: 'club-2', current: 35810, end: 36900, active: false, warnings: 2, notes: 'Activité irrégulière', lastSeen: 'Il y a 8 jours', seasonHistory: [800, 950, 1090], isNew: false },
];

const SEARCH_MATH_RANGES: Array<[number, number, number]> = [
  [0x1d400, 0x1d419, 65],
  [0x1d41a, 0x1d433, 97],
  [0x1d434, 0x1d44d, 65],
  [0x1d44e, 0x1d467, 97],
  [0x1d468, 0x1d481, 65],
  [0x1d482, 0x1d49b, 97],
  [0x1d49c, 0x1d4b5, 65],
  [0x1d4b6, 0x1d4cf, 97],
  [0x1d4d0, 0x1d4e9, 65],
  [0x1d4ea, 0x1d503, 97],
  [0x1d504, 0x1d51d, 65],
  [0x1d51e, 0x1d537, 97],
  [0x1d538, 0x1d551, 65],
  [0x1d552, 0x1d56b, 97],
  [0x1d56c, 0x1d585, 65],
  [0x1d586, 0x1d59f, 97],
  [0x1d5a0, 0x1d5b9, 65],
  [0x1d5ba, 0x1d5d3, 97],
  [0x1d5d4, 0x1d5ed, 65],
  [0x1d5ee, 0x1d607, 97],
  [0x1d608, 0x1d621, 65],
  [0x1d622, 0x1d63b, 97],
  [0x1d63c, 0x1d655, 65],
  [0x1d656, 0x1d66f, 97],
  [0x1d670, 0x1d689, 65],
  [0x1d68a, 0x1d6a3, 97],
];

function mapMathAlphabetChar(char: string) {
  const codePoint = char.codePointAt(0);
  if (!codePoint) return char;

  for (const [start, end, base] of SEARCH_MATH_RANGES) {
    if (codePoint >= start && codePoint <= end) {
      return String.fromCharCode(base + (codePoint - start));
    }
  }

  return char;
}

function normalizeForSearch(value: string) {
  return Array.from(value)
    .map((char) => mapMathAlphabetChar(char))
    .join('')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function formatNumber(value: number | string) {
  return new Intl.NumberFormat('fr-FR').format(Number(value || 0));
}

function calculatePush(current: number, end: number) {
  return Math.max(0, end - current);
}

function calculatePoints(push: number, objective: number, bigObjective: number) {
  if (bigObjective > 0 && push >= bigObjective) return 3;
  if (bigObjective > 0 && push >= bigObjective / 2) return 1;
  return 0;
}

type TrophiesDisplayRow = {
  membershipId: string;
  playerName: string;
  role: Player['role'];
  clubName: string;
  clubId: string;
  trophiesPush: number;
};

type PointsDisplayRow = {
  membershipId: string;
  playerName: string;
  role: Player['role'];
  clubName: string;
  clubId: string;
  points: number;
  trophiesPush: number;
};


function LoadingDots() {
  return (
    <span className="ml-1 inline-flex items-end gap-0.5">
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="inline-block h-1.5 w-1.5 rounded-full bg-current"
          animate={{ y: [0, -3, 0], opacity: [0.35, 1, 0.35] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: index * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
}

function DottedSurface() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0a0a, 1800, 10000);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(0, 355, 1220);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    containerRef.current.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const separation = 130;
    const xCount = 34;
    const yCount = 54;

    for (let x = 0; x < xCount; x++) {
      for (let y = 0; y < yCount; y++) {
        positions.push(x * separation - (xCount * separation) / 2, 0, y * separation - (yCount * separation) / 2);
        const isOrange = (x + y) % 5 === 0;
        const isGreen = (x + y) % 7 === 0;
        if (isOrange) colors.push(1, 0.45, 0.1);
        else if (isGreen) colors.push(0.1, 0.8, 0.45);
        else colors.push(0.95, 0.95, 0.95);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 7,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let count = 0;
    let animationId = 0;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const arr = (geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      let i = 0;
      for (let x = 0; x < xCount; x++) {
        for (let y = 0; y < yCount; y++) {
          arr[i * 3 + 1] = Math.sin((x + count) * 0.28) * 30 + Math.sin((y + count) * 0.45) * 30;
          i++;
        }
      }
      geometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
      count += 0.05;
    };

    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', resize);
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="pointer-events-none fixed inset-0 -z-10 opacity-60" />;
}

function StatCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="overflow-hidden rounded-3xl border-white/10 bg-black/45 shadow-2xl backdrop-blur-xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-400">{title}</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-white">{value}</p>
          </div>
          <div className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-3">
            <Icon className="h-5 w-5 text-orange-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FeatureCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl">
      <div className="flex min-w-0 items-start gap-3">
        <div className="shrink-0 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-3 text-orange-300">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="break-words font-semibold text-white">{title}</p>
          <p className="mt-1 break-words text-sm text-zinc-400">{description}</p>
        </div>
      </div>
    </div>
  );
}

function LogsDialog({ open, onOpenChange, logs }: { open: boolean; onOpenChange: (v: boolean) => void; logs: AdminLogEntry[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Logs admin</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">Aucune action enregistrée.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="break-words text-sm text-white">{log.message}</p>
                <p className="mt-2 text-xs text-zinc-500">{log.createdAt}</p>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClubEditDialog({
  club,
  open,
  onOpenChange,
  onSave,
}: {
  club: Club | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (club: Club) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<Club | null>(club);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(club);
  }, [club]);

  if (!draft) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Éditer le club • {draft.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-zinc-400">Nom</p>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <p className="mb-2 text-sm text-zinc-400">Rang de puissance</p>
            <Input value={draft.powerRank} onChange={(e) => setDraft({ ...draft, powerRank: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <p className="mb-2 text-sm text-zinc-400">Objectif</p>
            <Input value={draft.objective} onChange={(e) => setDraft({ ...draft, objective: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <p className="mb-2 text-sm text-zinc-400">Gros objectif</p>
            <Input value={draft.bigObjective} onChange={(e) => setDraft({ ...draft, bigObjective: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <p className="mb-2 text-sm text-zinc-400">Président</p>
            <Input value={draft.president} onChange={(e) => setDraft({ ...draft, president: e.target.value })} />
          </div>
          <div>
            <p className="mb-2 text-sm text-zinc-400">Vice-présidents</p>
            <Input value={draft.vicePresidents} onChange={(e) => setDraft({ ...draft, vicePresidents: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <p className="mb-2 text-sm text-zinc-400">Tag du club</p>
            <Input value={draft.clubTag ?? ''} onChange={(e) => setDraft({ ...draft, clubTag: e.target.value })} placeholder="#ABC123" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(draft);
                onOpenChange(false);
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlayerEditDialog({
  player,
  club,
  open,
  onOpenChange,
  onSave,
}: {
  player: Player | null;
  club?: Club;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (player: Player) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState<Player | null>(player);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(player);
  }, [player]);

  if (!draft || !club) return null;

  const push = calculatePush(draft.current, draft.end);
  const points = calculatePoints(push, club.objective, club.bigObjective);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Modifier {draft.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-sm text-zinc-400">Nom</p>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div>
            <p className="mb-2 text-sm text-zinc-400">Rôle</p>
            <Select value={draft.role} onValueChange={(value) => setDraft({ ...draft, role: value as Player['role'] })}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Président">Président</SelectItem>
                <SelectItem value="Vice-président">Vice-président</SelectItem>
                <SelectItem value="Membre">Membre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-2 text-sm text-zinc-400">Trophées de départ</p>
            <Input value={draft.current} onChange={(e) => setDraft({ ...draft, current: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <p className="mb-2 text-sm text-zinc-400">Meilleur total saison</p>
            <Input value={draft.end} onChange={(e) => setDraft({ ...draft, end: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <p className="mb-2 text-sm text-zinc-400">Statut</p>
            <Button
              variant="outline"
              className={draft.active ? 'w-full bg-emerald-500/10 text-emerald-300' : 'w-full bg-red-500/10 text-red-300'}
              onClick={() => setDraft({ ...draft, active: !draft.active })}
            >
              {draft.active ? 'Actif' : 'Inactif'}
            </Button>
          </div>
          <div>
            <p className="mb-2 text-sm text-zinc-400">Avertissements</p>
            <Input value={draft.warnings} onChange={(e) => setDraft({ ...draft, warnings: Number(e.target.value) || 0 })} />
          </div>
          <div className="md:col-span-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
              Club : <span className="font-semibold text-white">{club.name}</span> • Push : <span className="font-semibold text-emerald-300">+{formatNumber(push)}</span> • Points : <span className="font-semibold text-orange-300">{points}</span>
            </div>
          </div>
          <div className="md:col-span-2">
            <p className="mb-2 text-sm text-zinc-400">Notes internes</p>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className="min-h-[120px] w-full resize-y rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(draft);
                onOpenChange(false);
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlayerDetailDialog({
  player,
  club,
  open,
  onOpenChange,
  onDelete,
}: {
  player: Player | null;
  club?: Club;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDelete: (playerId: string) => Promise<void> | void;
}) {
  const [deleting, setDeleting] = useState(false);
  if (!player || !club) return null;

  const push = calculatePush(player.current, player.end);
  const points = calculatePoints(push, club.objective, club.bigObjective);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fiche détaillée • {player.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-zinc-400">Club</p>
              <p className="mt-1 font-bold text-white">{club.name}</p>
              <p className="mt-4 text-sm text-zinc-400">Rôle</p>
              <p className="mt-1 font-bold text-white">{player.role}</p>
              <p className="mt-4 text-sm text-zinc-400">Dernière activité</p>
              <p className="mt-1 font-bold text-white">{player.lastSeen}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-zinc-400">Push saison</p>
              <p className="mt-1 font-bold text-emerald-300">+{formatNumber(push)}</p>
              <p className="mt-4 text-sm text-zinc-400">Points</p>
              <p className="mt-1 font-bold text-orange-300">{points}</p>
              <p className="mt-4 text-sm text-zinc-400">Statut</p>
              <p className={`mt-1 font-bold ${player.active ? 'text-emerald-300' : 'text-red-300'}`}>{player.active ? 'Actif' : 'Inactif'}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-zinc-400">Notes internes</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-200">{player.notes || '—'}</p>
          </div>
        </div>
        <DialogFooter className="flex items-center justify-between gap-2">
          <Button
            variant="destructive"
            onClick={async () => {
              setDeleting(true);
              try {
                await onDelete(player.id);
                onOpenChange(false);
              } finally {
                setDeleting(false);
              }
            }}
            disabled={deleting}
          >
            {deleting ? 'Suppression...' : 'Supprimer'}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SeasonDangerDialog({
  open,
  onOpenChange,
  seasonName,
  onConfirm,
  loading,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  seasonName?: string | null;
  onConfirm: () => Promise<void> | void;
  loading: boolean;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (!open) {
      setAcknowledged(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-red-400">Action dangereuse</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-zinc-300">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <p>Cette action clôture la saison actuelle et ouvre une nouvelle saison.</p>
            <p className="mt-2">Le dashboard basculera sur la nouvelle saison.</p>
            <p className="mt-2">Cette action est considérée comme irréversible depuis l'interface.</p>
            <p className="mt-2 font-medium text-red-300">Attention : une fois fait vous ne pourrez plus exporter cette saison.</p>
            <p className="mt-3 text-xs text-zinc-400">En cas d'erreur, contactez @.pacmann sur le dc.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-zinc-200">
            <span className="text-zinc-400">Saison concernée :</span>{' '}
            <span className="font-medium text-white">{seasonName ?? 'Saison active'}</span>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-black text-orange-400"
            />
            <span className="text-sm text-zinc-200">Ok j'ai compris</span>
          </label>
        </div>
        <DialogFooter className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annuler</Button>
          <Button variant="destructive" onClick={() => void onConfirm()} disabled={!acknowledged || loading}>
            {loading ? 'Confirmation...' : 'Confirmer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SeasonEditDialog({
  open,
  onOpenChange,
  season,
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  season: { id: string; name: string; seasonNumber?: number | null } | null;
  onSave: (input: { seasonId: string; name: string }) => Promise<void> | void;
}) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(season?.name ?? '');
    }
  }, [open, season]);

  if (!season) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modifier la saison</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-300">
            <p>Numéro actuel : <span className="font-medium text-white">{season.seasonNumber ? `Saison ${season.seasonNumber}` : '—'}</span></p>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">Nom de la saison</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Fées et dragons" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button
            onClick={async () => {
              setSaving(true);
              try {
                await onSave({ seasonId: season.id, name });
                onOpenChange(false);
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StaffLoginDialog({
  open,
  onOpenChange,
  onLogin,
  loading,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onLogin: () => Promise<void> | void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Connexion staff</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-zinc-300">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p>Connexion réservée au staff.</p>
            <p className="mt-2 text-zinc-400">Si tu n'es pas modo, ça ne te donnera aucun accès en plus.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Fermer</Button>
          <Button onClick={() => void onLogin()} disabled={loading}>
            {loading ? 'Connexion...' : 'Continuer avec Google'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StaffDisplayNameDialog({
  open,
  value,
  onChange,
  onSave,
  loading,
}: {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onSave: () => Promise<void> | void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pseudo staff obligatoire</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-zinc-300">
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
            <p>Renseigne ton pseudo Discord ou Brawl Stars pour qu'on voie clairement dans les logs qui a modifié quoi.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">Pseudo staff</label>
            <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Ex : pacmann / @pacmann / Ton pseudo BS" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void onSave()} disabled={loading || value.trim().length < 2}>
            {loading ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BrawlClubManagerApp() {
  const [clubs, setClubs] = useState<Club[]>(MOCK_CLUBS);
  const [players, setPlayers] = useState<Player[]>(MOCK_PLAYERS);
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [activeSeason, setActiveSeason] = useState<{ id: string; name: string; status: string; seasonNumber?: number | null; startsAt?: string | null; endsAt?: string | null } | null>(null);
  const [search, setSearch] = useState('');
  const [clubFilter, setClubFilter] = useState('all');
  const [rankingTab, setRankingTab] = useState<'trophies' | 'points'>('trophies');
  const [rankingClubFilter, setRankingClubFilter] = useState('all');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);
  const [editingClubId, setEditingClubId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [exportingSeason, setExportingSeason] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [seasonDangerOpen, setSeasonDangerOpen] = useState(false);
  const [seasonEditOpen, setSeasonEditOpen] = useState(false);
  const [staffMe, setStaffMe] = useState<StaffMe | null>(null);
  const [staffLoginOpen, setStaffLoginOpen] = useState(false);
  const [staffPseudoOpen, setStaffPseudoOpen] = useState(false);
  const [staffPseudoDraft, setStaffPseudoDraft] = useState('');
  const [staffAuthLoading, setStaffAuthLoading] = useState(false);
  const [savingStaffPseudo, setSavingStaffPseudo] = useState(false);

  const refresh = async () => {
    if (!hasSupabaseEnv) return;
    setLoading(true);
    setError(null);
    try {
      const data = await loadDashboardData();
      setSeasonId(data.activeSeason.id);
      setActiveSeason(data.activeSeason);
      setClubs(data.clubs);
      setPlayers(data.players);
      setLogs(data.logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const refreshStaffMe = async () => {
    if (!hasSupabaseEnv) return;
    try {
      const me = await getStaffMe();
      setStaffMe(me);
      if (me.canModerate && !me.displayName) {
        setStaffPseudoDraft('');
        setStaffPseudoOpen(true);
      } else {
        setStaffPseudoOpen(false);
      }
    } catch {
      setStaffMe({ isLoggedIn: false, role: 'viewer', displayName: null, email: null, canModerate: false });
      setStaffPseudoOpen(false);
    }
  };

  useEffect(() => {
    void refresh();
    void refreshStaffMe();
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshStaffMe();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const formatSeasonDate = (value?: string | null, options?: { hideIfActive?: boolean }) => {
    if (options?.hideIfActive && activeSeason?.status === 'active') return '—';
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'Europe/Paris',
    });
  };

  const canModerate = staffMe?.canModerate === true;
  const staffRoleLabel = staffMe?.role === 'owner' ? 'Owner' : staffMe?.role === 'moderator' ? 'Modo' : 'Visiteur';

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = normalizeForSearch(search);

    return players.filter((player) => {
      if (clubFilter !== 'all' && player.clubId !== clubFilter) return false;
      if (!normalizedSearch) return true;

      const haystack = [player.name, player.notes, clubs.find((club) => club.id === player.clubId)?.name ?? '']
        .map((value) => normalizeForSearch(value))
        .join(' ');

      return haystack.includes(normalizedSearch);
    });
  }, [players, search, clubFilter, clubs]);

  const editingPlayer = players.find((player) => player.id === editingPlayerId) ?? null;
  const detailPlayer = players.find((player) => player.id === detailPlayerId) ?? null;
  const editingClub = clubs.find((club) => club.id === editingClubId) ?? null;
  const editingPlayerClub = editingPlayer ? clubs.find((club) => club.id === editingPlayer.clubId) : undefined;
  const detailPlayerClub = detailPlayer ? clubs.find((club) => club.id === detailPlayer.clubId) : undefined;

  const stats = useMemo(
    () => ({
      totalMembers: players.length,
      totalPush: players.reduce((acc, player) => acc + calculatePush(player.current, player.end), 0),
      totalPoints: players.reduce((acc, player) => {
        const club = clubs.find((item) => item.id === player.clubId);
        return acc + (club ? calculatePoints(calculatePush(player.current, player.end), club.objective, club.bigObjective) : 0);
      }, 0),
      inactiveCount: players.filter((player) => !player.active).length,
    }),
    [players, clubs],
  );

  const topClub = useMemo(
    () => [...clubs]
      .map((club) => {
        const clubPlayers = players.filter((player) => player.clubId === club.id);
        const totalPush = clubPlayers.reduce((acc, player) => acc + calculatePush(player.current, player.end), 0);
        const totalPoints = clubPlayers.reduce((acc, player) => acc + calculatePoints(calculatePush(player.current, player.end), club.objective, club.bigObjective), 0);
        return { ...club, score: totalPush + totalPoints * 500 };
      })
      .sort((a, b) => b.score - a.score)[0],
    [clubs, players],
  );

  const displayedTrophiesRanking = useMemo<TrophiesDisplayRow[]>(() => {
    const rows = players
      .map((player) => {
        const club = clubs.find((item) => item.id === player.clubId);
        return {
          membershipId: player.id,
          playerName: player.name,
          role: player.role,
          clubName: club?.name ?? '—',
          clubId: player.clubId,
          trophiesPush: calculatePush(player.current, player.end),
        };
      })
      .filter((row) => rankingClubFilter === 'all' || row.clubId === rankingClubFilter)
      .sort((a, b) => b.trophiesPush - a.trophiesPush);

    return rankingClubFilter === 'all' ? rows.slice(0, 10) : rows;
  }, [players, clubs, rankingClubFilter]);

  const displayedPointsRanking = useMemo<PointsDisplayRow[]>(() => {
    const rows = players
      .map((player) => {
        const club = clubs.find((item) => item.id === player.clubId);
        const trophiesPush = calculatePush(player.current, player.end);

        return {
          membershipId: player.id,
          playerName: player.name,
          role: player.role,
          clubName: club?.name ?? '—',
          clubId: player.clubId,
          points: club ? calculatePoints(trophiesPush, club.objective, club.bigObjective) : 0,
          trophiesPush,
        };
      })
      .filter((row) => rankingClubFilter === 'all' || row.clubId === rankingClubFilter)
      .sort((a, b) => b.points - a.points || b.trophiesPush - a.trophiesPush);

    return rankingClubFilter === 'all' ? rows.slice(0, 10) : rows;
  }, [players, clubs, rankingClubFilter]);

  const handleSaveClub = async (club: Club) => {
    if (!canModerate) return;
    setClubs((prev) => prev.map((item) => (item.id === club.id ? club : item)));
    if (hasSupabaseEnv && seasonId) {
      await saveClubSettings({
        clubId: club.id,
        seasonId,
        name: club.name,
        powerRank: club.powerRank,
        objective: club.objective,
        bigObjective: club.bigObjective,
        clubTag: club.clubTag,
      });
      await refresh();
    }
  };

  const handleSavePlayer = async (player: Player) => {
    if (!canModerate) return;
    setPlayers((prev) => prev.map((item) => (item.id === player.id ? player : item)));
    if (hasSupabaseEnv) {
      await savePlayerMembership({
        membershipId: player.id,
        name: player.name,
        role: player.role,
        current: player.current,
        end: player.end,
        active: player.active,
        notes: player.notes,
      });
      await refresh();
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!canModerate) return;
    setPlayers((prev) => prev.filter((player) => player.id !== playerId));
    if (hasSupabaseEnv) {
      await deleteMembership(playerId);
      await refresh();
    }
  };

  const handleSyncBrawl = async () => {
    if (!canModerate) return;
    setSyncing(true);
    setError(null);
    setSyncMessage(null);
    try {
      const summary = await syncBrawlStars();
      await refresh();
      setSyncMessage(`Sync OK • ${summary.processedClubs} clubs • ${summary.processedMembers} membres • ${summary.updatedMemberships} maj`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de synchronisation Brawl Stars');
    } finally {
      setSyncing(false);
    }
  };

  const handleExportSeason = async () => {
    if (typeof window === 'undefined' || !canModerate) return;
    setExportingSeason(true);
    setError(null);
    setSyncMessage(null);
    try {
      const headers: Record<string, string> = await (async (): Promise<Record<string, string>> => {
        if (!supabase) return {};
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
      })();
      const response = await fetch(`/api/seasons/export?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers,
      });

      if (!response.ok) {
        let message = 'Erreur pendant l\'export de la saison';
        try {
          const json = await response.json();
          if (json?.error) message = json.error;
        } catch {
          // ignore json parsing errors
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition') ?? '';
      const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
      const classicMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
      const rawFileName = utf8Match?.[1] ?? classicMatch?.[1] ?? 'export-saison.xlsx';
      const fileName = decodeURIComponent(rawFileName);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSyncMessage(`Export prêt : ${fileName}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur pendant l\'export de la saison');
    } finally {
      setExportingSeason(false);
    }
  };

  const handleCloseAndOpenSeason = async () => {
    if (!canModerate) return;
    setSyncing(true);
    setError(null);
    setSyncMessage(null);
    try {
      const result = await closeAndOpenNextSeason();
      await refresh();
      setSeasonDangerOpen(false);
      setSyncMessage(`Saison fermée : ${result.previousSeason.name} → ${result.newSeason.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de gestion de saison');
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveSeason = async (input: { seasonId: string; name: string }) => {
    if (!canModerate) return;
    setError(null);
    setSyncMessage(null);
    try {
      await saveSeason(input);
      await refresh();
      setSyncMessage(`Saison renommée : ${input.name.trim()}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de modification de saison');
      throw e;
    }
  };

  const handleStaffLogin = async () => {
    setStaffAuthLoading(true);
    setError(null);
    try {
      await signInStaffWithGoogle();
      setStaffLoginOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de connexion staff');
    } finally {
      setStaffAuthLoading(false);
    }
  };

  const handleStaffLogout = async () => {
    setStaffAuthLoading(true);
    setError(null);
    try {
      await signOutStaff();
      setIsAdminMode(false);
      setStaffMe({ isLoggedIn: false, role: 'viewer', displayName: null, email: null, canModerate: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de déconnexion');
    } finally {
      setStaffAuthLoading(false);
    }
  };

  const handleSaveStaffPseudo = async () => {
    const value = staffPseudoDraft.trim();
    if (value.length < 2) return;
    setSavingStaffPseudo(true);
    setError(null);
    try {
      await saveStaffDisplayName(value);
      await refreshStaffMe();
      setStaffPseudoOpen(false);
      setSyncMessage('Pseudo staff enregistré.');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'enregistrement du pseudo");
    } finally {
      setSavingStaffPseudo(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <DottedSurface />
      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-6 shadow-2xl backdrop-blur-2xl"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="rounded-full border-orange-500/20 bg-orange-500/10 px-3 py-1 text-orange-300">Brawl Stars • Back-office modération</Badge>
                <Badge className="rounded-full border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">PC + Mobile</Badge>
                {hasSupabaseEnv ? (
                  <Badge className="rounded-full border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">Supabase connecté</Badge>
                ) : (
                  <Badge className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-zinc-300">Mode mock</Badge>
                )}
              </div>
              <h1 className="break-words text-4xl font-black tracking-tight text-white sm:text-5xl">Gestion des clubs</h1>
            </div>

            <div className={`grid w-full gap-3 ${isAdminMode ? 'sm:grid-cols-6 lg:w-[1100px]' : 'sm:grid-cols-4 lg:w-[820px]'}`}>
              {isAdminMode && (
                <>
                  <Button variant="outline" onClick={() => setLogsOpen(true)} disabled={!canModerate}>
                    <ScrollText className="mr-2 h-4 w-4" />Logs
                  </Button>
                  <Button variant="outline" onClick={() => setSeasonDangerOpen(true)} disabled={!canModerate}>
                    <History className="mr-2 h-4 w-4" />Clôturer / ouvrir
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => void handleExportSeason()} disabled={!canModerate || exportingSeason}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />{exportingSeason ? 'Export...' : 'Export saison'}
              </Button>
              <Button variant="outline" onClick={() => void handleSyncBrawl()} disabled={!canModerate || syncing}>
                {syncing ? <><span>Sync</span><LoadingDots /></> : 'Sync Brawl Stars'}
              </Button>
              <Button
                onClick={() => {
                  if (!canModerate) return;
                  setIsAdminMode((prev) => !prev);
                }}
                disabled={!canModerate}
                variant="outline"
                className={isAdminMode ? 'border-orange-500/20 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20' : ''}
              >
                <Shield className="mr-2 h-4 w-4" />
                {isAdminMode ? 'Mode admin activé' : 'Mode modération'}
              </Button>
              {staffMe?.isLoggedIn ? (
                <Button variant="outline" onClick={() => void handleStaffLogout()} disabled={staffAuthLoading}>
                  <LogOut className="mr-2 h-4 w-4" />{staffAuthLoading ? 'Sortie...' : `${staffRoleLabel} • ${staffMe.displayName ?? 'Staff'}`}
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setStaffLoginOpen(true)}>
                  <Lock className="mr-2 h-4 w-4" />Accès staff
                </Button>
              )}
            </div>
          </div>

          {error && <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
          {syncMessage && <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{syncMessage}</div>}
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
            {canModerate ? `Staff connecté${staffMe?.displayName ? ` • ${staffMe.displayName}` : ''}` : 'Lecture seule publique • connecte-toi seulement si tu fais partie du staff.'}
          </div>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Membres suivis" value={stats.totalMembers} icon={Users} />
          <StatCard title="Push total" value={`+${formatNumber(stats.totalPush)}`} icon={Trophy} />
          <StatCard title="Points distribués" value={stats.totalPoints} icon={Target} />
          <StatCard title="Inactifs" value={stats.inactiveCount} icon={Shield} />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-6">
            <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-black/45 shadow-2xl backdrop-blur-xl">
              <CardContent className="p-6">
                <Tabs defaultValue="players">
                  <TabsList className="grid w-full grid-cols-4 rounded-full border border-white/10 bg-white/5 p-1">
                    <TabsTrigger value="players" className="rounded-full">Joueurs</TabsTrigger>
                    <TabsTrigger value="clubs" className="rounded-full">Clubs</TabsTrigger>
                    <TabsTrigger value="ranking" className="rounded-full">Classement</TabsTrigger>
                    <TabsTrigger value="pig" className="rounded-full">pig</TabsTrigger>
                  </TabsList>

                  <TabsContent value="players" className="mt-6">
                    <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_280px]">
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un joueur..."
                      />

                      <Select value={clubFilter} onValueChange={setClubFilter}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Tous les clubs" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous les clubs</SelectItem>
                          {clubs.map((club) => (
                            <SelectItem key={club.id} value={club.id}>
                              {club.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-4">
                      {filteredPlayers.length === 0 && (
                        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-zinc-400">
                          Aucun joueur trouvé avec cette recherche.
                        </div>
                      )}

                      {filteredPlayers.map((player, index) => {
                        const club = clubs.find((item) => item.id === player.clubId);
                        if (!club) return null;
                        const push = calculatePush(player.current, player.end);
                        const points = calculatePoints(push, club.objective, club.bigObjective);

                        return (
                          <motion.div
                            key={player.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/45 p-5 shadow-2xl backdrop-blur-xl"
                          >
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="break-words text-lg font-bold text-white">{player.name}</h3>
                                  <Badge className="border-white/10 bg-white/5 text-zinc-200">{player.role}</Badge>
                                  <Badge className="border-orange-500/20 bg-orange-500/10 text-orange-300">{club.name}</Badge>
                                  {player.isNew && <Badge className="border-cyan-500/30 bg-cyan-500/15 text-cyan-300">NEW</Badge>}
                                  {!player.active && <Badge className="bg-red-500/15 text-red-300">Inactif</Badge>}
                                </div>
                                <p className="mt-2 break-words text-sm text-zinc-400">
                                  Push : +{formatNumber(push)} • Points : {points}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                                <div className="min-w-[128px] rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                                  <p className="text-xs text-emerald-300/80">Push saison</p>
                                  <p className="mt-1 font-bold text-emerald-300">+{formatNumber(push)}</p>
                                </div>

                                <div className="min-w-[104px] rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3">
                                  <p className="text-xs text-orange-300/80">Points</p>
                                  <p className="mt-1 font-bold text-orange-300">{points} pt{points > 1 ? 's' : ''}</p>
                                </div>

                                {isAdminMode && (
                                  <>
                                    <Button variant="outline" onClick={() => setDetailPlayerId(player.id)}>
                                      <FileText className="mr-2 h-4 w-4" />Fiche
                                    </Button>
                                    <Button variant="outline" onClick={() => setEditingPlayerId(player.id)}>
                                      <PencilLine className="mr-2 h-4 w-4" />Modifier
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="clubs" className="mt-6">
                    <div className="grid gap-4 xl:grid-cols-2">
                      {clubs.map((club) => {
                        const clubPlayers = players.filter((player) => player.clubId === club.id);
                        const totalPush = clubPlayers.reduce((acc, player) => acc + calculatePush(player.current, player.end), 0);
                        const totalPoints = clubPlayers.reduce((acc, player) => acc + calculatePoints(calculatePush(player.current, player.end), club.objective, club.bigObjective), 0);

                        return (
                          <Card key={club.id} className="overflow-hidden rounded-[2rem] border-white/10 bg-black/45 shadow-2xl backdrop-blur-xl">
                            <CardHeader>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <CardTitle className="break-words text-white">{club.name}</CardTitle>
                                  <CardDescription>#{club.powerRank}</CardDescription>
                                </div>
                                {isAdminMode && (
                                  <Button variant="outline" onClick={() => setEditingClubId(club.id)}>
                                    <PencilLine className="mr-2 h-4 w-4" />Éditer
                                  </Button>
                                )}
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="flex flex-wrap gap-3">
                                <div className="min-w-[84px] flex-1 rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <p className="text-xs text-zinc-500">Membres</p>
                                  <p className="mt-1 text-lg font-bold text-white">{clubPlayers.length}/30</p>
                                </div>
                                <div className="min-w-[118px] flex-[1.25] rounded-2xl border border-white/10 bg-white/5 p-3">
                                  <p className="text-xs text-zinc-500">Push</p>
                                  <p className="mt-1 text-lg font-bold text-white">+{formatNumber(totalPush)}</p>
                                </div>
                                <div className="min-w-[96px] flex-1 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                                  <p className="text-xs text-emerald-300/80">Objectif</p>
                                  <p className="mt-1 text-lg font-bold text-emerald-300">{club.objective}</p>
                                </div>
                                <div className="min-w-[88px] flex-1 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-3">
                                  <p className="text-xs text-orange-300/80">Points</p>
                                  <p className="mt-1 text-lg font-bold text-orange-300">{totalPoints}</p>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                                <p className="text-xs text-cyan-300/80">Gros objectif</p>
                                <p className="mt-1 text-lg font-bold text-cyan-300">{club.bigObjective}</p>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="ranking" className="mt-6">
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => setRankingTab('trophies')} variant={rankingTab === 'trophies' ? 'default' : 'outline'}>
                          Classement trophées
                        </Button>
                        <Button onClick={() => setRankingTab('points')} variant={rankingTab === 'points' ? 'default' : 'outline'}>
                          Classement points
                        </Button>
                      </div>

                      <div className="w-full lg:w-[280px]">
                        <Select value={rankingClubFilter} onValueChange={setRankingClubFilter}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Classement général" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Classement général</SelectItem>
                            {clubs.map((club) => (
                              <SelectItem key={club.id} value={club.id}>
                                {club.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                      <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-black/45 shadow-2xl backdrop-blur-xl">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-white">
                            <BarChart3 className="h-5 w-5 text-orange-400" />
                            {rankingTab === 'trophies' ? 'Top trophées saison' : 'Top joueurs en points'}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {rankingTab === 'trophies' ? (
                            displayedTrophiesRanking.length === 0 ? (
                              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
                                Aucun joueur dans ce classement pour ce filtre.
                              </div>
                            ) : (
                              displayedTrophiesRanking.map((row, index) => (
                                <div key={`${row.membershipId}-${index}`} className="flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/50 font-black text-white">
                                      #{index + 1}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="break-words font-bold text-white">{row.playerName}</p>
                                      <p className="break-words text-sm text-zinc-400">{row.clubName} • {row.role}</p>
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="font-bold text-emerald-300">+{formatNumber(row.trophiesPush)}</p>
                                    <p className="text-sm text-zinc-400">trophées</p>
                                  </div>
                                </div>
                              ))
                            )
                          ) : displayedPointsRanking.length === 0 ? (
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
                              Aucun joueur dans ce classement pour ce filtre.
                            </div>
                          ) : (
                            displayedPointsRanking.map((row, index) => (
                              <div key={`${row.membershipId}-${index}`} className="flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/50 font-black text-white">
                                    #{index + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="break-words font-bold text-white">{row.playerName}</p>
                                    <p className="break-words text-sm text-zinc-400">{row.clubName} • {row.role}</p>
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="font-bold text-orange-300">{row.points} pts</p>
                                  <p className="text-sm text-zinc-400">+{formatNumber(row.trophiesPush)}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>

                      <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-black/45 shadow-2xl backdrop-blur-xl">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-white">
                            <Crown className="h-5 w-5 text-emerald-400" />Règles points
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
                            <p className="font-semibold text-orange-300">3 points</p>
                            <p className="mt-1 text-sm text-zinc-300">Le joueur accomplit entièrement le gros objectif.</p>
                          </div>
                          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                            <p className="font-semibold text-emerald-300">1 point</p>
                            <p className="mt-1 text-sm text-zinc-300">Le joueur atteint au moins 50% du gros objectif sans le terminer.</p>
                          </div>
                          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                            <p className="font-semibold text-red-300">0 point</p>
                            <p className="mt-1 text-sm text-zinc-300">Le joueur est sous la moitié du gros objectif.</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                            <p className="mt-2 text-sm text-zinc-400">
                              Le push de saison est calculé avec le meilleur total atteint pendant la saison moins les trophées de départ.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>

                  <TabsContent value="pig" className="mt-6">
                    <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-black/35 shadow-2xl backdrop-blur-xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-white">
                          <StickyNote className="h-5 w-5 text-orange-400" /> pig
                        </CardTitle>
                        <CardDescription>Section temporairement indisponible.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[1.5rem] border border-white/10 bg-white/5 px-6 py-10 text-center">
                          <div className="mb-4 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 text-orange-300">
                            <StickyNote className="h-8 w-8" />
                          </div>
                          <h3 className="text-xl font-bold text-white">Pig en construction</h3>
                          <p className="mt-3 max-w-xl text-sm text-zinc-400">
                            Cette partie est désactivée pour le moment.
                            Le bloc note a été retiré temporairement en attendant une vraie version propre.
                          </p>
                          <p className="mt-2 text-xs text-zinc-500">
                            Personne ne peut rien écrire ici pour l’instant.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 min-w-0">
            <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-black/45 shadow-2xl backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Medal className="h-5 w-5 text-orange-400" />Top club
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-3xl border border-orange-500/20 bg-orange-500/10 p-5">
                  <p className="text-sm text-orange-300">#1 actuelle</p>
                  <p className="mt-2 break-words text-2xl font-black text-white">{topClub?.name}</p>
                  <p className="mt-2 break-words text-sm text-zinc-300">Président : {topClub?.president}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-black/45 shadow-2xl backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Database className="h-5 w-5 text-emerald-400" />Accès rapide
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <FeatureCard
                  title="Mode admin"
                  description="Même site, mêmes cartes, mais avec les actions staff qui apparaissent quand tu actives le mode admin."
                  icon={Shield}
                />
                <FeatureCard
                  title="Historique saisons"
                  description="Comparer les saisons et exporter en excel."
                  icon={History}
                />
                <FeatureCard
                  title="Sanctions et notes"
                  description="Visible dans les fiches joueurs et dans les modifs staff."
                  icon={NotebookPen}
                />
                {loading && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-zinc-400">
                    Chargement des données...
                  </div>
                )}
                {isAdminMode && (
                  <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 text-sm text-orange-300">
                    Mode admin activé : les boutons Fiche, Modifier, Éditer, Logs et la gestion de saison sont visibles.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-[2rem] border-emerald-500/20 bg-emerald-500/10 shadow-2xl backdrop-blur-xl">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-white">
                  <History className="h-5 w-5 text-emerald-300" />Infos saison
                </CardTitle>
                {isAdminMode && activeSeason && (
                  <Button variant="outline" className="px-3 py-2 text-xs" onClick={() => setSeasonEditOpen(true)}>
                    <PencilLine className="mr-2 h-4 w-4" />Modifier
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 text-sm text-zinc-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">Nom</span>
                    <span className="font-medium text-white">{activeSeason?.name ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">Numéro</span>
                    <span className="font-medium text-white">{activeSeason?.seasonNumber ? `Saison ${activeSeason.seasonNumber}` : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">Début</span>
                    <span className="font-medium text-white">{formatSeasonDate(activeSeason?.startsAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">Fin</span>
                    <span className="font-medium text-white">{formatSeasonDate(activeSeason?.endsAt, { hideIfActive: true })}</span>
                  </div>
                </div>
                <Button variant="outline" className="mt-4 w-full" onClick={handleExportSeason} disabled={!canModerate || exportingSeason}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />Exporter la saison
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <LogsDialog open={logsOpen} onOpenChange={setLogsOpen} logs={logs} />
      <SeasonDangerDialog
        open={seasonDangerOpen}
        onOpenChange={setSeasonDangerOpen}
        seasonName={activeSeason?.name}
        onConfirm={handleCloseAndOpenSeason}
        loading={syncing}
      />
      <StaffLoginDialog
        open={staffLoginOpen}
        onOpenChange={setStaffLoginOpen}
        onLogin={handleStaffLogin}
        loading={staffAuthLoading}
      />
      <StaffDisplayNameDialog
        open={staffPseudoOpen}
        value={staffPseudoDraft}
        onChange={setStaffPseudoDraft}
        onSave={handleSaveStaffPseudo}
        loading={savingStaffPseudo}
      />
      <SeasonEditDialog
        open={seasonEditOpen}
        onOpenChange={setSeasonEditOpen}
        season={activeSeason}
        onSave={handleSaveSeason}
      />
      <ClubEditDialog open={Boolean(editingClub)} onOpenChange={(value) => !value && setEditingClubId(null)} club={editingClub} onSave={handleSaveClub} />
      <PlayerEditDialog open={Boolean(editingPlayer)} onOpenChange={(value) => !value && setEditingPlayerId(null)} player={editingPlayer} club={editingPlayerClub} onSave={handleSavePlayer} />
      <PlayerDetailDialog open={Boolean(detailPlayer)} onOpenChange={(value) => !value && setDetailPlayerId(null)} player={detailPlayer} club={detailPlayerClub} onDelete={handleDeletePlayer} />
    </div>
  );
}