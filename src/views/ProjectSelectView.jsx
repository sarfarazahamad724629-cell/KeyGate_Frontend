import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLethem } from '../contexts/LethemContext';
import { LogoIcon } from '../components/parts/Logo';

const ACTION_ICONS = {
  project: '+',
  provider: '🛡',
  key: '🔑',
  demo: '▶',
};

export default function ProjectSelectView({ go }) {
  const { user, logout } = useAuth();
  const {
    projects, projectSearch, setProjectSearch,
    filteredProjects, showPlanBanner, setShowPlanBanner,
    projectToDelete, setProjectToDelete,
    deleteConfirm, setDeleteConfirm, deleteProject,
    notif, notify,
    ctx: { fmtDate, fmtNum, quotaColor, billing, analytics, subkeys, masterKeys },
  } = useLethem();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 64, right: 24 });
  const userMenuBtn = useRef(null);
  const userMenuPanel = useRef(null);

  const currentPlan = billing?.plans?.find((plan) => plan.id === billing.currentPlan) || billing?.plans?.find((plan) => plan.id === 'free');
  const projectLimit = currentPlan?.limits?.projects ?? 3;
  const projectLimitLabel = projectLimit == null ? 'Unlimited' : projectLimit;
  const subkeyLimit = currentPlan?.limits?.subkeys ?? 3;
  const subkeyLimitLabel = subkeyLimit == null ? 'Unlimited' : subkeyLimit;
  const tokenLimit = currentPlan?.limits?.tokens ?? 50000;
  const tokenLimitLabel = tokenLimit == null ? 'Unlimited' : fmtNum(tokenLimit);
  const isAtProjectLimit = projectLimit != null && projects.length >= projectLimit;
  const firstProject = projects[0];

  const quickActions = [
    { label: 'Create Project', icon: ACTION_ICONS.project, path: '/console/new', primary: true, disabled: isAtProjectLimit },
    { label: 'Add Provider', icon: ACTION_ICONS.provider, path: firstProject ? `/console/${firstProject.slug}/masterkeys` : '/console/new' },
    { label: 'Create Subkey', icon: ACTION_ICONS.key, path: firstProject ? `/console/${firstProject.slug}/subkeys` : '/console/new' },
    { label: 'Open Live Demo', icon: ACTION_ICONS.demo, path: firstProject ? `/console/${firstProject.slug}/demo` : '/console/new' },
  ];

  const checklist = [
    { label: 'Create account', done: true },
    { label: 'Create first project', done: projects.length > 0 },
    { label: 'Add provider API key', done: masterKeys.length > 0 },
    { label: 'Create first subkey', done: subkeys.length > 0 },
    { label: 'Make first API request', done: analytics.totalRequests > 0 },
  ];
  const completedCount = checklist.filter((item) => item.done).length;
  const checklistPct = Math.round((completedCount / checklist.length) * 100);

  const expectedDeleteText = projectToDelete ? `delete ${projectToDelete.slug}` : '';
  const canDeleteProject = projectToDelete && deleteConfirm.trim() === expectedDeleteText;

  const handleDelete = async () => {
    if (!canDeleteProject || !projectToDelete) return;
    try {
      const ps = await deleteProject();
      if (!ps.length) go('/console/new'); else go('/console');
    } catch (e) {
      notify(e.message || 'Failed to delete project', 'error');
    }
  };

  const displayUser = user || {};
  const avatar = (displayUser.email || displayUser.name || 'K').charAt(0).toUpperCase();
  const userLabel = displayUser.email || displayUser.name || 'Signed in';

  const updateMenuPos = () => {
    const rect = userMenuBtn.current?.getBoundingClientRect();
    if (!rect) return;
    setMenuPos({ top: Math.round(rect.bottom + 10), right: Math.max(12, Math.round(window.innerWidth - rect.right)) });
  };

  useLayoutEffect(() => { if (userMenuOpen) updateMenuPos(); }, [userMenuOpen, userLabel]);

  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const onDown = (e) => {
      if (userMenuBtn.current?.contains(e.target) || userMenuPanel.current?.contains(e.target)) return;
      setUserMenuOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setUserMenuOpen(false);
    const onViewport = () => updateMenuPos();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', onViewport, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', onViewport, true);
    };
  }, [userMenuOpen]);

  const goAccount = (target) => {
    setUserMenuOpen(false);
    go(`/console/${target}`);
  };

  const userMenuPanelEl = userMenuOpen ? createPortal(
    <div ref={userMenuPanel} className='user-menu-panel-overlay open' style={{ top: `${menuPos.top}px`, right: `${menuPos.right}px` }} role='menu'>
      <div className='user-menu-identity'>
        <div>{displayUser.name || 'KeyGate user'}</div>
        <span>{displayUser.email || 'Signed in'}</span>
      </div>
      <button type='button' role='menuitem' onClick={() => goAccount('profile')}>👤 Profile</button>
      <button type='button' role='menuitem' onClick={() => goAccount('workspace')}>⚙ Workspace Settings</button>
      <button type='button' role='menuitem' onClick={() => goAccount('subscription')}>💳 Billing</button>
      <button type='button' role='menuitem' onClick={() => goAccount('docs')}>📘 Documentation</button>
      <div className='user-menu-separator' />
      <button type='button' role='menuitem' className='danger' onClick={() => { setUserMenuOpen(false); logout(); }}>↩ Logout</button>
    </div>,
    document.body,
  ) : null;

  return (
    <div className='page active console-select-page console-select-rich'>
      <header className='project-select-topbar'>
        <div className='project-select-brand'><LogoIcon size={18} /><div><strong>KeyGate</strong><span>Projects Console</span></div></div>
        <div className='project-select-actions'>
          <button className='project-bell' type='button' aria-label='Notifications'>🔔</button>
          <button ref={userMenuBtn} className='project-user-pill' type='button' aria-haspopup='menu' aria-expanded={userMenuOpen} onClick={() => setUserMenuOpen((open) => !open)}>
            <span>{displayUser.picture ? <img src={displayUser.picture} alt='' /> : avatar}</span><strong>{userLabel}</strong>
          </button>
        </div>
      </header>
      {userMenuPanelEl}

      <main className='console-select-content'>
        <section className='console-landing-header project-select-hero'>
          <div>
            <h1>Projects Console</h1>
            <p>Create, switch, and manage isolated workspaces</p>
          </div>
          <div className='console-top-bar'>
            <div className='console-plan-badge'><span className='console-plan-dot' /> {currentPlan?.name || 'Free'} plan <span>{projects.length} / {projectLimitLabel} projects</span></div>
            <button className='btn btn-ghost console-create-btn' onClick={() => go('/console/subscription')}>Manage subscription</button>
            <button className='btn btn-primary console-create-btn' disabled={isAtProjectLimit} onClick={() => go('/console/new')}>+ New project</button>
          </div>
        </section>

        <section className='project-usage-grid'>
          <UsageCard icon='▦' label='Projects' value={`${projects.length} / ${projectLimitLabel}`} accent='accent' />
          <UsageCard icon='🔑' label='Subkeys' value={`${subkeys.length} / ${subkeyLimitLabel}`} accent='blue' />
          <UsageCard icon='⚡' label='Token Usage' value={`${fmtNum(analytics.totalTokens)} / ${tokenLimitLabel}`} accent='green' />
          <UsageCard icon='💳' label='Current Plan' value={currentPlan?.name || 'Free'} accent='amber' />
        </section>

        <section className='card getting-started-card'>
          <div className='card-header'><div><div className='card-title'>✨ Getting Started</div><div className='card-sub'>Complete these steps to get your API gateway running</div></div><div className='checklist-count'>{completedCount}<span>/{checklist.length}</span><small>completed</small></div></div>
          <div className='checklist-progress'><span style={{ width: `${checklistPct}%` }} /></div>
          <div className='checklist-grid'>{checklist.map((item) => <div key={item.label} className={`checklist-item ${item.done ? 'done' : ''}`}><span>{item.done ? '✓' : '○'}</span>{item.label}</div>)}</div>
        </section>

        <section className='quick-actions-section'>
          <div className='section-heading'><h2>Quick Actions</h2><span /></div>
          <div className='quick-actions-grid'>{quickActions.map((action) => <button key={action.label} disabled={action.disabled} onClick={() => go(action.path)} className={`quick-action-card ${action.primary ? 'primary' : ''}`}><span className='quick-action-icon'>{action.icon}</span><span><strong>{action.label}</strong><small>Get started</small></span><em>↗</em></button>)}</div>
        </section>

        <section className='card plan-usage-card'>
          <div className='card-header'><div><div className='card-title'>Plan Usage</div><div className='card-sub'>Resource consumption across your {currentPlan?.name || 'Free'} plan</div></div><button className='btn btn-ghost btn-sm' onClick={() => go('/console/subscription')}>Upgrade →</button></div>
          <div className='usage-bars-grid'><UsageBar label='Projects' used={projects.length} limit={projectLimit} quotaColor={quotaColor} /><UsageBar label='Subkeys' used={subkeys.length} limit={subkeyLimit} quotaColor={quotaColor} /><UsageBar label='Tokens' used={analytics.totalTokens} limit={tokenLimit} formatNum fmtNum={fmtNum} quotaColor={quotaColor} /></div>
        </section>

        <div className={`card projects-banner console-info-banner ${showPlanBanner ? '' : 'hidden'}`}>
          <div className='console-banner-text'>Your {currentPlan?.name || 'Free'} plan includes {projectLimitLabel} projects and plan-based resources.</div>
          <button className='btn btn-ghost btn-sm console-banner-link' onClick={() => go('/console/subscription')}>Upgrade to Pro</button>
          <button className='banner-close' onClick={() => setShowPlanBanner(false)} aria-label='Close banner'>✕</button>
        </div>

        <section className='project-list-section'>
          <div className='project-list-header'><div className='section-heading'><h2>Your Projects</h2><b>{projects.length} / {projectLimitLabel}</b></div><div className='search-wrap'><span>⌕</span><input className='projects-search console-search-input' value={projectSearch} onChange={(e) => setProjectSearch(e.target.value)} placeholder='Search by name, label, or ID' /></div></div>
          {filteredProjects.length === 0 ? <EmptyProjects go={go} /> : <div className='projects-grid console-projects-grid'>{filteredProjects.map((p) => <ProjectCard key={p.id} project={p} fmtDate={fmtDate} go={go} onDelete={() => { setProjectToDelete(p); setDeleteConfirm(''); }} />)}</div>}
        </section>

        <div className={`modal-backdrop ${projectToDelete ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && setProjectToDelete(null)}>
          <div className='modal'>
            <div className='modal-title'>Delete project</div>
            <div className='danger-box'>⚠ This action is irreversible. All data related to this project will be deleted and issued keys will stop working.</div>
            <div className='field' style={{ marginTop: 12 }}><label>Type "{expectedDeleteText}" to continue</label><input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder='delete project-xxxx' /></div>
            <div className='modal-footer'><button className='btn btn-ghost' onClick={() => setProjectToDelete(null)}>Cancel</button><button className='btn btn-danger' disabled={!canDeleteProject} onClick={handleDelete}>Delete project permanently</button></div>
          </div>
        </div>
        <div className={`notif ${notif.show ? 'show' : ''} ${notif.type}`}>{notif.msg}</div>
      </main>
    </div>
  );
}

function UsageCard({ icon, label, value, accent }) {
  return <div className={`usage-summary-card ${accent}`}><i>{icon}</i><span>{label}</span><strong>{value}</strong></div>;
}

function UsageBar({ label, used, limit, formatNum, fmtNum = (value) => value, quotaColor }) {
  const limitLabel = limit == null ? 'Unlimited' : formatNum ? fmtNum(limit) : String(limit);
  const pct = limit == null ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const col = limit == null ? 'ok' : quotaColor(used, limit);
  return <div className='usage-bar'><div><span>{label}</span><b>{formatNum ? fmtNum(used) : used} / {limitLabel}</b></div><div className='usage-track'><span className={col} style={{ width: `${pct}%` }} /></div><small>{pct}% used</small></div>;
}

function EmptyProjects({ go }) {
  return <div className='card empty-projects'><div>▦</div><h3>No projects yet</h3><p>Create your first workspace to start managing AI access.</p><button className='btn btn-primary' onClick={() => go('/console/new')}>+ Create Project</button></div>;
}

function ProjectCard({ project, fmtDate, go, onDelete }) {
  return <button className='card project-card console-project-card' onClick={() => go(`/console/${project.slug}/overview`)}><div className='console-project-card-header'><h3>{project.name}</h3><span className={`badge ${project.status === 'active' ? 'active' : 'paused'}`}>{project.status}</span></div><div className='console-project-card-body'><div className='console-project-id'>{project.slug}</div><div className='console-project-date'>Created {fmtDate(project.created_at)}</div></div><div className='console-project-card-footer'><span className='open-project-hint'>Open ›</span><span className='project-delete console-project-delete' onClick={(e) => { e.stopPropagation(); onDelete(); }} title='Delete project'>🗑</span></div></button>;
}
