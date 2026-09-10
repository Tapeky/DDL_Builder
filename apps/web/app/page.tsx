'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  Catalog,
  Category,
  Hero,
  Recommendation,
  RecommendationRequest,
  Style,
} from '@deadlock/contracts';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleAlert,
  Copy,
  Crosshair,
  Layers3,
  LoaderCircle,
  Search,
  Shield,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';

const styles: { id: Style; label: string; description: string; icon: typeof Swords }[] = [
  {
    id: 'balanced',
    label: 'Équilibré',
    description: 'Une base polyvalente, du premier échange au dernier combat.',
    icon: Crosshair,
  },
  {
    id: 'damage',
    label: 'Dégâts',
    description: 'Mettez la pression et privilégiez votre potentiel offensif.',
    icon: Swords,
  },
  {
    id: 'survival',
    label: 'Survie',
    description: 'Restez dans le combat avec une approche plus résistante.',
    icon: Shield,
  },
];
const categories: Record<Category, string> = {
  weapon: 'Arme',
  vitality: 'Vitalité',
  spirit: 'Esprit',
};
const phases = [
  { id: 'early', title: 'Prendre position', label: 'Début de partie', number: '01' },
  { id: 'core', title: 'Trouver son rythme', label: 'Cœur du build', number: '02' },
  { id: 'late', title: 'Faire la différence', label: 'Fin de partie', number: '03' },
] as const;
const money = (value: number) => new Intl.NumberFormat('fr-FR').format(value);
const dateTime = (value: string | null) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'Europe/Paris',
      }).format(new Date(value))
    : 'indisponible';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new Error('Le service ne répond pas. Vérifiez votre connexion, puis réessayez.');
  }
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? 'Ce build est introuvable. Créez un nouveau plan de jeu.'
        : 'Le service est momentanément indisponible. Réessayez dans un instant.',
    );
  return response.json() as Promise<T>;
}

function HeroImage({
  hero,
  className = '',
  small = false,
}: {
  hero: Hero;
  className?: string;
  small?: boolean;
}) {
  const source = small ? hero.portrait || hero.image : hero.image || hero.portrait;
  return source ? (
    <img className={className} src={source} alt={hero.name} />
  ) : (
    <span className={`image-fallback ${className}`} aria-label={hero.name}>
      {hero.name.slice(0, 1)}
    </span>
  );
}

export default function Home() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const status = catalog?.status ?? null;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [heroId, setHeroId] = useState<number | null>(null);
  const [style, setStyle] = useState<Style>('balanced');
  const [heroSearch, setHeroSearch] = useState('');
  const [showAllHeroes, setShowAllHeroes] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [result, setResult] = useState<Recommendation | null>(null);
  const [busy, setBusy] = useState(false);
  const [buildError, setBuildError] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState('');

  const loadSaved = useCallback(async (id: string) => {
    setSavedId(id);
    setBusy(true);
    setBuildError('');
    try {
      const build = await request<Recommendation>(`/builds/${encodeURIComponent(id)}`);
      setResult(build);
      setHeroId(build.hero.id);
      setStyle(build.style);
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : 'Impossible de charger ce build.');
    } finally {
      setBusy(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await request<Catalog>('/catalog');
      setCatalog(data);
      setHeroId(data.heroes.find((hero) => hero.hasBuild)?.id ?? data.heroes[0]?.id ?? null);
      const id = new URLSearchParams(window.location.search).get('build');
      if (id) await loadSaved(id);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Impossible de charger le catalogue.');
    } finally {
      setLoading(false);
    }
  }, [loadSaved]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const selectedHero = catalog?.heroes.find((hero) => hero.id === heroId);
  const supportedHeroes = catalog?.heroes.filter((hero) => hero.hasBuild) ?? [];
  const visibleHeroes = (
    showAllHeroes || heroSearch ? (catalog?.heroes ?? []) : supportedHeroes
  ).filter((hero) => hero.name.toLowerCase().includes(heroSearch.toLowerCase()));
  const visibleItems =
    catalog?.items.filter(
      (item) =>
        (category === 'all' || item.category === category) &&
        item.name.toLowerCase().includes(itemSearch.toLowerCase()),
    ) ?? [];

  function selectHero(hero: Hero) {
    if (busy) return;
    setHeroId(hero.id);
    clearBuild();
  }

  function clearBuild() {
    setResult(null);
    setCopyState('');
    setBuildError('');
    setSavedId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('build');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  async function generate() {
    if (busy || !selectedHero?.hasBuild || status?.state === 'unavailable') return;
    setBusy(true);
    setBuildError('');
    setSavedId(null);
    setCopyState('');
    try {
      const payload: RecommendationRequest = {
        heroId: selectedHero.id,
        style,
        ...(status?.version ? { version: status.version } : {}),
      };
      const build = await request<Recommendation>('/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setResult(build);
      window.history.replaceState(null, '', `/?build=${encodeURIComponent(build.id)}#build`);
      setTimeout(
        () =>
          document.getElementById('resultat')?.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'instant'
              : 'smooth',
            block: 'start',
          }),
        60,
      );
    } catch (error) {
      setBuildError(error instanceof Error ? error.message : 'La génération a échoué.');
    } finally {
      setBusy(false);
    }
  }

  async function copyBuild() {
    if (!result) return;
    const url = new URL(result.sharePath, window.location.origin);
    url.protocol = window.location.protocol;
    url.host = window.location.host;
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopyState('Lien copié');
    } catch {
      setCopyState('Copie impossible. Le lien est affiché ci-dessous.');
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#accueil">
        Aller au contenu principal
      </a>
      <aside className="sidebar">
        <a className="brand" href="#accueil" aria-label="Deadlock Atelier, accueil">
          <span className="brand-mark">
            D<span>◆</span>
          </span>
          <span>
            DEADLOCK<small>ATELIER DE BUILDS</small>
          </span>
        </a>
        <div className="sidebar-rule">
          <span>LE GUIDE DE TERRAIN</span>
          <span>01</span>
        </div>
        <nav aria-label="Navigation principale">
          <a href="#heros">
            <Crosshair size={18} /> Les héros <span>01</span>
          </a>
          <a href="#build">
            <Layers3 size={18} /> Votre build <span>02</span>
          </a>
          <a href="#catalogue">
            <BookOpen size={18} /> L’arsenal <span>03</span>
          </a>
        </nav>
        <div className="sidebar-note">
          <span className="tiny-label">PRÉPARER. ADAPTER. JOUER.</span>
          <p>
            La victoire commence
            <br />
            avant la première âme.
          </p>
          <div className="ornament">◇</div>
          <p className="muted">
            Des plans de jeu pour trouver votre voie dans les rues de Deadlock.
          </p>
        </div>
        <div className="sidebar-bottom">
          <span className={`status-dot ${status?.state === 'ready' ? 'ready' : ''}`} />
          {status?.state === 'ready'
            ? 'Catalogue synchronisé'
            : status?.state === 'stale'
              ? 'Catalogue en cache'
              : 'Données du jeu'}
          <small>PROJET COMMUNAUTAIRE · INDÉPENDANT</small>
        </div>
      </aside>

      <main id="accueil">
        <header className="topbar">
          <span>LE SAVOIR EST UNE ARME.</span>
          <a href="https://deadlock-api.com" target="_blank" rel="noreferrer">
            Données Deadlock API <ArrowUpRight size={14} />
          </a>
        </header>
        <section className="intro">
          <div className="eyebrow">
            <span /> VOTRE PROCHAINE PARTIE COMMENCE ICI
          </div>
          <div className="intro-row">
            <h1>
              Chaque héros.
              <br />
              <em>Un plan de jeu.</em>
            </h1>
            <div className="intro-aside">
              <span className="compass">✦</span>
              <p>
                Moins d’hésitation à la boutique.
                <br />
                Plus d’intention sur le terrain.
              </p>
              <a href="#heros">
                Trouvez votre build <ArrowDown size={16} />
              </a>
            </div>
          </div>
          <div className="intro-bottom">
            <span>
              <Sparkles size={14} /> Conçu pour votre style de jeu
            </span>
            <span>
              ÉDITION COMMUNAUTAIRE <span className="mini-diamond">◆</span> FR
            </span>
          </div>
        </section>

        {loading && (
          <div className="state-panel" role="status">
            <LoaderCircle className="spin" /> Chargement du guide de terrain…
          </div>
        )}
        {loadError && (
          <div className="state-panel error" role="alert">
            <CircleAlert />
            <p>{loadError}</p>
            <button onClick={() => void loadCatalog()}>
              Réessayer <ArrowRight size={16} />
            </button>
          </div>
        )}
        {!loading && catalog && (
          <>
            {status && status.state !== 'ready' && (
              <div className="notice" role="status">
                <CircleAlert size={18} />
                <span>
                  {status.notice ||
                    'Les données ne sont pas à jour. Les recommandations peuvent être indisponibles.'}
                </span>
              </div>
            )}
            <section id="heros" className="heroes-section">
              <div className="section-heading">
                <div>
                  <span className="section-number">01 / CHOISIR SON HÉROS</span>
                  <h2>Qui entre dans l’arène ?</h2>
                </div>
                <button className="text-button" onClick={() => setShowAllHeroes(!showAllHeroes)}>
                  {showAllHeroes
                    ? 'Héros avec un build'
                    : `Tous les héros (${catalog.heroes.length})`}{' '}
                  <ArrowUpRight size={16} />
                </button>
              </div>
              {(showAllHeroes || heroSearch) && (
                <label className="search-field hero-search">
                  <Search size={17} />
                  <input
                    aria-label="Rechercher un héros"
                    placeholder="Rechercher un héros…"
                    value={heroSearch}
                    onChange={(event) => setHeroSearch(event.target.value)}
                  />
                </label>
              )}
              <div className={`hero-grid ${showAllHeroes || heroSearch ? 'expanded' : ''}`}>
                {visibleHeroes.map((hero, index) => (
                  <button
                    key={hero.id}
                    className={`hero-card hero-tone-${index % 5} ${heroId === hero.id ? 'selected' : ''}`}
                    disabled={busy}
                    onClick={() => selectHero(hero)}
                    aria-pressed={heroId === hero.id}
                  >
                    <span className="hero-card-number">{String(index + 1).padStart(2, '0')}</span>
                    <HeroImage hero={hero} />
                    <span className="hero-card-shade" />
                    <span className="hero-card-label">
                      <strong>{hero.name}</strong>
                      <small>{hero.hasBuild ? 'BUILD DISPONIBLE' : 'EXPLORER LE HÉROS'}</small>
                    </span>
                    <span className="hero-selection">
                      {heroId === hero.id ? <Check size={14} /> : <ArrowUpRight size={14} />}
                    </span>
                  </button>
                ))}
              </div>
              {visibleHeroes.length === 0 && (
                <p className="empty">Aucun héros ne correspond à votre recherche.</p>
              )}
              <p className="section-footnote">
                <span className="status-dot ready" /> {supportedHeroes.length} héros accompagnés
                d’un plan de jeu éditorial. Les autres restent à explorer.
              </p>
            </section>

            <section id="build" className="build-section">
              <div className="section-heading">
                <div>
                  <span className="section-number">02 / DESSINER SON PLAN</span>
                  <h2>Votre héros. Votre manière.</h2>
                </div>
                <span className="outline-tag">ATELIER</span>
              </div>
              <div className="builder">
                <div className="selected-hero">
                  {selectedHero && (
                    <>
                      <div className="selected-portrait">
                        <HeroImage hero={selectedHero} small />
                      </div>
                      <div>
                        <span className="tiny-label">HÉROS SÉLECTIONNÉ</span>
                        <h3>{selectedHero.name}</h3>
                        <p>{selectedHero.description}</p>
                        {!selectedHero.hasBuild && (
                          <span className="unsupported">
                            À découvrir · aucun build éditorial disponible
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="build-controls">
                  <span className="tiny-label">QUELLE EST VOTRE APPROCHE ?</span>
                  <div className="style-picker" aria-label="Style de jeu">
                    {styles.map((option) => (
                      <button
                        key={option.id}
                        aria-pressed={style === option.id}
                        className={style === option.id ? 'active' : ''}
                        disabled={busy}
                        onClick={() => {
                          setStyle(option.id);
                          clearBuild();
                        }}
                      >
                        <option.icon size={16} />
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="style-description">
                    {styles.find((option) => option.id === style)?.description}
                  </p>
                  <button
                    className="generate-button"
                    disabled={busy || !selectedHero?.hasBuild || status?.state === 'unavailable'}
                    onClick={() => void generate()}
                  >
                    {busy ? (
                      <>
                        <LoaderCircle size={18} className="spin" /> Préparation du build…
                      </>
                    ) : (
                      <>
                        Générer mon build <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                  <span className="build-caption">Un point de départ. À adapter en partie.</span>
                </div>
              </div>
              {buildError && (
                <div className="notice error" role="alert">
                  <CircleAlert size={18} />
                  <span>{buildError}</span>
                  <button
                    onClick={() => (savedId ? void loadSaved(savedId) : void generate())}
                    disabled={busy}
                  >
                    Réessayer
                  </button>
                </div>
              )}
              {result && (
                <div id="resultat" className="build-result">
                  <div className="result-heading">
                    <div>
                      <span className="section-number">
                        VOTRE FEUILLE DE ROUTE ·{' '}
                        {styles.find((option) => option.id === result.style)?.label}
                      </span>
                      <h3>
                        {result.hero.name} · {result.title}
                      </h3>
                      <p>{result.summary}</p>
                    </div>
                    <button className="share-button" onClick={() => void copyBuild()}>
                      <Copy size={16} /> {copyState === 'Lien copié' ? 'Lien copié' : 'Partager'}
                    </button>
                  </div>
                  <div className="notice">
                    <CircleAlert size={18} />
                    <span>
                      <strong>Brouillon éditorial.</strong> Ce build n’est ni validé, ni une
                      recommandation méta. Il ne repose pas sur des statistiques de performance.
                    </span>
                  </div>
                  {result.warnings.length > 0 && (
                    <ul className="warnings">
                      {result.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  )}
                  <div className="phases">
                    {phases.map((phase) => (
                      <div className="phase" key={phase.id}>
                        <div className="phase-heading">
                          <span>{phase.number}</span>
                          <div>
                            <small>{phase.label}</small>
                            <h4>{phase.title}</h4>
                          </div>
                        </div>
                        {result.steps
                          .filter((step) => step.phase === phase.id)
                          .sort((a, b) => a.order - b.order)
                          .map((step) => (
                            <div key={step.order} className={`build-item ${step.item.category}`}>
                              <div className="build-item-top">
                                {step.item.image ? (
                                  <img src={step.item.image} alt={step.item.name} />
                                ) : (
                                  <Layers3 size={32} />
                                )}
                                <div>
                                  <h5>{step.item.name}</h5>
                                  <span>{categories[step.item.category]}</span>
                                </div>
                                <strong className="cost">◈ {money(step.purchaseCost)}</strong>
                              </div>
                              <p>{step.reason}</p>
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                  <div className="result-footer">
                    <span>
                      Version du client <strong>{result.version}</strong>
                      <small className="import-time">
                        Import du build : {dateTime(result.importedAt)} (Paris)
                      </small>
                    </span>
                    <span>
                      Coût d’achat total{' '}
                      <strong className="cost">◈ {money(result.totalCost)} âmes</strong>
                    </span>
                  </div>
                  <div role="status" className="copy-status">
                    {copyState}
                    {copyState.startsWith('Copie impossible') && (
                      <input
                        aria-label="Lien de partage"
                        readOnly
                        value={new URL(result.sharePath, window.location.origin).toString()}
                        onFocus={(event) => event.target.select()}
                      />
                    )}
                  </div>
                </div>
              )}
            </section>

            <section id="catalogue" className="catalog-section">
              <div className="section-heading">
                <div>
                  <span className="section-number">03 / CONNAÎTRE SON ÉQUIPEMENT</span>
                  <h2>Un regard sur l’arsenal.</h2>
                </div>
                <span className="catalog-count">{catalog.items.length} OBJETS</span>
              </div>
              <div className="catalog-toolbar">
                <div className="category-picker" aria-label="Filtrer les objets par catégorie">
                  {(['all', 'weapon', 'vitality', 'spirit'] as const).map((value) => (
                    <button
                      key={value}
                      className={`${value} ${category === value ? 'active' : ''}`}
                      aria-pressed={category === value}
                      onClick={() => setCategory(value)}
                    >
                      {value === 'all' ? 'Tous les objets' : categories[value]}
                    </button>
                  ))}
                </div>
                <label className="search-field">
                  <Search size={16} />
                  <input
                    aria-label="Rechercher un objet"
                    placeholder="Rechercher un objet…"
                    value={itemSearch}
                    onChange={(event) => setItemSearch(event.target.value)}
                  />
                </label>
              </div>
              <div className="item-grid">
                {visibleItems.map((item) => (
                  <details className={`catalog-item ${item.category}`} key={item.id}>
                    <summary>
                      {item.image ? <img src={item.image} alt="" /> : <Zap size={30} />}
                      <span className="item-info">
                        <strong>{item.name}</strong>
                        <small>
                          {categories[item.category]} <span>·</span> Niveau {item.tier}
                        </small>
                      </span>
                      <span className="cost">◈ {money(item.cost)}</span>
                      <ChevronRight className="item-chevron" size={14} />
                    </summary>
                    <p>
                      {item.description || 'Aucune description disponible dans les données source.'}
                    </p>
                    {item.components.length > 0 && (
                      <p className="components">
                        Composants :{' '}
                        {item.components
                          .map(
                            (id) =>
                              catalog.items.find((component) => component.id === id)?.name ??
                              `Objet ${id}`,
                          )
                          .join(', ')}
                      </p>
                    )}
                  </details>
                ))}
              </div>
              {visibleItems.length === 0 && (
                <p className="empty">
                  Aucun objet trouvé. Essayez un autre nom ou une autre catégorie.
                </p>
              )}
              <p className="section-footnote">
                {visibleItems.length} objets affichés · Ouvrez un objet pour consulter sa
                description.
              </p>
            </section>
          </>
        )}

        <footer>
          <div>
            <a className="footer-brand" href="#accueil">
              DEADLOCK <span>/ ATELIER</span>
            </a>
            <p>Un guide indépendant, pas une promesse de victoire.</p>
          </div>
          <div>
            <p>Version du client : {status?.version ?? 'indisponible'}</p>
            <p>Dernière vérification : {dateTime(status?.checkedAt ?? null)} (Paris)</p>
            <p>Import du catalogue : {dateTime(status?.importedAt ?? null)} (Paris)</p>
            <p>
              Données :{' '}
              <a href="https://deadlock-api.com" target="_blank" rel="noreferrer">
                Deadlock API <ArrowUpRight size={11} />
              </a>{' '}
              · Visuels © Valve
            </p>
            <p>Projet non affilié à Valve. Deadlock est une marque de Valve.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
