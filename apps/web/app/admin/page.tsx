'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import type {
  Catalog,
  Category,
  EditorialBuildStatus,
  HeroTacticalProfile,
  InvestmentTarget,
  Phase,
  Style,
  TacticalProfileStatus,
  TacticalTagDefinition,
  TacticalTagKey,
} from '@deadlock/contracts';
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
type FormInvestment = InvestmentTarget;
type BuildVersion = {
  id: string;
  revision: number;
  title: string;
  summary: string;
  status: EditorialBuildStatus;
  snapshotId: string;
  steps: FormStep[];
  investments: FormInvestment[];
};
type BuildSummary = { id: string; heroId: number; style: Style; version: BuildVersion | null };
type Detail = {
  snapshot: { id: string; clientVersion: number };
  build: BuildSummary;
  version: BuildVersion | null;
};
type TacticalResponse = {
  version: string;
  tags: TacticalTagDefinition[];
  profiles: HeroTacticalProfile[];
};
type TacticalDraft = {
  enabled: boolean;
  intensity: 1 | 2 | 3;
  evidence: string;
  status: TacticalProfileStatus;
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

function emptyInvestment(): FormInvestment {
  return {
    branch: 'weapon',
    phase: 'core',
    threshold: 4_800,
    priority: 'preferred',
    reason: '',
  };
}

function toForm(version: BuildVersion | null) {
  return {
    title: version?.title ?? '',
    summary: version?.summary ?? '',
    steps:
      version?.steps.map((step) => ({ ...step, alternatives: step.alternatives ?? [] })) ??
      [1, 2, 3].map(emptyStep),
    investments: version?.investments ?? [],
  };
}

function toTacticalDraft(
  profile: HeroTacticalProfile | undefined,
  definitions: TacticalTagDefinition[],
) {
  const tags = new Map(profile?.tags.map((tag) => [tag.key, tag]));
  return Object.fromEntries(
    definitions.map((definition) => {
      const tag = tags.get(definition.key);
      return [
        definition.key,
        {
          enabled: Boolean(tag),
          intensity: tag?.intensity ?? 2,
          evidence: tag?.evidence ?? '',
          status: tag?.status ?? 'draft',
        },
      ];
    }),
  ) as Record<TacticalTagKey, TacticalDraft>;
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
  const [tactical, setTactical] = useState<TacticalResponse | null>(null);
  const [tacticalHeroId, setTacticalHeroId] = useState<number | null>(null);
  const [tacticalStatus, setTacticalStatus] = useState<TacticalProfileStatus>('draft');
  const [tacticalDraft, setTacticalDraft] = useState<Record<TacticalTagKey, TacticalDraft>>(
    {} as Record<TacticalTagKey, TacticalDraft>,
  );
  const [tacticalSaving, setTacticalSaving] = useState(false);

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
      const tacticalResponse = await request<TacticalResponse>('/tactical-profiles', token);
      setTactical(tacticalResponse);
      const tacticalHero = tacticalResponse.profiles[0];
      if (tacticalHero) {
        setTacticalHeroId(tacticalHero.heroId);
        setTacticalStatus(tacticalHero.status);
        setTacticalDraft(toTacticalDraft(tacticalHero, tacticalResponse.tags));
      }
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

  async function saveTactical(event: FormEvent) {
    event.preventDefault();
    if (!tactical || tacticalHeroId === null) return;
    setTacticalSaving(true);
    setError('');
    setMessage('');
    try {
      const tags = tactical.tags
        .filter((definition) => tacticalDraft[definition.key]?.enabled)
        .map((definition) => {
          const draft = tacticalDraft[definition.key];
          return {
            key: definition.key,
            intensity: draft.intensity,
            evidence: draft.evidence,
            status: draft.status,
          };
        });
      const profile = await request<HeroTacticalProfile>(
        `/tactical-profiles/${tacticalHeroId}?version=${encodeURIComponent(tactical.version)}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify({ status: tacticalStatus, source: 'back-office', tags }),
        },
      );
      setTactical((current) =>
        current
          ? {
              ...current,
              profiles: current.profiles.map((item) =>
                item.heroId === profile.heroId ? profile : item,
              ),
            }
          : current,
      );
      setTacticalDraft(toTacticalDraft(profile, tactical.tags));
      setTacticalStatus(profile.status);
      setMessage('Profil tactique enregistré comme brouillon.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Profil tactique invalide.');
    } finally {
      setTacticalSaving(false);
    }
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

  function updateInvestment(index: number, value: Partial<FormInvestment>) {
    setForm((current) => ({
      ...current,
      investments: current.investments.map((investment, investmentIndex) =>
        investmentIndex === index ? { ...investment, ...value } : investment,
      ),
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
              <div className="admin-steps-heading">
                <div>
                  <span className="admin-kicker">
                    PALIERS D’INVESTISSEMENT · {form.investments.length}
                  </span>
                  <p>
                    Ajoutez seulement les seuils justifiés pour ce héros et cette référence ; aucun
                    quota de 4 800 n’est appliqué automatiquement.
                  </p>
                </div>
                <button
                  type="button"
                  className="admin-secondary"
                  onClick={() =>
                    setForm({ ...form, investments: [...form.investments, emptyInvestment()] })
                  }
                >
                  <Plus size={15} /> Ajouter
                </button>
              </div>
              <div className="admin-investment-list">
                {form.investments.map((investment, index) => (
                  <fieldset
                    key={`${investment.branch}-${investment.phase}-${index}`}
                    className="admin-investment"
                  >
                    <select
                      value={investment.branch}
                      onChange={(event) =>
                        updateInvestment(index, { branch: event.target.value as Category })
                      }
                      aria-label={`Branche du palier ${index + 1}`}
                    >
                      <option value="weapon">Arme</option>
                      <option value="vitality">Vitalité</option>
                      <option value="spirit">Esprit</option>
                    </select>
                    <select
                      value={investment.phase}
                      onChange={(event) =>
                        updateInvestment(index, { phase: event.target.value as Phase })
                      }
                      aria-label={`Phase du palier ${index + 1}`}
                    >
                      {phases.map((phase) => (
                        <option key={phase} value={phase}>
                          {phase}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={100_000}
                      value={investment.threshold}
                      onChange={(event) =>
                        updateInvestment(index, { threshold: Number(event.target.value) })
                      }
                      aria-label={`Seuil du palier ${index + 1}`}
                    />
                    <select
                      value={investment.priority}
                      onChange={(event) =>
                        updateInvestment(index, {
                          priority: event.target.value as FormInvestment['priority'],
                        })
                      }
                      aria-label={`Priorité du palier ${index + 1}`}
                    >
                      <option value="required">Requis</option>
                      <option value="preferred">Préféré</option>
                    </select>
                    <input
                      value={investment.reason}
                      onChange={(event) => updateInvestment(index, { reason: event.target.value })}
                      placeholder="Pourquoi ce palier ?"
                      aria-label={`Explication du palier ${index + 1}`}
                      required
                    />
                    <button
                      type="button"
                      className="admin-icon-button"
                      onClick={() =>
                        setForm({
                          ...form,
                          investments: form.investments.filter(
                            (_, investmentIndex) => investmentIndex !== index,
                          ),
                        })
                      }
                      aria-label={`Supprimer le palier ${index + 1}`}
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
            {tactical && (
              <form className="admin-tactical" onSubmit={saveTactical}>
                <div className="admin-steps-heading">
                  <div>
                    <span className="admin-kicker">PROFIL TACTIQUE</span>
                    <p>
                      Un tag doit rester justifié par une capacité ou un effet versionné. Un profil
                      en brouillon ne déclenche aucune substitution publique.
                    </p>
                  </div>
                  <select
                    value={tacticalHeroId ?? ''}
                    onChange={(event) => {
                      const heroId = Number(event.target.value);
                      setTacticalHeroId(heroId);
                      const profile = tactical.profiles.find((item) => item.heroId === heroId);
                      setTacticalStatus(profile?.status ?? 'draft');
                      setTacticalDraft(toTacticalDraft(profile, tactical.tags));
                    }}
                    aria-label="Héros du profil tactique"
                  >
                    {tactical.profiles.map((profile) => (
                      <option key={profile.heroId} value={profile.heroId}>
                        {catalog?.heroes.find((hero) => hero.id === profile.heroId)?.name ??
                          `Héros ${profile.heroId}`}
                      </option>
                    ))}
                  </select>
                  <select
                    value={tacticalStatus}
                    onChange={(event) =>
                      setTacticalStatus(event.target.value as TacticalProfileStatus)
                    }
                    aria-label="Statut du profil tactique"
                  >
                    <option value="draft">Brouillon</option>
                    <option value="validated">Validé</option>
                    <option value="stale">À revoir</option>
                  </select>
                </div>
                <div className="admin-tactical-list">
                  {tactical.tags.map((definition) => {
                    const draft = tacticalDraft[definition.key];
                    if (!draft) return null;
                    return (
                      <fieldset key={definition.key} className="admin-tactical-row">
                        <label>
                          <input
                            type="checkbox"
                            checked={draft.enabled}
                            onChange={(event) =>
                              setTacticalDraft({
                                ...tacticalDraft,
                                [definition.key]: { ...draft, enabled: event.target.checked },
                              })
                            }
                          />
                          <span>
                            <strong>{definition.label}</strong>
                            <small>{definition.description}</small>
                          </span>
                        </label>
                        {draft.enabled && (
                          <>
                            <select
                              value={draft.intensity}
                              onChange={(event) =>
                                setTacticalDraft({
                                  ...tacticalDraft,
                                  [definition.key]: {
                                    ...draft,
                                    intensity: Number(event.target.value) as 1 | 2 | 3,
                                  },
                                })
                              }
                              aria-label={`Intensité ${definition.label}`}
                            >
                              <option value={1}>Faible</option>
                              <option value={2}>Moyenne</option>
                              <option value={3}>Forte</option>
                            </select>
                            <input
                              value={draft.evidence}
                              onChange={(event) =>
                                setTacticalDraft({
                                  ...tacticalDraft,
                                  [definition.key]: { ...draft, evidence: event.target.value },
                                })
                              }
                              placeholder="Justification et version"
                              aria-label={`Justification ${definition.label}`}
                              required
                            />
                          </>
                        )}
                      </fieldset>
                    );
                  })}
                </div>
                <button className="admin-primary save-button" disabled={tacticalSaving}>
                  {tacticalSaving ? <LoaderCircle className="spin" /> : <Save size={16} />}{' '}
                  Enregistrer le profil
                </button>
              </form>
            )}
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
