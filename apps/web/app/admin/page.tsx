'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { Catalog, EditorialBuildStatus, Phase, Style } from '@deadlock/contracts';
import {
  ArrowLeft,
  Check,
  CircleAlert,
  KeyRound,
  LoaderCircle,
  Plus,
  Save,
  Send,
  Trash2,
} from 'lucide-react';

type Alternative = { itemClassName: string; reason?: string | null };
type FormStep = {
  order: number;
  phase: Phase;
  itemClassName: string;
  reason: string;
  alternatives: Alternative[];
};
type BuildVersion = {
  id: string;
  revision: number;
  title: string;
  summary: string;
  status: EditorialBuildStatus;
  snapshotId: string;
  steps: FormStep[];
};
type BuildSummary = { id: string; heroId: number; style: Style; version: BuildVersion | null };
type Detail = {
  snapshot: { id: string; clientVersion: number };
  build: BuildSummary;
  version: BuildVersion | null;
};

const styles: Style[] = ['balanced', 'damage', 'survival'];
const phases: Phase[] = ['early', 'core', 'late'];

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/admin${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || 'Le back-office a refusé la requête.');
  }
  return response.json() as Promise<T>;
}

function emptyStep(order: number): FormStep {
  return {
    order,
    phase: order <= 3 ? 'early' : order <= 6 ? 'core' : 'late',
    itemClassName: '',
    reason: '',
    alternatives: [],
  };
}

function toForm(version: BuildVersion | null) {
  return {
    title: version?.title ?? '',
    summary: version?.summary ?? '',
    steps:
      version?.steps.map((step) => ({ ...step, alternatives: step.alternatives ?? [] })) ??
      [1, 2, 3].map(emptyStep),
  };
}

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [builds, setBuilds] = useState<BuildSummary[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [form, setForm] = useState(toForm(null));
  const [newHero, setNewHero] = useState('');
  const [newStyle, setNewStyle] = useState<Style>('balanced');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/v1/catalog')
      .then((response) => (response.ok ? (response.json() as Promise<Catalog>) : null))
      .then(setCatalog)
      .catch(() => {});
  }, []);

  const availableHeroes = useMemo(() => catalog?.heroes ?? [], [catalog]);

  async function connect(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await request<{ builds: BuildSummary[] }>('/builds', token);
      setBuilds(response.builds);
      const first = response.builds[0];
      if (first) await selectBuild(first.id);
      setMessage('Back-office connecté.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  }

  async function selectBuild(id: string) {
    setLoading(true);
    setError('');
    try {
      const detail = await request<Detail>(`/builds/${encodeURIComponent(id)}`, token);
      setSelected(detail);
      setForm(toForm(detail.version));
      setNewHero(String(detail.build.heroId));
      setNewStyle(detail.build.style);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Build introuvable.');
    } finally {
      setLoading(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await request(`/builds/${encodeURIComponent(selected.build.id)}`, token, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      await refresh(selected.build.id, 'Révision enregistrée comme brouillon.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await request(`/builds/${encodeURIComponent(selected.build.id)}/publish`, token, {
        method: 'POST',
      });
      await refresh(selected.build.id, 'Build publié pour la version courante.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Publication impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await request(`/builds/${encodeURIComponent(selected.build.id)}/archive`, token, {
        method: 'POST',
      });
      await refresh(selected.build.id, 'Build archivé.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Archivage impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function duplicate() {
    if (!selected || !form.steps.length) return;
    setSaving(true);
    setError('');
    try {
      const created = await request<BuildSummary>('/builds', token, {
        method: 'POST',
        body: JSON.stringify({
          heroId: Number(newHero),
          style: newStyle,
          title: form.title,
          summary: form.summary,
          steps: form.steps,
        }),
      });
      await loadBuilds(created.id, 'Nouveau build créé en brouillon.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Création impossible.');
    } finally {
      setSaving(false);
    }
  }

  async function loadBuilds(id?: string, notice = '') {
    const response = await request<{ builds: BuildSummary[] }>('/builds', token);
    setBuilds(response.builds);
    if (id) await selectBuild(id);
    if (notice) setMessage(notice);
  }

  async function refresh(id: string, notice: string) {
    await loadBuilds(id, notice);
  }

  function updateStep(index: number, value: Partial<FormStep>) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...value } : step,
      ),
    }));
  }

  function removeStep(index: number) {
    setForm((current) => ({
      ...current,
      steps: current.steps
        .filter((_, stepIndex) => stepIndex !== index)
        .map((step, stepIndex) => ({ ...step, order: stepIndex + 1 })),
    }));
  }

  if (!token || (!builds.length && !selected)) {
    return (
      <main className="admin-login">
        <a className="admin-back" href="/">
          <ArrowLeft size={16} /> Retour au guide
        </a>
        <div className="admin-login-card">
          <span className="admin-kicker">
            <KeyRound size={15} /> ESPACE ÉDITORIAL
          </span>
          <h1>Valider les plans.</h1>
          <p>
            Cette zone est protégée. Le jeton reste dans cette session et n’est jamais envoyé
            ailleurs que vers l’API du projet.
          </p>
          <form onSubmit={connect}>
            <label>
              Jeton administrateur
              <input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button className="admin-primary" disabled={loading}>
              {loading ? <LoaderCircle className="spin" /> : <Send size={16} />} Ouvrir le
              back-office
            </button>
          </form>
          {error && (
            <p className="admin-error" role="alert">
              <CircleAlert size={16} /> {error}
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <a className="admin-back" href="/">
          <ArrowLeft size={16} /> Guide public
        </a>
        <div>
          <span className="admin-kicker">ATELIER ÉDITORIAL</span>
          <h1>Réviser les plans de jeu.</h1>
        </div>
        <button
          className="admin-secondary"
          onClick={() => {
            setToken('');
            setSelected(null);
            setBuilds([]);
          }}
        >
          Se déconnecter
        </button>
      </header>
      {(error || message) && (
        <div
          className={error ? 'admin-banner error' : 'admin-banner'}
          role={error ? 'alert' : 'status'}
        >
          {error ? <CircleAlert size={16} /> : <Check size={16} />}
          {error || message}
        </div>
      )}
      <div className="admin-layout">
        <aside className="admin-list">
          <div className="admin-list-heading">
            <span>BUILDS · {builds.length}</span>
            <small>
              {selected?.snapshot.clientVersion ? `CLIENT ${selected.snapshot.clientVersion}` : ''}
            </small>
          </div>
          {builds.map((build) => (
            <button
              key={build.id}
              className={
                selected?.build.id === build.id ? 'admin-build-row active' : 'admin-build-row'
              }
              onClick={() => void selectBuild(build.id)}
            >
              <span>
                <strong>
                  {catalog?.heroes.find((hero) => hero.id === build.heroId)?.name ??
                    `Héros ${build.heroId}`}
                </strong>
                <small>
                  {build.style} · {build.version?.status ?? 'absent'}
                </small>
              </span>
              <span className={`admin-status ${build.version?.status ?? 'draft'}`} />
            </button>
          ))}
          <p className="admin-help">
            Un changement de catalogue marque automatiquement les versions concernées « à revoir ».
            Publiez seulement un build relu sur la version affichée.
          </p>
        </aside>
        {selected && (
          <section className="admin-editor">
            <div className="admin-editor-heading">
              <div>
                <span className="admin-kicker">
                  {catalog?.heroes.find((hero) => hero.id === selected.build.heroId)?.name ??
                    `Héros ${selected.build.heroId}`}{' '}
                  · {selected.build.style}
                </span>
                <h2>{selected.version?.status ?? 'Nouveau build'}</h2>
              </div>
              <div className="admin-actions">
                <button
                  className="admin-secondary"
                  disabled={saving}
                  onClick={() => void archive()}
                >
                  <Trash2 size={15} /> Archiver
                </button>
                <button
                  className="admin-primary compact"
                  disabled={saving}
                  onClick={() => void publish()}
                >
                  <Check size={15} /> Publier
                </button>
              </div>
            </div>
            <form onSubmit={save}>
              <label>
                Titre
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                Résumé
                <textarea
                  value={form.summary}
                  onChange={(event) => setForm({ ...form, summary: event.target.value })}
                  maxLength={1_000}
                  rows={3}
                  required
                />
              </label>
              <div className="admin-steps-heading">
                <div>
                  <span className="admin-kicker">PARCOURS · {form.steps.length} ACHATS</span>
                  <p>
                    Les objets utilisent leur identifiant interne, vérifié contre le snapshot
                    courant.
                  </p>
                </div>
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={() =>
                    setForm({ ...form, steps: [...form.steps, emptyStep(form.steps.length + 1)] })
                  }
                >
                  <Plus size={15} /> Ajouter
                </button>
              </div>
              <div className="admin-step-list">
                {form.steps.map((step, index) => (
                  <fieldset key={`${step.order}-${index}`} className="admin-step">
                    <legend>{String(index + 1).padStart(2, '0')}</legend>
                    <select
                      value={step.phase}
                      onChange={(event) =>
                        updateStep(index, { phase: event.target.value as Phase })
                      }
                      aria-label={`Phase ${index + 1}`}
                    >
                      {phases.map((phase) => (
                        <option key={phase}>{phase}</option>
                      ))}
                    </select>
                    <input
                      value={step.itemClassName}
                      onChange={(event) => updateStep(index, { itemClassName: event.target.value })}
                      placeholder="item_class_name"
                      aria-label={`Objet ${index + 1}`}
                      required
                    />
                    <input
                      value={step.reason}
                      onChange={(event) => updateStep(index, { reason: event.target.value })}
                      placeholder="Pourquoi cet achat ?"
                      aria-label={`Explication ${index + 1}`}
                      required
                    />
                    <button
                      type="button"
                      className="admin-icon-button"
                      onClick={() => removeStep(index)}
                      aria-label={`Supprimer l’achat ${index + 1}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </fieldset>
                ))}
              </div>
              <button className="admin-primary save-button" disabled={saving}>
                {saving ? <LoaderCircle className="spin" /> : <Save size={16} />} Enregistrer une
                nouvelle révision
              </button>
            </form>
            <div className="admin-duplicate">
              <div>
                <span className="admin-kicker">DUPLIQUER LE PARCOURS</span>
                <p>Créer un autre build à partir de cette version, puis le retravailler.</p>
              </div>
              <select
                value={newHero}
                onChange={(event) => setNewHero(event.target.value)}
                aria-label="Héros du nouveau build"
              >
                {availableHeroes.map((hero) => (
                  <option key={hero.id} value={hero.id}>
                    {hero.name}
                  </option>
                ))}
              </select>
              <select
                value={newStyle}
                onChange={(event) => setNewStyle(event.target.value as Style)}
                aria-label="Style du nouveau build"
              >
                {styles.map((style) => (
                  <option key={style}>{style}</option>
                ))}
              </select>
              <button
                className="admin-secondary"
                disabled={saving}
                onClick={() => void duplicate()}
              >
                <Plus size={15} /> Créer
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
