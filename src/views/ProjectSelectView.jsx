import { useEffect, useMemo, useState } from 'react';
import { useLethem } from '../contexts/LethemContext';
import { useAuth } from '../contexts/AuthContext';
import { LogoIcon } from '../components/parts/Logo';
import { cacheGet, cacheSet } from '../lib/cache';
import { IconBell, IconBilling, IconCheck, IconDemo, IconExternal, IconLogs, IconPlus, IconSearch, IconSettings, IconSubkey, IconTrash, IconUser } from '../components/parts/Icons';

export default function ProjectSelectView({ go }) {
  const {
    projects, projectSearch, setProjectSearch,
    filteredProjects, showPlanBanner, setShowPlanBanner,
    projectToDelete, setProjectToDelete,
    deleteConfirm, setDeleteConfirm, deleteProject,
    notif, notify,
    ctx: { API, fmtDate, fmtNum, billing, subkeys, masterKeys, analytics },
  } = useLethem();
  const { user, logout, getAccessToken, isAuthenticated } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [accountUsage, setAccountUsage] = useState({ subkeys: 0, masterKeys: 0, tokens: 0, requests: 0, loading: false });

  const currentPlan = billing?.plans?.find((plan) => plan.id === billing.currentPlan) || billing?.plans?.find((plan) => plan.id === 'free');
  const limits = currentPlan?.limits || {};
  const projectLimit = limits.projects ?? 3;
  const subkeyLimit = limits.subkeys ?? 20;
  const tokenLimit = limits.tokens ?? 2000000;
  const projectLimitLabel = projectLimit == null ? 'Unlimited' : projectLimit;
  const subkeyLimitLabel = subkeyLimit == null ? 'Unlimited' : subkeyLimit;
  const tokenLimitLabel = tokenLimit == null ? 'Unlimited' : fmtNum(tokenLimit);
  const activeProjectSlug = projects[0]?.slug || projects[0]?.id || '';
  const goProjectPage = (page) => activeProjectSlug ? go(`/console/${activeProjectSlug}/${page}`) : go('/console/new');
  const displayedSubkeys = Math.max(accountUsage.subkeys, subkeys.length);
  const displayedMasterKeys = Math.max(accountUsage.masterKeys, masterKeys.length);
  const tokenUsage = Math.max(accountUsage.tokens, analytics?.totalTokens || 0);
  const requestCount = Math.max(accountUsage.requests, analytics?.totalRequests || 0, analytics?.logs?.length || 0);
  const isAtProjectLimit = projectLimit != null && projects.length >= projectLimit;
  const userLabel = user?.email || user?.name || 'obito@keygate.dev';
  const avatar = userLabel.charAt(0).toUpperCase();



  useEffect(() => {
    const fallbackUsage = {
      subkeys: subkeys.length,
      masterKeys: masterKeys.length,
      tokens: analytics?.totalTokens || 0,
      requests: analytics?.totalRequests || analytics?.logs?.length || 0,
    };

    if (!projects.length || !isAuthenticated) {
      setAccountUsage((current) => ({ ...current, ...fallbackUsage }));
      return undefined;
    }

    const cacheScope = user?.sub || 'anonymous';
    const summaryKey = (project) => `/console-page/project/${project.slug || project.id}/summary`;
    const cachedSummaries = projects.map((project) => cacheGet(summaryKey(project), cacheScope));
    const cachedTotal = cachedSummaries.reduce((totals, summary) => {
      if (!summary) return totals;
      totals.subkeys += Number(summary.subkeys || 0);
      totals.masterKeys += Number(summary.masterKeys || 0);
      totals.tokens += Number(summary.tokens || 0);
      totals.requests += Number(summary.requests || 0);
      return totals;
    }, { subkeys: 0, masterKeys: 0, tokens: 0, requests: 0 });

    if (cachedSummaries.every(Boolean)) {
      setAccountUsage({ ...cachedTotal, loading: false });
      return undefined;
    }

    if (cachedSummaries.some(Boolean)) setAccountUsage({ ...cachedTotal, loading: true });
    else setAccountUsage((current) => ({ ...current, loading: true }));

    let cancelled = false;

    const fetchProjectJson = async (project, path) => {
      const token = await getAccessToken();
      const projectId = project.slug || project.id;
      const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}`, 'x-project-id': projectId } });
      if (!res.ok) return null;
      return res.json().catch(() => null);
    };

    Promise.allSettled(projects.map(async (project, index) => {
      const cached = cachedSummaries[index];
      if (cached) return cached;

      const [projectSubkeys, projectMasterKeys, projectAnalytics] = await Promise.all([
        fetchProjectJson(project, '/api/subkeys'),
        fetchProjectJson(project, '/api/master-keys'),
        fetchProjectJson(project, '/api/analytics'),
      ]);
      const logs = projectAnalytics?.logs || [];
      const summary = {
        subkeys: Array.isArray(projectSubkeys) ? projectSubkeys.length : 0,
        masterKeys: Array.isArray(projectMasterKeys) ? projectMasterKeys.length : 0,
        tokens: Number(projectAnalytics?.totalTokens || logs.reduce((sum, log) => sum + Number(log.tokens || log.total_tokens || 0), 0)),
        requests: Number(projectAnalytics?.totalRequests || logs.length || 0),
      };
      cacheSet(summaryKey(project), summary, cacheScope);
      return summary;
    }))
      .then((results) => {
        if (cancelled) return;
        const next = results.reduce((totals, result) => {
          if (result.status !== 'fulfilled') return totals;
          totals.subkeys += Number(result.value.subkeys || 0);
          totals.masterKeys += Number(result.value.masterKeys || 0);
          totals.tokens += Number(result.value.tokens || 0);
          totals.requests += Number(result.value.requests || 0);
          return totals;
        }, { subkeys: 0, masterKeys: 0, tokens: 0, requests: 0 });
        setAccountUsage({ ...next, loading: false });
      })
      .catch(() => {
        if (!cancelled) setAccountUsage((current) => ({ ...current, ...fallbackUsage, loading: false }));
      });

    return () => { cancelled = true; };
  }, [API, analytics?.logs, analytics?.totalRequests, analytics?.totalTokens, getAccessToken, isAuthenticated, masterKeys.length, projects, subkeys.length, user?.sub]);

  const expectedDeleteText = projectToDelete ? `delete ${projectToDelete.slug}` : '';
  const canDeleteProject = projectToDelete && deleteConfirm.trim() === expectedDeleteText;

  const onboardingSteps = useMemo(() => [
    { label: 'Create account', done: true },
    { label: 'Create first project', done: projects.length > 0 },
    { label: 'Add provider API key', done: displayedMasterKeys > 0, onClick: () => goProjectPage('masterkeys') },
    { label: 'Create first subkey', done: displayedSubkeys > 0, onClick: () => goProjectPage('subkeys') },
    { label: 'Make first API request', done: requestCount > 0, onClick: () => goProjectPage('demo') },
  ], [displayedMasterKeys, displayedSubkeys, projects.length, requestCount, activeProjectSlug]);
  const completedSteps = onboardingSteps.filter((step) => step.done).length;
  const onboardingPercent = (completedSteps / onboardingSteps.length) * 100;

  const usageCards = [
    { label: 'Projects', value: `${projects.length} / ${projectLimitLabel}`, icon: '▣' },
    { label: 'Subkeys', value: `${fmtNum(displayedSubkeys)} / ${subkeyLimitLabel}`, icon: '⌘' },
    { label: 'Token usage', value: `${fmtNum(tokenUsage)} / ${tokenLimitLabel}`, icon: '↯' },
    { label: 'Current plan', value: currentPlan?.name || 'Free', icon: '▭' },
  ];
  const planMeters = [
    { label: 'Projects', used: projects.length, limit: projectLimit },
    { label: 'Subkeys', used: displayedSubkeys, limit: subkeyLimit },
    { label: 'Tokens', used: tokenUsage, limit: tokenLimit },
  ];

  const handleDelete = async () => {
    if (!canDeleteProject || !projectToDelete) return;
    try {
      const ps = await deleteProject();
      if (!ps.length) go('/console/new'); else go('/console');
    } catch (e) {
      notify(e.message || 'Failed to delete project', 'error');
    }
  };

  return (
    <div className='page active console-select-page'>
      <nav className='project-console-nav'>
        <div className='project-console-brand'><span><LogoIcon size={18} /></span><div><strong>KeyGate</strong><small>Projects Console</small></div></div>
        <div className='project-console-nav-actions'>
          <button className='project-console-icon-btn' type='button' aria-label='Notifications' onClick={() => goProjectPage('notifications')}><IconBell /></button>
          <div className='project-console-user-wrap'>
            <button className='project-console-user' type='button' aria-haspopup='menu' aria-expanded={userMenuOpen} onClick={() => setUserMenuOpen((open) => !open)}><span>{avatar}</span>{userLabel}</button>
            {userMenuOpen && <div className='project-console-user-menu' role='menu'>
              <button type='button' role='menuitem' onClick={() => { setUserMenuOpen(false); go('/console/profile'); }}><IconUser /> Profile</button>
              <button type='button' role='menuitem' onClick={() => { setUserMenuOpen(false); go('/console/workspace'); }}><IconSettings /> Workspace Settings</button>
              <button type='button' role='menuitem' onClick={() => { setUserMenuOpen(false); go('/console/subscription'); }}><IconBilling /> Billing</button>
              <button type='button' role='menuitem' onClick={() => { setUserMenuOpen(false); go('/console/docs'); }}><IconLogs /> Documentation</button>
              <button type='button' role='menuitem' className='danger' onClick={() => { setUserMenuOpen(false); logout(); }}>Logout</button>
            </div>}
          </div>
        </div>
      </nav>

      <div className='console-select-content'>
        <header className='console-landing-header project-console-hero'>
          <div>
            <h1>Projects Console</h1>
            <p>Create, switch, and manage isolated workspaces</p>
          </div>
          <div className='console-top-bar'>
            <div className='console-plan-badge'>
              <span className='console-plan-dot' /> {currentPlan?.name || 'Free'} plan <span>{projects.length} / {projectLimitLabel} projects</span>
            </div>
            <button className='btn btn-ghost console-create-btn project-console-manage-btn' onClick={() => go('/console/subscription')}>Manage subscription</button>
            <button className='btn btn-primary console-create-btn' disabled={isAtProjectLimit} onClick={() => go('/console/new')}>+ New project</button>
          </div>
        </header>

        <section className='project-console-stats'>
          {usageCards.map((card) => <div className='project-console-stat' key={card.label}><div><span>{card.label}</span><strong>{card.value}</strong></div><i>{card.icon}</i></div>)}
        </section>

        <section className='project-console-onboarding card'>
          <div className='project-console-section-head'><div><strong>✣ Getting Started</strong><span>Complete these steps to get your API gateway running</span></div><b>{completedSteps}/{onboardingSteps.length}<small>Completed</small></b></div>
          <div className='project-console-progress'><span style={{ width: `${onboardingPercent}%` }} /></div>
          <div className='project-console-steps'>{onboardingSteps.map((step) => { const StepTag = step.onClick ? 'button' : 'div'; return <StepTag type={step.onClick ? 'button' : undefined} className={`${step.done ? 'done' : ''} ${step.onClick ? 'clickable' : 'locked'}`} onClick={step.onClick} key={step.label}><IconCheck />{step.label}</StepTag>; })}</div>
        </section>

        <section className='project-console-actions-wrap'>
          <h2>Quick Actions</h2>
          <div className='project-console-actions'>
            <button onClick={() => go('/console/new')}><IconPlus /><span><strong>Create Project</strong><small>Get started</small></span><IconExternal /></button>
            <button onClick={() => goProjectPage('masterkeys')}><IconCheck /><span><strong>Add Provider</strong><small>{displayedMasterKeys > 0 ? 'Completed' : 'Get started'}</small></span><IconExternal /></button>
            <button onClick={() => goProjectPage('subkeys')}><IconSubkey /><span><strong>Create Subkey</strong><small>{displayedSubkeys > 0 ? 'Completed' : 'Get started'}</small></span><IconExternal /></button>
            <button onClick={() => goProjectPage('demo')}><IconDemo /><span><strong>Open Live Demo</strong><small>{requestCount > 0 ? 'Completed' : 'Get started'}</small></span><IconExternal /></button>
          </div>
        </section>

        <section className='project-console-plan card'>
          <button className='btn btn-ghost btn-sm' onClick={() => go('/console/subscription')}>Upgrade →</button>
          <div className='card-title'>Plan Usage</div><div className='card-sub'>Resource consumption across your {currentPlan?.name || 'Free'} plan</div>
          <div className='project-console-meters'>{planMeters.map((meter) => { const pct = meter.limit ? Math.min(100, (meter.used / meter.limit) * 100) : 0; return <div key={meter.label}><p><strong>{meter.label}</strong><span>{fmtNum(meter.used)} / {meter.limit == null ? 'Unlimited' : fmtNum(meter.limit)}</span></p><div><span style={{ width: `${pct}%` }} /></div><small>{meter.limit ? `${Math.round(pct)}% used` : 'No fixed limit'}</small></div>; })}</div>
        </section>

        <div className={`card projects-banner console-info-banner ${showPlanBanner ? '' : 'hidden'}`}>
          <div className='console-banner-text'>Your {currentPlan?.name || 'Free'} plan includes {projectLimitLabel} projects and plan-based resources.</div>
          <button className='btn btn-ghost btn-sm console-banner-link' onClick={() => go('/console/subscription')}>Upgrade to Pro</button>
          <button className='banner-close' onClick={() => setShowPlanBanner(false)} aria-label='Close banner'>✕</button>
        </div>

        <div className='project-console-projects-head'><h2>Your Projects <span>{projects.length} / {projectLimitLabel}</span></h2><div className='project-console-search'><IconSearch /><input className='projects-search console-search-input' value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} placeholder='Search by name, label, or ID' /></div></div>

        <div className='projects-grid console-projects-grid'>
          {filteredProjects.map((p) => (
            <button key={p.id} className='card project-card console-project-card' onClick={() => go(`/console/${p.slug}/overview`)}>
              <div className='console-project-card-header'><h3>{p.name}</h3><span className={`badge ${p.status === 'active' ? 'active' : 'paused'}`}>• {p.status}</span></div>
              <div className='console-project-card-body'><div className='console-project-id'>{p.slug}</div><div className='console-project-date'>Created {fmtDate(p.created_at)}</div></div>
              <div className='console-project-card-footer'><span /><span className='project-delete console-project-delete' onClick={(e) => { e.stopPropagation(); setProjectToDelete(p); setDeleteConfirm(''); }}><IconTrash /></span></div>
            </button>
          ))}
        </div>

        <div className={`modal-backdrop ${projectToDelete ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setProjectToDelete(null)}>
          <div className='modal'>
            <div className='modal-title'>Delete project</div>
            <div className='danger-box'>This action is irreversible. All data related to this project will be deleted and issued keys will stop working.</div>
            <div className='field' style={{ marginTop: 12 }}><label>Type "{expectedDeleteText}" to continue</label><input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder='delete project-xxxx' /></div>
            <div className='modal-footer'><button className='btn btn-ghost' onClick={() => setProjectToDelete(null)}>Cancel</button><button className='btn btn-danger' disabled={!canDeleteProject} onClick={handleDelete}>Delete project permanently</button></div>
          </div>
        </div>
        <div className={`notif ${notif.show ? 'show' : ''} ${notif.type}`}>{notif.msg}</div>
      </div>
    </div>
  );
}
