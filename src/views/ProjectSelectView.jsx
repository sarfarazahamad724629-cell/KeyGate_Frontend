import { useMemo } from 'react';
import { useLethem } from '../contexts/LethemContext';
import { useAuth } from '../contexts/AuthContext';
import { LogoIcon } from '../components/parts/Logo';
import { IconBell, IconCheck, IconDemo, IconExternal, IconMasterKey, IconPlus, IconSearch, IconSubkey, IconTrash } from '../components/parts/Icons';

export default function ProjectSelectView({ go }) {
  const {
    projects, projectSearch, setProjectSearch,
    filteredProjects, showPlanBanner, setShowPlanBanner,
    projectToDelete, setProjectToDelete,
    deleteConfirm, setDeleteConfirm, deleteProject,
    notif, notify,
    ctx: { fmtDate, fmtNum, billing, subkeys, masterKeys, analytics },
  } = useLethem();
  const { user } = useAuth();

  const currentPlan = billing?.plans?.find((plan) => plan.id === billing.currentPlan) || billing?.plans?.find((plan) => plan.id === 'free');
  const limits = currentPlan?.limits || {};
  const projectLimit = limits.projects ?? 3;
  const subkeyLimit = limits.subkeys ?? 3;
  const tokenLimit = limits.tokens ?? 50000;
  const projectLimitLabel = projectLimit == null ? 'Unlimited' : projectLimit;
  const subkeyLimitLabel = subkeyLimit == null ? 'Unlimited' : subkeyLimit;
  const tokenLimitLabel = tokenLimit == null ? 'Unlimited' : fmtNum(tokenLimit);
  const tokenUsage = analytics?.totalTokens || 0;
  const isAtProjectLimit = projectLimit != null && projects.length >= projectLimit;
  const userLabel = user?.email || user?.name || 'obito@keygate.dev';
  const avatar = userLabel.charAt(0).toUpperCase();

  const expectedDeleteText = projectToDelete ? `delete ${projectToDelete.slug}` : '';
  const canDeleteProject = projectToDelete && deleteConfirm.trim() === expectedDeleteText;

  const onboardingSteps = useMemo(() => [
    { label: 'Create account', done: true },
    { label: 'Create first project', done: projects.length > 0 },
    { label: 'Add provider API key', done: masterKeys.length > 0 },
    { label: 'Create first subkey', done: subkeys.length > 0 },
    { label: 'Make first API request', done: tokenUsage > 0 },
  ], [masterKeys.length, projects.length, subkeys.length, tokenUsage]);
  const completedSteps = onboardingSteps.filter((step) => step.done).length;
  const onboardingPercent = (completedSteps / onboardingSteps.length) * 100;

  const usageCards = [
    { label: 'Projects', value: `${projects.length} / ${projectLimitLabel}`, icon: '▣' },
    { label: 'Subkeys', value: `${subkeys.length} / ${subkeyLimitLabel}`, icon: '⌘' },
    { label: 'Token usage', value: `${fmtNum(tokenUsage)} / ${tokenLimitLabel}`, icon: '↯' },
    { label: 'Current plan', value: currentPlan?.name || 'Free', icon: '▭' },
  ];
  const planMeters = [
    { label: 'Projects', used: projects.length, limit: projectLimit },
    { label: 'Subkeys', used: subkeys.length, limit: subkeyLimit },
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
          <button className='project-console-icon-btn' type='button' aria-label='Notifications'><IconBell /></button>
          <div className='project-console-user'><span>{avatar}</span>{userLabel}</div>
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
            <button className='btn btn-ghost console-create-btn' onClick={() => go('/console/subscription')}>Manage subscription</button>
            <button className='btn btn-primary console-create-btn' disabled={isAtProjectLimit} onClick={() => go('/console/new')}>+ New project</button>
          </div>
        </header>

        <section className='project-console-stats'>
          {usageCards.map((card) => <div className='project-console-stat' key={card.label}><div><span>{card.label}</span><strong>{card.value}</strong></div><i>{card.icon}</i></div>)}
        </section>

        <section className='project-console-onboarding card'>
          <div className='project-console-section-head'><div><strong>✣ Getting Started</strong><span>Complete these steps to get your API gateway running</span></div><b>{completedSteps}/{onboardingSteps.length}<small>Completed</small></b></div>
          <div className='project-console-progress'><span style={{ width: `${onboardingPercent}%` }} /></div>
          <div className='project-console-steps'>{onboardingSteps.map((step) => <div className={step.done ? 'done' : ''} key={step.label}><IconCheck />{step.label}</div>)}</div>
        </section>

        <section className='project-console-actions-wrap'>
          <h2>Quick Actions</h2>
          <div className='project-console-actions'>
            <button onClick={() => go('/console/new')}><IconPlus /><span><strong>Create Project</strong><small>Get started</small></span><IconExternal /></button>
            <button onClick={() => go(projects[0] ? `/console/${projects[0].slug}/masterkeys` : '/console/new')}><IconMasterKey /><span><strong>Add Provider</strong><small>Get started</small></span><IconExternal /></button>
            <button onClick={() => go(projects[0] ? `/console/${projects[0].slug}/subkeys` : '/console/new')}><IconSubkey /><span><strong>Create Subkey</strong><small>Get started</small></span><IconExternal /></button>
            <button onClick={() => go(projects[0] ? `/console/${projects[0].slug}/demo` : '/console/new')}><IconDemo /><span><strong>Open Live Demo</strong><small>Get started</small></span><IconExternal /></button>
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
