import { Store } from '../core/Store';
import {
  setBuildMode, placeBuilding, resetGame, setHoveredTile, setSpeed,
  selectBuilding, selectGuest, selectStaff, setPrice, demolishBuilding, repairBuilding, upgradeBuilding,
  claimMission, setPackagePrice, togglePackage, setDayPassPrice, toggleDayPass,
  takeLoan, repayLoan, toggleOffering,
  respondReview, hireStaff, fireStaff, setSalary, resolveStory, acceptContract, declineContract,
  buyLand, panCamera, setZoom, startCampaign, placePath, removePath, setPathMode,
  placeTrashBin, removeTrashBin, setEventProgram,
} from '../state/actions';
import { canAffordBuilding, getBuildingSize, getGuestCount, getAccommodationCapacity, getPowerSupply, getPowerDemand, getGuestExperience, getRunwayDays, getOccupancyPercent, getTotalDebt, getDailyInterest, getSegmentAttractiveness, getStarTier, getMaintenanceMult, getRoomPriceMult } from '../state/selectors';
import { EconomySystem } from '../systems/EconomySystem';
import { SaveSystem } from '../systems/SaveSystem';
import { Renderer } from '../render/Renderer';
import { IsoRenderer } from '../render/IsoRenderer';
import { isValidPlacement } from '../world/Placement';
import {
  CATEGORIES, getBuildingsByCategory, getBuildingDef, BUILDING_DEFS,
  getEffectiveCapacity, getEffectiveIncome, getEffectiveMaintenance, getUpgradeCost,
  GUEST_SEGMENT_DEFS, getEffectivePackagePrice, isBuildingUnlocked, getUnlockRequirementsText,
  getEffectivePower, getEffectiveBehaviorModifiers,
} from '../state/buildingDefs';
import { BuildingCategory, GameSpeed, GuestSegment, REPUTATION_COMPONENT_LABELS, REPUTATION_COMPONENT_ICONS, NeedType, EventProgramType } from '../state/types';
import { MARKETING_CAMPAIGNS, getCampaignDef } from '../state/marketingDefs';
import { getGuestSummary } from '../systems/GuestSystem';
import { getWeatherEmoji, getWeatherLabel } from '../systems/WeatherSystem';

export class UIManager {
  private toastTimeout: number | null = null;
  private selectedCategory: BuildingCategory = 'infrastructure';
  private buildItemEls: Map<string, HTMLDivElement> = new Map();
  private categoryTabEls: Map<string, HTMLButtonElement> = new Map();
  private panelBuilt = false;
  private lastEventCount = 0;
  private buyLandMode = false;
  private lastLoanKey = '';
  private lastMissionKey = '';
  private lastBuildingDetailKey = '';
  private lastReviewKey = '';
  private lastReportKey = '';
  private lastContractKey = '';
  private lastStoryId = '';

  constructor(
    private store: Store,
    private renderer: Renderer | IsoRenderer,
    private economySystem: EconomySystem,
    private saveSystem: SaveSystem,
    private canvas: HTMLCanvasElement,
  ) {
    this.bindEvents();
    this.setupAccordions();
    this.buildFullPanel();
    this.setupLeaderboard();
    this.setupAnalytics();
    this.updateUI();
    this.store.subscribe(() => this.updateUI());
  }

  private resetBinButton(): void {
    const btn = this.el('btn-place-bin') as HTMLButtonElement;
    btn.style.background = '#636e72';
    btn.textContent = '🗑 TRASH BIN ($15)';
  }

  private el(id: string): HTMLElement {
    return document.getElementById(id)!;
  }

  // ── Accordion Setup ────────────────────────────────────────────────

  private setupAccordions(): void {
    document.querySelectorAll('.acc-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.parentElement!;
        section.classList.toggle('open');
      });
    });
  }

  // ── Left Panel Tabs ────────────────────────────────────────────────

  private setupPanelTabs(): void {
    const tabs = ['build', 'missions', 'events'];
    for (const t of tabs) {
      this.el(`tab-${t}`).addEventListener('click', () => {
        for (const t2 of tabs) {
          this.el(`tab-${t2}`).classList.toggle('active', t2 === t);
          this.el(`panel-${t2}`).classList.toggle('active', t2 === t);
        }
      });
    }
  }

  // ── Build Panel ────────────────────────────────────────────────────

  private buildFullPanel(): void {
    this.setupPanelTabs();

    const tabsEl = this.el('category-tabs');
    tabsEl.innerHTML = '';
    this.categoryTabEls.clear();

    for (const cat of CATEGORIES) {
      const btn = document.createElement('button');
      btn.className = `cat-tab${cat.key === this.selectedCategory ? ' active' : ''}`;
      btn.textContent = cat.label;
      btn.addEventListener('click', () => {
        this.selectedCategory = cat.key;
        this.showActiveCategory();
      });
      tabsEl.appendChild(btn);
      this.categoryTabEls.set(cat.key, btn);
    }

    const listEl = this.el('build-list');
    listEl.innerHTML = '';
    this.buildItemEls.clear();

    for (const cat of CATEGORIES) {
      const buildings = getBuildingsByCategory(cat.key);
      for (const def of buildings) {
        const unlockText = getUnlockRequirementsText(def.type);
        const item = document.createElement('div');
        item.className = 'build-item';
        item.dataset.category = cat.key;
        item.dataset.buildingType = def.type;
        const offeringCount = def.defaultOfferings?.filter(o => o.unlockLevel > 1).length ?? 0;
        const terrainLabel = def.terrain === 'beach' ? '🏖️ Beach' : def.terrain === 'land' ? '🏗️ Land' : '';
        const roleTag = def.role === 'experience_driver' ? '<span style="color:#55efc4;font-size:9px;margin-left:4px">EXP</span>'
          : def.role === 'revenue_driver' ? '<span style="color:#fdcb6e;font-size:9px;margin-left:4px">REV</span>'
          : '<span style="color:#74b9ff;font-size:9px;margin-left:4px">RISK</span>';
        const staffReq = def.requiresStaff ? `<br><span style="color:#ffa502;font-size:9px">Requires: ${def.requiresStaff}</span>` : '';
        const freeLabel = def.role === 'experience_driver' && def.incomePerVisit === 0 && def.satisfiesNeed ? '<span style="color:#55efc4;font-size:9px"> FREE</span>' : '';
        item.innerHTML = `
          <div class="build-name">
            <span class="build-swatch" style="background:${def.color}"></span>${def.name}${roleTag}${freeLabel}
            ${terrainLabel ? `<span style="font-size:10px;opacity:0.7;margin-left:4px">${terrainLabel}</span>` : ''}
          </div>
          <div class="build-info">
            <span class="build-cost">$${def.cost}</span> &middot; ${def.width}x${def.height}
            ${def.powerConsumption > 0 ? ` &middot; ⚡${def.powerConsumption}` : ''}
            ${def.powerProduction > 0 ? ` &middot; ⚡+${def.powerProduction}` : ''}
            ${def.constructionDays > 0 ? ` &middot; 🔨${def.constructionDays}d` : ''}
            ${def.maxLevel > 1 ? ` &middot; Lv1-${def.maxLevel}` : ''}
            ${def.incomePerVisit > 0 ? `<br>$${def.incomePerVisit}/visit` : ''}
            ${def.stayBonusDays > 0 ? `<br>Stay bonus: +${(def.stayBonusDays * 100).toFixed(0)}%` : ''}
            ${def.happinessDecayReduction > 0 ? ` &middot; Decay: -${(def.happinessDecayReduction * 100).toFixed(0)}%` : ''}
            ${def.defaultPackages && def.defaultPackages.length > 0 ? `<br>📦 ${def.defaultPackages.length} packages` : ''}
            ${offeringCount > 0 ? ` &middot; ${offeringCount} upgradeable` : ''}
            &middot; -$${def.maintenanceCost}/day${staffReq}
          </div>
          ${unlockText ? `<div class="unlock-req">🔒 Requires: ${unlockText}</div>` : ''}`;
        item.addEventListener('click', () => {
          const state = this.store.getState();
          if (!isBuildingUnlocked(def.type, state.buildings)) {
            this.showToast(`Unlock requires: ${unlockText}`, 'error');
            return;
          }
          if (state.money >= def.cost) {
            this.store.dispatch(setBuildMode(def.type));
            this.resetBinButton();
            const pathBtn2 = this.el('btn-build-path') as HTMLButtonElement;
            pathBtn2.style.background = '#bfbfaa';
            pathBtn2.textContent = '🛤 BUILD PATH ($1)';
          } else {
            this.showToast('Not enough money!', 'error');
          }
        });
        listEl.appendChild(item);
        this.buildItemEls.set(def.type, item);
      }
    }

    this.panelBuilt = true;
    this.showActiveCategory();
  }

  private showActiveCategory(): void {
    for (const [key, btn] of this.categoryTabEls) {
      btn.classList.toggle('active', key === this.selectedCategory);
    }
    for (const [, item] of this.buildItemEls) {
      item.style.display = item.dataset.category === this.selectedCategory ? '' : 'none';
    }
  }

  private updateBuildItemStates(): void {
    const state = this.store.getState();
    for (const [type, item] of this.buildItemEls) {
      const def = BUILDING_DEFS[type as keyof typeof BUILDING_DEFS];
      const unlocked = isBuildingUnlocked(def.type, state.buildings);
      item.classList.toggle('selected', state.buildMode === type);
      item.classList.toggle('cant-afford', unlocked && state.money < def.cost);
      item.classList.toggle('locked', !unlocked);
    }
  }

  // ── Guest Detail Panel ─────────────────────────────────────────────

  private lastGuestDetailKey = '';

  private updateGuestDetail(): void {
    const state = this.store.getState();
    const guestEl = this.el('guest-detail');
    const defaultEl = this.el('info-default');
    const buildingEl = this.el('building-detail');
    const staffEl = this.el('staff-detail');

    if (state.selectedGuest === null) {
      guestEl.classList.remove('visible');
      this.lastGuestDetailKey = '';
      return;
    }

    const guest = state.guests.find(g => g.id === state.selectedGuest);
    if (!guest) {
      guestEl.classList.remove('visible');
      this.lastGuestDetailKey = '';
      return;
    }

    defaultEl.style.display = 'none';
    buildingEl.classList.remove('visible');
    staffEl.classList.remove('visible');
    guestEl.classList.add('visible');

    const segDef = GUEST_SEGMENT_DEFS[guest.segment];

    // Header
    const segIcons: Record<GuestSegment, string> = {
      family: '👨‍👩‍👧', couple: '💑', nomad: '🎒', vip: '👑', local: '🏠',
    };
    const segIcon = this.el('guest-seg-icon');
    segIcon.style.background = segDef.color;
    segIcon.textContent = segIcons[guest.segment] || '👤';
    this.el('guest-name').textContent = `${segDef.label} Guest #${guest.id}`;
    const vipBadge = this.el('guest-vip');
    vipBadge.style.display = guest.isVIP ? 'inline' : 'none';

    // Info rows
    const hpPct = Math.round(guest.happiness);
    this.el('guest-happiness-val').textContent = `${hpPct}%`;
    const hpBar = this.el('guest-happiness-bar') as HTMLElement;
    hpBar.style.width = `${hpPct}%`;
    hpBar.style.background = hpPct >= 65 ? '#00b894' : hpPct >= 35 ? '#fdcb6e' : '#d63031';

    this.el('guest-money').textContent = `$${Math.round(guest.money)}`;
    const daysStayed = state.day - guest.arrivalDay + 1;
    const totalStay = guest.segment === 'local' ? 1 : guest.stayDuration + daysStayed;
    this.el('guest-stay').textContent = `Day ${daysStayed} of ${totalStay}`;
    this.el('guest-segment').textContent = segDef.label;

    // Package info
    if (guest.packageId && guest.assignedAccommodation !== null) {
      const accom = state.buildings.find(b => b.id === guest.assignedAccommodation);
      const pkg = accom?.packages.find(p => p.id === guest.packageId);
      let pkgLabel = pkg ? pkg.name : '-';
      if (guest.packageUpgraded) pkgLabel += ' (upgraded!)';
      this.el('guest-package').textContent = pkgLabel;
    } else {
      this.el('guest-package').textContent = guest.segment === 'local' ? 'Day Pass' : '-';
    }

    // Stay bonus indicator
    const stayEl = this.el('guest-stay');
    if (guest.stayBonusApplied > 0) {
      stayEl.textContent += ` (+${guest.stayBonusApplied} bonus)`;
      stayEl.style.color = '#55efc4';
    } else {
      stayEl.style.color = '';
    }

    // Needs bars
    const needsDef: Array<{ key: NeedType; icon: string; label: string }> = [
      { key: 'hunger', icon: '🍔', label: 'Hunger' },
      { key: 'thirst', icon: '🥤', label: 'Thirst' },
      { key: 'fun', icon: '🎯', label: 'Fun' },
      { key: 'relaxation', icon: '🧘', label: 'Relax' },
      { key: 'toilet', icon: '🚻', label: 'Toilet' },
      { key: 'accommodation', icon: '🏨', label: 'Accom.' },
      { key: 'beach', icon: '🏖', label: 'Beach' },
      { key: 'stroll', icon: '🚶', label: 'Stroll' },
    ];

    const needsKey = needsDef.map(n => `${n.key}:${Math.round(guest.needs[n.key])}`).join(',');
    const thoughtKey = guest.thoughts.length.toString();
    const detailKey = `${guest.id}-${hpPct}-${Math.round(guest.money)}-${needsKey}-${thoughtKey}`;

    if (detailKey !== this.lastGuestDetailKey) {
      this.lastGuestDetailKey = detailKey;

      const needsEl = this.el('guest-needs-list');
      needsEl.innerHTML = needsDef.map(n => {
        const val = Math.round(guest.needs[n.key]);
        const color = val >= 70 ? '#d63031' : val >= 40 ? '#fdcb6e' : '#00b894';
        return `<div class="need-row">
          <span class="need-icon">${n.icon}</span>
          <span class="need-label">${n.label}</span>
          <div class="need-bar"><div class="need-fill" style="width:${val}%;background:${color}"></div></div>
          <span style="font-size:8px;color:#aaa;width:20px;text-align:right">${val}</span>
        </div>`;
      }).join('');

      // Thought log (newest first)
      const logEl = this.el('guest-thought-log');
      const thoughts = [...(guest.thoughts || [])].reverse();
      if (thoughts.length === 0) {
        logEl.innerHTML = '<div style="font-size:10px;color:#666;padding:4px">No thoughts yet...</div>';
      } else {
        logEl.innerHTML = thoughts.map(t => {
          const moodIcon = t.mood === 'positive' ? '😊' : t.mood === 'negative' ? '😠' : '😐';
          const tagHtml = t.repComponent
            ? `<span class="thought-tag">${REPUTATION_COMPONENT_ICONS[t.repComponent]} ${REPUTATION_COMPONENT_LABELS[t.repComponent]}</span>`
            : '';
          const dayLabel = t.day === state.day ? 'today' : t.day === state.day - 1 ? 'yesterday' : `day ${t.day}`;
          return `<div class="thought-entry">
            <span class="thought-mood">${moodIcon}</span>
            <span class="thought-text">${t.text}</span>
            ${tagHtml}
            <span class="thought-day">${dayLabel}</span>
          </div>`;
        }).join('');
      }
    }
  }

  // ── Staff Detail Panel ────────────────────────────────────────────

  private lastStaffDetailKey = '';

  private updateStaffDetail(): void {
    const state = this.store.getState();
    const staffEl = this.el('staff-detail');
    const defaultEl = this.el('info-default');
    const buildingEl = this.el('building-detail');
    const guestEl = this.el('guest-detail');

    if (state.selectedStaff === null || state.selectedStaff === undefined) {
      staffEl.classList.remove('visible');
      this.lastStaffDetailKey = '';
      return;
    }

    const vis = this.renderer.getStaffVisual(state.selectedStaff);
    if (!vis) {
      staffEl.classList.remove('visible');
      this.lastStaffDetailKey = '';
      return;
    }

    defaultEl.style.display = 'none';
    buildingEl.classList.remove('visible');
    guestEl.classList.remove('visible');
    staffEl.classList.add('visible');

    const roleLabels: Record<string, string> = {
      cleaners: 'Cleaner', animators: 'Animator', builders: 'Builder',
      mechanics: 'Mechanic', lifeguards: 'Lifeguard', security: 'Security',
    };
    const roleIcons: Record<string, string> = {
      cleaners: '🧹', animators: '🎭', builders: '🔨',
      mechanics: '🔧', lifeguards: '🏊', security: '🛡',
    };
    const roleColors: Record<string, string> = {
      cleaners: '#27ae60', animators: '#e67e22', builders: '#f39c12',
      mechanics: '#2980b9', lifeguards: '#e74c3c', security: '#34495e',
    };
    const salaryMap: Record<string, number> = {
      cleaners: state.staff.cleanerCostPerDay,
      animators: state.staff.animatorCostPerDay,
      builders: state.staff.builderCostPerDay,
      mechanics: state.staff.mechanicCostPerDay,
      lifeguards: state.staff.lifeguardCostPerDay,
      security: state.staff.securityCostPerDay,
    };

    const isCleaning = vis.cleaningUntil > performance.now();
    const detailKey = `${vis.id}-${vis.role}-${vis.cleanedToday}-${vis.targetLitterPos?.x ?? 'n'}-${isCleaning}-${state.litter.items.length}`;
    if (detailKey === this.lastStaffDetailKey) return;
    this.lastStaffDetailKey = detailKey;

    const icon = this.el('staff-detail-icon');
    icon.style.background = roleColors[vis.role] || '#555';
    icon.textContent = roleIcons[vis.role] || '👷';

    this.el('staff-detail-name').textContent = `${roleLabels[vis.role] || vis.role} #${vis.id}`;
    this.el('staff-detail-role').textContent = roleLabels[vis.role] || vis.role;
    this.el('staff-detail-salary').textContent = `$${salaryMap[vis.role] || 0}/day`;

    // Status
    let status = 'Patrolling';
    if (vis.role === 'cleaners') {
      status = isCleaning ? '✨ Cleaning!' : vis.targetLitterPos !== null ? '🧹 Heading to litter...' : (state.litter.items.length === 0 ? '✅ All clean!' : '👀 Looking for litter');
    } else if (vis.role === 'builders') {
      const constructing = state.buildings.some(b => b.isConstructing);
      status = constructing ? '🔨 Building...' : '⏳ Waiting for work';
    } else if (vis.role === 'mechanics') {
      const damaged = state.buildings.some(b => b.damaged);
      status = damaged ? '🔧 Repairing...' : '✅ All operational';
    } else if (vis.role === 'lifeguards') {
      status = '🏖 Watching the beach';
    } else if (vis.role === 'security') {
      status = '🛡 On patrol';
    } else if (vis.role === 'animators') {
      status = '🎭 Entertaining guests';
    }
    this.el('staff-detail-status').textContent = status;

    // Main stat
    const statEl = this.el('staff-detail-stat');
    const statLabelEl = this.el('staff-detail-stat-label');
    if (vis.role === 'cleaners') {
      statEl.textContent = `${vis.cleanedToday}`;
      statEl.style.color = '#55efc4';
      statLabelEl.textContent = 'Items cleaned today';
    } else if (vis.role === 'builders') {
      const constructing = state.buildings.filter(b => b.isConstructing).length;
      statEl.textContent = `${constructing}`;
      statEl.style.color = '#f39c12';
      statLabelEl.textContent = 'Buildings under construction';
    } else if (vis.role === 'mechanics') {
      const damaged = state.buildings.filter(b => b.damaged).length;
      statEl.textContent = `${damaged}`;
      statEl.style.color = damaged > 0 ? '#e74c3c' : '#55efc4';
      statLabelEl.textContent = 'Damaged buildings';
    } else if (vis.role === 'lifeguards') {
      const beachGuests = state.guests.filter(g => g.currentVisiting === -1).length;
      statEl.textContent = `${beachGuests}`;
      statEl.style.color = '#74b9ff';
      statLabelEl.textContent = 'Guests on beach';
    } else if (vis.role === 'security') {
      statEl.textContent = `${state.staff.security * 2}`;
      statEl.style.color = '#a29bfe';
      statLabelEl.textContent = 'Fines collected (est.)';
    } else if (vis.role === 'animators') {
      const funBuildings = state.buildings.filter(b => !b.isConstructing && !b.damaged).length;
      statEl.textContent = `${funBuildings}`;
      statEl.style.color = '#fdcb6e';
      statLabelEl.textContent = 'Active buildings boosted';
    }

    // Extra info
    const extraEl = this.el('staff-detail-extra');
    if (vis.role === 'cleaners') {
      const litterCount = state.litter.items.length;
      extraEl.innerHTML = `<div style="margin-top:4px">Litter on ground: <b style="color:${litterCount > 10 ? '#e74c3c' : '#55efc4'}">${litterCount}</b></div>
        <div style="margin-top:2px;color:#888">Each cleaner removes ~15 items/day</div>`;
    } else {
      extraEl.innerHTML = '';
    }
  }

  // ── Missions Panel ─────────────────────────────────────────────────

  private updateMissionsPanel(): void {
    const state = this.store.getState();

    // Only rebuild when mission state changes
    const missionKey = state.missions.map(m => `${m.id}:${m.completed}:${m.claimed}`).join(',');
    if (missionKey === this.lastMissionKey) return;
    this.lastMissionKey = missionKey;

    const listEl = this.el('missions-list');
    listEl.innerHTML = '';

    const sorted = [...state.missions].sort((a, b) => {
      if (a.claimed !== b.claimed) return a.claimed ? 1 : -1;
      if (a.completed !== b.completed) return a.completed ? -1 : 1;
      return 0;
    });

    for (const m of sorted) {
      const div = document.createElement('div');
      div.className = `mission-item${m.completed ? ' completed' : ''}${m.claimed ? ' claimed' : ''}`;
      div.innerHTML = `
        <div class="mission-title">${m.completed ? '✓ ' : ''}${m.title}</div>
        <div class="mission-desc">${m.description}</div>
        <span class="mission-reward">+$${m.reward}</span>
        ${m.completed && !m.claimed ? `<button class="mission-claim" data-mission="${m.id}">Claim</button>` : ''}
        ${m.claimed ? '<span style="font-size:9px;color:#636e72;margin-left:6px">Claimed</span>' : ''}
      `;
      listEl.appendChild(div);
    }

    listEl.querySelectorAll('.mission-claim').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const missionId = (btn as HTMLElement).dataset.mission!;
        this.store.dispatch(claimMission(missionId));
        this.saveSystem.save();
        this.showToast('Mission reward claimed!', 'success');
      });
    });

    const unclaimed = state.missions.filter(m => m.completed && !m.claimed).length;
    const tabEl = this.el('tab-missions');
    tabEl.innerHTML = unclaimed > 0
      ? `<span class="tab-icon">🎯</span> Goals (${unclaimed})`
      : '<span class="tab-icon">🎯</span> Goals';
  }

  // ── Events Panel ───────────────────────────────────────────────────

  private updateEventsPanel(): void {
    const state = this.store.getState();

    // Only rebuild on new events
    if (state.eventLog.length === this.lastEventCount) {
      // Still update active tab badge
      const active = state.events.filter(e => e.daysRemaining >= 0).length;
      const tabEl = this.el('tab-events');
      tabEl.innerHTML = active > 0
        ? `<span class="tab-icon">📋</span> Events (${active})`
        : '<span class="tab-icon">📋</span> Events';
      return;
    }

    const listEl = this.el('events-list');
    listEl.innerHTML = '';

    if (state.eventLog.length === 0) {
      listEl.innerHTML = '<div style="font-size:10px;color:#636e72;padding:10px">No events yet. Events start after a few days.</div>';
      return;
    }

    for (const ev of state.eventLog) {
      const div = document.createElement('div');
      div.className = 'event-item';
      const isActive = state.events.some(e => e.day === ev.day && e.daysRemaining >= 0);
      div.innerHTML = `
        <div class="event-title">${isActive ? '🔴 ' : ''}Day ${ev.day}: ${ev.title}</div>
        <div class="event-desc">${ev.description}</div>
      `;
      listEl.appendChild(div);
    }

    if (state.eventLog.length > this.lastEventCount && this.lastEventCount > 0) {
      const newest = state.eventLog[0];
      this.showToast(`${newest.title} — ${newest.description}`, 'event');
    }
    this.lastEventCount = state.eventLog.length;

    const active = state.events.filter(e => e.daysRemaining >= 0).length;
    const tabEl = this.el('tab-events');
    tabEl.innerHTML = active > 0
      ? `<span class="tab-icon">📋</span> Events (${active})`
      : '<span class="tab-icon">📋</span> Events';
  }

  // ── Building Detail Panel ──────────────────────────────────────────

  private updateBuildingDetail(): void {
    const state = this.store.getState();
    const detailEl = this.el('building-detail');
    const defaultEl = this.el('info-default');
    const guestEl = this.el('guest-detail');
    const staffEl = this.el('staff-detail');

    if (state.selectedBuilding === null) {
      detailEl.classList.remove('visible');
      if (state.selectedGuest === null && (state.selectedStaff === null || state.selectedStaff === undefined)) defaultEl.style.display = '';
      this.lastBuildingDetailKey = '';
      return;
    }

    const b = state.buildings.find(bl => bl.id === state.selectedBuilding);
    if (!b) {
      detailEl.classList.remove('visible');
      if (state.selectedGuest === null && (state.selectedStaff === null || state.selectedStaff === undefined)) defaultEl.style.display = '';
      this.lastBuildingDetailKey = '';
      return;
    }

    defaultEl.style.display = 'none';
    guestEl.classList.remove('visible');
    staffEl.classList.remove('visible');
    detailEl.classList.add('visible');

    const def = getBuildingDef(b.type);
    const effCap = getEffectiveCapacity(b.type, b.level, b);
    const effIncome = getEffectiveIncome(b.type, b.level, b);
    const effMaint = getEffectiveMaintenance(b.type, b.level, b);

    (this.el('detail-swatch') as HTMLElement).style.background = def.color;
    this.el('detail-name').textContent = def.name;
    this.el('detail-level').textContent = def.maxLevel > 1 ? `Lv.${b.level}/${def.maxLevel}` : '';

    let status = 'Operational';
    let statusColor = '#55efc4';
    if (b.isConstructing) { status = 'Building...'; statusColor = '#fdcb6e'; }
    else if (b.damaged) { status = 'DAMAGED'; statusColor = '#ff4757'; }
    else if (!b.powered) { status = 'No Power'; statusColor = '#ffa502'; }
    const statusEl = this.el('detail-status');
    statusEl.textContent = status;
    statusEl.style.color = statusColor;

    this.el('detail-guests').textContent = effCap > 0 ? `${b.currentGuests}/${effCap}` : '-';
    this.el('detail-maint').textContent = `-$${effMaint}/day`;

    // Income display: for accommodation show package range, for others show per-visit
    if (def.category === 'accommodation' && b.packages.length > 0) {
      const enabled = b.packages.filter(p => p.enabled);
      if (enabled.length > 0) {
        const prices = enabled.map(p => getEffectivePackagePrice(p, b.level));
        this.el('detail-income').textContent = `$${Math.min(...prices)}-$${Math.max(...prices)}/night`;
      } else {
        this.el('detail-income').textContent = 'No packages!';
        (this.el('detail-income') as HTMLElement).style.color = '#ff6b6b';
      }
    } else {
      const incomeText = effIncome.perVisit > 0
        ? `$${Math.round(effIncome.perVisit * b.priceMultiplier)}/visit`
        : '-';
      this.el('detail-income').textContent = incomeText;
    }

    const powerText = def.powerProduction > 0
      ? `Produces ${getEffectivePower(b)}`
      : def.powerConsumption > 0 ? `Uses ${def.powerConsumption}` : 'None';
    this.el('detail-power').textContent = powerText;

    const adjEl = this.el('detail-adjacency');
    if (b.adjacencyBonus > 0) {
      adjEl.textContent = `+${Math.round(b.adjacencyBonus * 100)}% bonus`;
      adjEl.style.color = '#55efc4';
    } else if (b.adjacencyBonus < 0) {
      adjEl.textContent = `${Math.round(b.adjacencyBonus * 100)}% penalty`;
      adjEl.style.color = '#ff6b6b';
    } else {
      adjEl.textContent = 'None';
      adjEl.style.color = '#aaa';
    }

    // Role display
    const roleLabels: Record<string, string> = {
      revenue_driver: 'Revenue Driver',
      experience_driver: 'Experience Driver',
      risk_mitigator: 'Risk Mitigator',
    };
    const roleEl = this.el('detail-role');
    roleEl.textContent = roleLabels[def.role] || def.role;
    roleEl.style.color = def.role === 'experience_driver' ? '#55efc4' : def.role === 'revenue_driver' ? '#fdcb6e' : '#74b9ff';

    // Behavior modifiers display (experience/revenue buildings with indirect effects)
    const behaviorSection = this.el('detail-behavior-section') as HTMLElement;
    const behaviorMods = getEffectiveBehaviorModifiers(b);
    const hasAnyMod = behaviorMods.stayBonusDays > 0 || behaviorMods.happinessDecayReduction > 0 ||
      behaviorMods.packageUpgradeChance > 0 || behaviorMods.priceSensitivityModifier !== 0 ||
      behaviorMods.needSatisfactionBonus > 0;
    if (hasAnyMod && !b.isConstructing) {
      behaviorSection.style.display = '';
      const lines: string[] = [];
      if (behaviorMods.stayBonusDays > 0) lines.push(`Stay bonus: +${(behaviorMods.stayBonusDays * 100).toFixed(0)}% chance/day`);
      if (behaviorMods.happinessDecayReduction > 0) lines.push(`Happiness decay: -${(behaviorMods.happinessDecayReduction * 100).toFixed(0)}%`);
      if (behaviorMods.packageUpgradeChance > 0) lines.push(`Package upgrade: ${(behaviorMods.packageUpgradeChance * 100).toFixed(0)}% chance`);
      if (behaviorMods.priceSensitivityModifier < 0) lines.push(`Price tolerance: +${(-behaviorMods.priceSensitivityModifier * 100).toFixed(0)}%`);
      if (behaviorMods.needSatisfactionBonus > 0) lines.push(`Need satisfaction: +${behaviorMods.needSatisfactionBonus}`);
      this.el('detail-behavior-mods').innerHTML = lines.map(l => `<div>${l}</div>`).join('');
    } else {
      behaviorSection.style.display = 'none';
    }

    // Staff requirement warning
    if (def.requiresStaff && !b.isConstructing) {
      const required = def.requiredStaffCount ?? 1;
      const requiredAtLevel = b.level >= 2 ? required + 1 : required;
      const available = (state.staff as any)[def.requiresStaff] ?? 0;
      if (available < requiredAtLevel) {
        const statusEl2 = this.el('detail-status');
        statusEl2.textContent = `Needs ${requiredAtLevel} ${def.requiresStaff}`;
        statusEl2.style.color = '#ffa502';
      }
    }

    // Event program section (event_space only)
    const eventProgramSection = this.el('event-program-section') as HTMLElement;
    if (b.type === 'event_space' && !b.isConstructing) {
      eventProgramSection.style.display = '';
      const programs: { type: EventProgramType | null; name: string; cost: number; desc: string }[] = [
        { type: null, name: 'No Event', cost: 0, desc: 'Event space idle' },
        { type: 'cinema_night', name: 'Cinema Night', cost: 8, desc: 'Quiet fun for all' },
        { type: 'kids_show', name: 'Kids Show', cost: 10, desc: 'Families love it' },
        { type: 'silent_party', name: 'Silent Party', cost: 12, desc: 'Fun, no noise' },
        { type: 'live_band', name: 'Live Band', cost: 15, desc: 'Universal appeal, some noise' },
        { type: 'dj_night', name: 'DJ Night', cost: 14, desc: 'Nightlife up, families down' },
      ];
      const current = b.activeEventProgram ?? null;
      const list = this.el('event-program-list');
      list.innerHTML = programs.map(p => {
        const active = current === p.type;
        const color = active ? '#e84393' : '#aaa';
        const costLabel = p.cost > 0 ? ` ($${p.cost}/day)` : '';
        return `<div style="cursor:pointer;padding:2px 4px;border-radius:3px;${active ? 'background:rgba(232,67,147,0.2);' : ''}" data-event-type="${p.type ?? ''}" class="event-prog-btn">
          <span style="color:${color};font-weight:${active ? 'bold' : 'normal'}">${active ? '▶ ' : ''}${p.name}${costLabel}</span>
          <span style="color:#888;font-size:8px;margin-left:4px">${p.desc}</span>
        </div>`;
      }).join('');
      list.querySelectorAll('.event-prog-btn').forEach(el => {
        el.addEventListener('click', () => {
          const et = (el as HTMLElement).dataset.eventType;
          const eventType = et === '' ? null : (et as EventProgramType);
          this.store.dispatch(setEventProgram(b.id, eventType));
          this.saveSystem.save();
        });
      });
    } else {
      eventProgramSection.style.display = 'none';
    }

    // Price slider: only for non-accommodation buildings with per-visit income
    const priceSection = this.el('price-slider-section');
    const isAccommodation = def.category === 'accommodation';
    const hasIncome = def.incomePerVisit > 0;
    priceSection.style.display = (!isAccommodation && hasIncome) && !b.isConstructing ? '' : 'none';
    const slider = this.el('price-slider') as HTMLInputElement;
    slider.value = String(Math.round(b.priceMultiplier * 10));
    this.el('price-val').textContent = `${b.priceMultiplier.toFixed(1)}x`;

    // Package configuration (accommodation only)
    this.updatePackageSection(b);

    // Construction progress
    const constrSection = this.el('detail-construction');
    if (b.isConstructing) {
      constrSection.style.display = '';
      (this.el('construction-progress-bar') as HTMLElement).style.width = `${Math.floor(b.constructionProgress * 100)}%`;
      this.el('construction-pct').textContent = `${Math.floor(b.constructionProgress * 100)}%`;
    } else {
      constrSection.style.display = 'none';
    }

    // Upgrade button
    const upgradeBtn = this.el('btn-upgrade') as HTMLButtonElement;
    if (!b.isConstructing && !b.damaged && b.level < def.maxLevel) {
      const cost = getUpgradeCost(b.type, b.level);
      upgradeBtn.style.display = '';
      upgradeBtn.textContent = `Upgrade Lv.${b.level + 1} ($${cost})`;
      upgradeBtn.disabled = state.money < cost;
    } else {
      upgradeBtn.style.display = 'none';
    }

    // Repair button
    const repairBtn = this.el('btn-repair') as HTMLButtonElement;
    if (b.damaged) {
      const repairCost = effMaint * 3;
      repairBtn.style.display = '';
      repairBtn.textContent = `Repair ($${repairCost})`;
      repairBtn.disabled = state.money < repairCost;
    } else {
      repairBtn.style.display = 'none';
    }
  }

  // ── Package Configuration ──────────────────────────────────────────

  private updatePackageSection(b: { id: number; type: string; level: number; packages: any[]; offerings: any[]; isConstructing: boolean }): void {
    const pkgSection = this.el('package-section');
    const pkgList = this.el('package-list');

    // Filter to packages available at current level
    const availablePackages = b.packages.filter((p: any) => p.unlockLevel <= b.level);

    if (availablePackages.length === 0 || b.isConstructing) {
      pkgSection.style.display = 'none';
    } else {
      const pkgKey = `${b.id}:${b.level}:${availablePackages.map((p: any) => `${p.id}-${p.enabled}-${p.pricePerNight}`).join(',')}`;
      if (pkgKey !== this.lastBuildingDetailKey) {
        this.lastBuildingDetailKey = pkgKey;
        pkgSection.style.display = '';
        pkgList.innerHTML = '';

        // Show locked future packages as preview
        const lockedPackages = b.packages.filter((p: any) => p.unlockLevel > b.level);

        const state = this.store.getState();
        for (const pkg of availablePackages) {
          const effPrice = getEffectivePackagePrice(pkg, b.level);
          const div = document.createElement('div');
          // Check hard requirements
          let reqsMet = true;
          let reqsHtml = '';
          if (pkg.hardRequirements && pkg.hardRequirements.length > 0) {
            const reqParts: string[] = [];
            for (const req of pkg.hardRequirements) {
              const reqDef = getBuildingDef(req.buildingType);
              const has = state.buildings.some((bl: any) => bl.type === req.buildingType && bl.level >= req.level && !bl.isConstructing && bl.powered && !bl.damaged);
              if (!has) reqsMet = false;
              reqParts.push(`<span style="color:${has ? '#55efc4' : '#ff6b6b'}">${reqDef.name} Lv${req.level}${has ? ' ✓' : ' ✗'}</span>`);
            }
            reqsHtml = `<div style="font-size:9px;margin-top:2px">Requires: ${reqParts.join(', ')}</div>`;
          }
          div.className = `package-item ${pkg.enabled ? (reqsMet ? 'enabled' : 'enabled req-missing') : 'disabled'}`;
          div.innerHTML = `
            <div class="package-header">
              <span class="package-name">${pkg.name}${!reqsMet && pkg.enabled ? ' ⚠️' : ''}</span>
              <button class="package-toggle ${pkg.enabled ? 'on' : ''}" data-building="${b.id}" data-pkg="${pkg.id}">
                ${pkg.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <div class="package-price-row">
              <label>$</label>
              <input type="number" value="${pkg.pricePerNight}" min="1" max="100" data-building="${b.id}" data-pkg="${pkg.id}" class="pkg-price-input">
              <label>/night (eff: $${effPrice})</label>
            </div>
            <div class="package-includes">
              <span class="${pkg.includesFood ? 'included-tag' : 'excluded-tag'}">🍽${pkg.includesFood ? '✓' : '✗'}</span>
              <span class="${pkg.includesEntertainment ? 'included-tag' : 'excluded-tag'}">🎮${pkg.includesEntertainment ? '✓' : '✗'}</span>
              <span class="${pkg.includesInfrastructure ? 'included-tag' : 'excluded-tag'}">🏊${pkg.includesInfrastructure ? '✓' : '✗'}</span>
            </div>
            ${reqsHtml}
          `;
          pkgList.appendChild(div);
        }

        for (const pkg of lockedPackages) {
          const div = document.createElement('div');
          div.className = 'package-item locked';
          div.innerHTML = `
            <div class="package-header">
              <span class="package-name">${pkg.name}</span>
              <span class="lock-badge">🔒 Lv.${pkg.unlockLevel}</span>
            </div>
            <div class="package-price-row" style="opacity:0.5">$${pkg.pricePerNight}/night</div>
          `;
          pkgList.appendChild(div);
        }

        pkgList.querySelectorAll('.package-toggle').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const el = btn as HTMLElement;
            const buildingId = parseInt(el.dataset.building!);
            const pkgId = el.dataset.pkg!;
            this.store.dispatch(togglePackage(buildingId, pkgId));
            this.saveSystem.save();
          });
        });

        pkgList.querySelectorAll('.pkg-price-input').forEach(input => {
          input.addEventListener('change', (e) => {
            const el = e.target as HTMLInputElement;
            const buildingId = parseInt(el.dataset.building!);
            const pkgId = el.dataset.pkg!;
            const price = parseInt(el.value) || 1;
            this.store.dispatch(setPackagePrice(buildingId, pkgId, price));
            this.saveSystem.save();
          });
        });
      } else {
        pkgSection.style.display = '';
      }
    }

    // Offerings section (non-accommodation buildings)
    this.updateOfferingsSection(b);
  }

  // ── Offerings Section ─────────────────────────────────────────────

  private lastOfferingsKey = '';

  private updateOfferingsSection(b: { id: number; type: string; level: number; offerings: any[]; isConstructing: boolean }): void {
    const section = this.el('offerings-section');
    const list = this.el('offerings-list');

    if (!b.offerings || b.offerings.length <= 1 || b.isConstructing) {
      section.style.display = 'none';
      return;
    }

    const offKey = `${b.id}:${b.level}:${b.offerings.map((o: any) => `${o.id}-${o.enabled}`).join(',')}`;
    if (offKey === this.lastOfferingsKey) {
      section.style.display = '';
      return;
    }
    this.lastOfferingsKey = offKey;

    section.style.display = '';
    list.innerHTML = '';

    for (const offering of b.offerings) {
      const isBase = offering.unlockLevel === 1;
      const isLocked = offering.unlockLevel > b.level;
      const div = document.createElement('div');

      if (isLocked) {
        div.className = 'offering-item locked';
        const lockedEffects = this.formatOfferingEffects(offering, true);
        div.innerHTML = `
          <div class="offering-header">
            <span class="offering-name">${offering.name}</span>
            <span class="lock-badge">🔒 Lv.${offering.unlockLevel}</span>
          </div>
          <div class="offering-stats" style="opacity:0.5">
            ${offering.revenueBonus > 0 ? `+$${offering.revenueBonus}/visit` : ''}
            ${offering.maintenanceCost > 0 ? ` · -$${offering.maintenanceCost}/day` : ''}
            ${offering.capacityBonus > 0 ? ` · +${offering.capacityBonus} cap` : ''}
          </div>
          ${lockedEffects ? `<div class="offering-effects" style="opacity:0.5;font-size:9px;color:#74b9ff;margin-top:2px">${lockedEffects}</div>` : ''}
        `;
      } else {
        const segmentIcons = this.getSegmentIcons(offering.segmentAppeal);
        div.className = `offering-item ${offering.enabled ? 'enabled' : 'disabled'} ${isBase ? 'base' : ''}`;
        const activeEffects = this.formatOfferingEffects(offering, false);
        div.innerHTML = `
          <div class="offering-header">
            <span class="offering-name">${offering.name}${isBase ? ' (base)' : ''}</span>
            ${isBase ? '<span class="base-tag">Always ON</span>' : `
              <button class="offering-toggle ${offering.enabled ? 'on' : ''}" data-building="${b.id}" data-off="${offering.id}">
                ${offering.enabled ? 'ON' : 'OFF'}
              </button>
            `}
          </div>
          <div class="offering-stats">
            ${offering.revenueBonus > 0 ? `<span class="stat-pos">+$${offering.revenueBonus}/visit</span>` : ''}
            ${offering.happinessBonus > 0 ? `<span class="stat-pos">+${offering.happinessBonus} happy</span>` : ''}
            ${offering.maintenanceCost > 0 ? `<span class="stat-neg">-$${offering.maintenanceCost}/day</span>` : ''}
            ${offering.capacityBonus > 0 ? `<span class="stat-pos">+${offering.capacityBonus} cap</span>` : ''}
            ${offering.powerBonus ? `<span class="stat-pos">+${offering.powerBonus} power</span>` : ''}
            ${offering.maintenanceReduction ? `<span class="stat-pos">-${Math.round(offering.maintenanceReduction * 100)}% maint</span>` : ''}
          </div>
          ${activeEffects ? `<div class="offering-effects" style="font-size:9px;color:#55efc4;margin-top:2px">${activeEffects}</div>` : ''}
          ${segmentIcons ? `<div class="offering-segments">${segmentIcons}</div>` : ''}
        `;
      }
      list.appendChild(div);
    }

    list.querySelectorAll('.offering-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const el = btn as HTMLElement;
        const buildingId = parseInt(el.dataset.building!);
        const offId = el.dataset.off!;
        this.store.dispatch(toggleOffering(buildingId, offId));
        this.saveSystem.save();
      });
    });
  }

  private getSegmentIcons(appeal?: Partial<Record<GuestSegment, number>>): string {
    if (!appeal) return '';
    const icons: string[] = [];
    for (const [seg, mult] of Object.entries(appeal) as [GuestSegment, number][]) {
      const def = GUEST_SEGMENT_DEFS[seg];
      if (mult > 1) {
        icons.push(`<span class="segment-icon" style="color:${def.color}" title="${def.label} x${mult}">${def.label[0]}×${mult}</span>`);
      }
    }
    return icons.join(' ');
  }

  private formatOfferingEffects(offering: any, _isLocked: boolean): string {
    const parts: string[] = [];
    if (offering.stayBonusDays > 0) parts.push(`Stay +${(offering.stayBonusDays * 100).toFixed(0)}%`);
    if (offering.happinessDecayReduction > 0) parts.push(`Decay -${(offering.happinessDecayReduction * 100).toFixed(0)}%`);
    if (offering.packageUpgradeChance > 0) parts.push(`Pkg ↑${(offering.packageUpgradeChance * 100).toFixed(0)}%`);
    if (offering.priceSensitivityModifier && offering.priceSensitivityModifier < 0) parts.push(`Tol +${(-offering.priceSensitivityModifier * 100).toFixed(0)}%`);
    if (offering.needSatisfactionBonus > 0) parts.push(`Need +${offering.needSatisfactionBonus}`);
    if (offering.unlockBuildings && offering.unlockBuildings.length > 0) parts.push(`Unlocks: ${offering.unlockBuildings.join(', ')}`);
    if (offering.unlockStories && offering.unlockStories.length > 0) parts.push(`Stories: ${offering.unlockStories.length}`);
    if (offering.unlockPackages && offering.unlockPackages.length > 0) parts.push(`Packages: ${offering.unlockPackages.join(', ')}`);
    return parts.join(' · ');
  }

  // ── Segment Legend ─────────────────────────────────────────────────

  private updateSegmentLegend(): void {
    const state = this.store.getState();
    const legendEl = this.el('segment-legend');

    const segmentCounts: Partial<Record<GuestSegment, number>> = {};
    for (const g of state.guests) {
      segmentCounts[g.segment] = (segmentCounts[g.segment] ?? 0) + 1;
    }

    legendEl.innerHTML = '';
    for (const seg of Object.keys(GUEST_SEGMENT_DEFS) as GuestSegment[]) {
      const count = segmentCounts[seg] ?? 0;
      const def = GUEST_SEGMENT_DEFS[seg];
      const attr = getSegmentAttractiveness(state, seg);
      const attrPct = Math.round(attr.score * 100);
      const whyText = attr.reasons.length > 0 ? attr.reasons.join(', ') : 'all good';

      const item = document.createElement('span');
      item.className = 'seg-item';
      item.innerHTML = `<span class="seg-dot" style="background:${def.color}"></span>${def.label}: ${count} <span class="seg-why" title="${whyText}">${attrPct}%</span>`;
      legendEl.appendChild(item);
    }
  }

  // ── Arrival Factors ────────────────────────────────────────────────

  private updateArrivalFactors(s: ReturnType<Store['getState']>): void {
    const el = this.el('arrival-factors');
    const factors: string[] = [];
    const boosts: string[] = [];

    // Reputation (main driver)
    const repNorm = s.reputation / 100;
    const baseRate = Math.max(0, Math.floor(repNorm * 5 - 0.2));
    if (s.reputation < 20) factors.push('<span style="color:#ff6b6b">⚠ Low reputation — very few guests</span>');
    else if (s.reputation < 40) factors.push('<span style="color:#ffa502">Reputation below 40 — slow arrivals</span>');
    else boosts.push(`Rep ${s.reputation}: ~${baseRate} guests/day`);

    // Accommodation
    const accomCap = getAccommodationCapacity(s);
    if (accomCap === 0) factors.push('<span style="color:#ff6b6b">⚠ No accommodation — only locals can visit</span>');
    else {
      const housed = s.guests.filter(g => g.assignedAccommodation !== null).length;
      const free = accomCap - housed;
      if (free <= 0) factors.push('<span style="color:#ffa502">Fully booked — build more rooms</span>');
      else boosts.push(`${free} beds free`);
    }

    // Weather
    const weatherLabels: Record<string, string> = { sunny: '', cloudy: 'Cloudy: -20% arrivals', rain: 'Rain: -50% arrivals', storm: 'Storm: -80% arrivals' };
    const wl = weatherLabels[s.weather.current];
    if (wl) factors.push(`<span style="color:#ffa502">${wl}</span>`);

    // Events
    if (s.events.some(e => e.type === 'festival' && e.daysRemaining >= 0)) boosts.push('<span style="color:#55efc4">Festival: 2x arrivals!</span>');
    if (s.events.some(e => e.type === 'viral_backlash' && e.daysRemaining >= 0)) factors.push('<span style="color:#ff6b6b">Viral backlash: 50% fewer arrivals</span>');

    // Marketing campaigns
    const marketingBonus = s.marketing.reduce((sum, c) => {
      const def = getCampaignDef(c.campaignId);
      return sum + (def?.guestBonus ?? 0);
    }, 0);
    if (marketingBonus > 0) {
      boosts.push(`<span style="color:#55efc4">📢 Marketing: +${marketingBonus} guests/day</span>`);
    } else {
      factors.push('<span style="color:#636e72">📢 No marketing — consider running ads</span>');
    }

    // Guaranteed minimum
    if (accomCap > 0 && baseRate === 0 && marketingBonus === 0) {
      boosts.push('<span style="color:#aaa">Min. 1 guest/day guaranteed</span>');
    }

    // How to improve
    if (s.reputation < 50 && factors.length > 0) {
      factors.push('<span style="color:#636e72">💡 Improve: raise happiness, add variety, handle reviews</span>');
    }

    el.innerHTML = factors.length > 0 || boosts.length > 0
      ? `<div style="font-weight:700;color:#e94560;margin-bottom:2px">Guest Flow</div>` +
        boosts.map(b => `<div>${b}</div>`).join('') +
        factors.map(f => `<div>${f}</div>`).join('')
      : '';
  }

  // ── Reviews Panel ─────────────────────────────────────────────────

  private updateReviewsPanel(): void {
    const s = this.store.getState();

    // Social Heat display
    this.el('social-heat-val').textContent = Math.round(s.socialHeat).toString();
    const heatBar = this.el('social-heat-bar') as HTMLElement;
    heatBar.style.width = `${s.socialHeat}%`;
    heatBar.style.background = s.socialHeat > 60 ? '#ff6b6b' : s.socialHeat > 30 ? '#ffa502' : '#55efc4';

    const unhandled = s.reviews.filter(r => !r.handled && r.sentiment === 'negative').length;
    this.el('reviews-summary').textContent = unhandled > 0 ? `${unhandled} pending` : `${s.reviews.length}`;
    (this.el('reviews-summary') as HTMLElement).style.color = unhandled > 0 ? '#ff6b6b' : '#55efc4';

    const reviewKey = `${s.reviews.length}:${s.reviews.filter(r => r.handled).length}`;
    if (reviewKey === this.lastReviewKey) return;
    this.lastReviewKey = reviewKey;

    const list = this.el('reviews-list');
    list.innerHTML = '';

    const recent = [...s.reviews].reverse().slice(0, 10);
    for (const r of recent) {
      const div = document.createElement('div');
      div.className = `review-item ${r.sentiment}`;
      const fixHint = this.getReviewFixHint(r.topic);
      const compCost = 75 + r.severity * 45;
      div.innerHTML = `
        <div class="review-text">"${r.text}"</div>
        <div class="review-meta">
          <span>${r.topic} · Day ${r.day} · -${r.severity} rep</span>
        </div>
        ${!r.handled && r.sentiment === 'negative' ? `
          ${fixHint ? `<div style="font-size:8px;color:#ffa502;margin:2px 0">💡 Fix: ${fixHint}</div>` : ''}
          <div class="review-actions">
            <button class="review-act-btn respond" data-review="${r.id}" data-action="respond">Acknowledge (+1 rep)</button>
            <button class="review-act-btn compensate" data-review="${r.id}" data-action="compensate">Compensate $${compCost} (+${Math.ceil(r.severity * 0.8)} rep)</button>
            <button class="review-act-btn ignore" data-review="${r.id}" data-action="ignore">Ignore (-${Math.ceil(r.severity * 0.5)} rep)</button>
          </div>
        ` : r.handled ? `<div style="font-size:8px;color:#636e72;margin-top:2px">${r.responseType === 'respond' ? 'Acknowledged' : r.responseType === 'compensate' ? 'Compensated' : 'Ignored'}</div>` : ''}
      `;
      list.appendChild(div);
    }

    list.querySelectorAll('.review-act-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const el = btn as HTMLElement;
        const reviewId = parseInt(el.dataset.review!);
        const action = el.dataset.action as 'respond' | 'compensate' | 'ignore';
        this.store.dispatch(respondReview(reviewId, action));
        this.saveSystem.save();
      });
    });
  }

  private getReviewFixHint(topic: string): string | null {
    const s = this.store.getState();
    const hasCleaner = s.buildings.some(b => b.type === 'cleaners_shack' && !b.isConstructing);
    switch (topic) {
      case 'cleanliness':
        if (!hasCleaner) return 'Build a Cleaners Shack and hire cleaners';
        if (s.staff.cleaners === 0) return 'Hire cleaners in Staff panel';
        return 'Hire more cleaners for better hygiene';
      case 'queues':
        return 'Build more facilities or upgrade capacity';
      case 'noise':
        return 'Keep event space away from accommodation';
      case 'food':
        return 'Build more food/drink venues or upgrade menus';
      case 'entertainment':
        return 'Build entertainment (pool, kids club, event space, gym)';
      case 'value':
        return 'Lower prices or improve service quality';
      case 'safety':
        return 'Repair damaged buildings';
      default:
        return null;
    }
  }

  // ── Daily Report Panel ────────────────────────────────────────────

  private updateDailyReport(): void {
    const s = this.store.getState();
    const reportKey = `${s.day}:${s.previousDayLog.length}`;
    if (reportKey === this.lastReportKey) return;
    this.lastReportKey = reportKey;

    const list = this.el('report-list');

    if (s.previousDayLog.length === 0) {
      list.innerHTML = '<div style="font-size:9px;color:#636e72;padding:4px">No data yet.</div>';
      this.el('report-summary').textContent = '';
      return;
    }

    // Group by category
    const groups: Record<string, typeof s.previousDayLog> = {};
    for (const item of s.previousDayLog) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }

    list.innerHTML = '';
    const catLabels: Record<string, string> = { money: 'Finance', reputation: 'Reputation', churn: 'Guest Churn', demand: 'Demand', happiness: 'Happiness', stay_extension: 'Stay Extensions', package_upgrade: 'Package Upgrades', outcome_report: 'Outcome Reports' };

    // Outcome reports — highlighted section at the top
    const outcomeItems = s.previousDayLog.filter(i => i.category === 'outcome_report');
    if (outcomeItems.length > 0) {
      const outcomeEl = document.createElement('div');
      outcomeEl.style.cssText = 'margin-bottom:6px;padding:5px;background:rgba(253,203,110,0.12);border-radius:4px;border-left:3px solid #fdcb6e';
      outcomeEl.innerHTML = `<div style="font-size:9px;color:#fdcb6e;text-transform:uppercase;margin-bottom:3px;font-weight:bold">Outcome Reports</div>` +
        outcomeItems.map(item => {
          const isPos = item.delta >= 0;
          return `<div style="font-size:10px;color:#dfe6e9;line-height:1.5">${item.label} <span style="color:${isPos ? '#55efc4' : '#ff6b6b'};font-size:9px">(${isPos ? '+' : ''}${item.delta} rep)</span></div>`;
        }).join('');
      list.appendChild(outcomeEl);
    }

    for (const [cat, items] of Object.entries(groups)) {
      const sorted = [...items].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);
      const catEl = document.createElement('div');
      catEl.className = 'report-cat';
      catEl.textContent = catLabels[cat] ?? cat;
      list.appendChild(catEl);

      for (const item of sorted) {
        const row = document.createElement('div');
        row.className = 'report-item';
        const isPos = item.delta >= 0;
        const prefix = cat === 'money' ? '$' : '';
        const sign = isPos ? '+' : '';
        const compTag = item.repComponent ? ` <span style="color:#888;font-size:8px">[${item.repComponent}]</span>` : '';
        row.innerHTML = `
          <span style="color:#aaa">${item.label}${compTag}</span>
          <span class="r-delta ${isPos ? 'pos' : 'neg'}">${sign}${prefix}${Math.round(item.delta * 10) / 10}</span>
        `;
        list.appendChild(row);
      }
    }

    // Causal insights section
    const stayItems = groups['stay_extension'] ?? [];
    const pkgItems = groups['package_upgrade'] ?? [];
    const noiseItems = s.previousDayLog.filter(i => i.causeId === 'nightlife_noise');
    const casinoItems = s.previousDayLog.filter(i => i.causeId?.startsWith('casino_'));

    const insights: string[] = [];
    if (stayItems.length > 0) {
      const totalExtensions = stayItems.filter(i => i.causeId === 'stay_bonus_summary').reduce((acc, i) => acc + i.delta, 0);
      if (totalExtensions > 0) insights.push(`${totalExtensions} guest(s) extended stay thanks to experience buildings`);
    }
    if (pkgItems.length > 0) {
      const upgCount = pkgItems.length;
      if (upgCount > 0) insights.push(`${upgCount} package upgrade(s) — better amenities drove higher spending`);
    }
    if (noiseItems.length > 0) {
      const disturbed = Math.abs(noiseItems[0]?.delta ?? 0);
      if (disturbed > 0) insights.push(`Nightlife noise affected ${disturbed} guest(s) — consider moving event space away from families`);
    }
    if (casinoItems.length > 0) {
      const losses = casinoItems.filter(i => i.delta < 0);
      const wins = casinoItems.filter(i => i.delta > 0);
      if (losses.length > 0) insights.push(`Casino: ${losses.length} guest win(s) — high risk, high reward`);
      if (wins.length > 0) insights.push(`Casino: ${wins.length} house win(s) — profitable night`);
    }

    // Pending outcomes — remind the player about unresolved decisions
    const pendingCount = (s.stories.pendingOutcomes ?? []).length;
    if (pendingCount > 0) {
      insights.push(`${pendingCount} decision outcome(s) pending — results coming soon...`);
    }

    if (insights.length > 0) {
      const insightEl = document.createElement('div');
      insightEl.style.cssText = 'margin-top:6px;padding:4px;background:rgba(85,239,196,0.08);border-radius:3px;border-left:2px solid #55efc4';
      insightEl.innerHTML = `<div style="font-size:8px;color:#55efc4;text-transform:uppercase;margin-bottom:2px">Insights</div>` +
        insights.map(t => `<div style="font-size:9px;color:#aaa;line-height:1.4">• ${t}</div>`).join('');
      list.appendChild(insightEl);
    }

    const moneyItems = groups['money'] ?? [];
    const totalDelta = moneyItems.reduce((s, i) => s + i.delta, 0);
    this.el('report-summary').textContent = totalDelta >= 0 ? `+$${Math.round(totalDelta)}` : `-$${Math.abs(Math.round(totalDelta))}`;
    (this.el('report-summary') as HTMLElement).style.color = totalDelta >= 0 ? '#55efc4' : '#ff6b6b';
  }

  // ── Staff Panel ────────────────────────────────────────────────────

  private updateStaffPanel(): void {
    const s = this.store.getState();
    const st = s.staff;

    // Count & cost summary
    const total = st.cleaners + st.animators + st.builders + st.mechanics + st.lifeguards + st.security;
    const cost =
      st.cleaners * st.cleanerCostPerDay + st.animators * st.animatorCostPerDay +
      st.builders * st.builderCostPerDay + st.mechanics * st.mechanicCostPerDay +
      st.lifeguards * st.lifeguardCostPerDay + st.security * st.securityCostPerDay;
    this.el('staff-summary').textContent = total > 0 ? `${total} · $${cost}/d` : '0 hired';

    // Helper to update each staff role row
    const updateRole = (
      _role: string, count: number, salary: number, sliderId: string,
      salaryLblId: string, countId: string, hireBtnId: string, fireBtnId: string,
      reqId: string, canHire: boolean, reqMsg: string,
    ) => {
      this.el(countId).textContent = count.toString();
      this.el(salaryLblId).textContent = `$${salary}/d`;
      const slider = this.el(sliderId) as HTMLInputElement;
      if (parseInt(slider.value) !== salary) slider.value = salary.toString();
      (this.el(hireBtnId) as HTMLButtonElement).disabled = !canHire;
      (this.el(fireBtnId) as HTMLButtonElement).disabled = count <= 0;
      const reqEl = this.el(reqId);
      if (!canHire && count < 10) {
        reqEl.style.display = '';
        reqEl.textContent = reqMsg;
      } else {
        reqEl.style.display = 'none';
      }
    };

    // Cleaners: need Cleaners Shack, max 2 per shack
    const shackCount = s.buildings.filter(b => b.type === 'cleaners_shack' && !b.isConstructing).length;
    updateRole('cleaners', st.cleaners, st.cleanerCostPerDay, 'slider-cleaner',
      'cleaner-salary-lbl', 'staff-cleaner-count', 'btn-hire-cleaner', 'btn-fire-cleaner',
      'cleaner-req', shackCount > 0 && st.cleaners < shackCount * 2,
      shackCount === 0 ? '🔒 Needs: Cleaners Shack' : `Max ${shackCount * 2} (${shackCount} shack × 2)`);

    // Animators: need any entertainment building
    const hasEntertainment = s.buildings.some(b => getBuildingDef(b.type).category === 'entertainment' && !b.isConstructing);
    updateRole('animators', st.animators, st.animatorCostPerDay, 'slider-animator',
      'animator-salary-lbl', 'staff-animator-count', 'btn-hire-animator', 'btn-fire-animator',
      'animator-req', hasEntertainment && st.animators < 10,
      '🔒 Needs: Entertainment building');

    // Builders: need Handyman Shack, max 2 per shack
    const handyCount = s.buildings.filter(b => b.type === 'handyman_shack' && !b.isConstructing).length;
    updateRole('builders', st.builders, st.builderCostPerDay, 'slider-builder',
      'builder-salary-lbl', 'staff-builder-count', 'btn-hire-builder', 'btn-fire-builder',
      'builder-req', handyCount > 0 && st.builders < handyCount * 2,
      handyCount === 0 ? '🔒 Needs: Handyman Shack' : `Max ${handyCount * 2} (${handyCount} shack × 2)`);

    // Mechanics: need Handyman Shack, max 2 per shack
    updateRole('mechanics', st.mechanics, st.mechanicCostPerDay, 'slider-mechanic',
      'mechanic-salary-lbl', 'staff-mechanic-count', 'btn-hire-mechanic', 'btn-fire-mechanic',
      'mechanic-req', handyCount > 0 && st.mechanics < handyCount * 2,
      handyCount === 0 ? '🔒 Needs: Handyman Shack' : `Max ${handyCount * 2} (${handyCount} shack × 2)`);

    // Lifeguards: need Baywatch Tower, max 2 per tower
    const baywatchCount = s.buildings.filter(b => b.type === 'baywatch_tower' && !b.isConstructing).length;
    updateRole('lifeguards', st.lifeguards, st.lifeguardCostPerDay, 'slider-lifeguard',
      'lifeguard-salary-lbl', 'staff-lifeguard-count', 'btn-hire-lifeguard', 'btn-fire-lifeguard',
      'lifeguard-req', baywatchCount > 0 && st.lifeguards < baywatchCount * 2,
      baywatchCount === 0 ? '🔒 Needs: Baywatch Tower' : `Max ${baywatchCount * 2} (${baywatchCount} tower × 2)`);

    // Security: need Security Post, max 3 per post
    const secPostCount = s.buildings.filter(b => b.type === 'security_post' && !b.isConstructing).length;
    updateRole('security', st.security, st.securityCostPerDay, 'slider-security',
      'security-salary-lbl', 'staff-security-count', 'btn-hire-security', 'btn-fire-security',
      'security-req', secPostCount > 0 && st.security < secPostCount * 3,
      secPostCount === 0 ? '🔒 Needs: Security Post' : `Max ${secPostCount * 3} (${secPostCount} post × 3)`);
  }

  // ── Story Modal ────────────────────────────────────────────────────

  private updateStoryModal(): void {
    const s = this.store.getState();
    const overlay = this.el('story-overlay');
    const story = s.stories.activeStory;

    if (!story) {
      overlay.classList.remove('visible');
      this.lastStoryId = '';
      return;
    }

    if (story.id === this.lastStoryId) return;
    this.lastStoryId = story.id;

    overlay.classList.add('visible');
    this.el('story-title').textContent = story.title;
    this.el('story-desc').textContent = story.description;

    const optionsEl = this.el('story-options');
    optionsEl.innerHTML = '';

    for (const opt of story.options) {
      const btn = document.createElement('button');
      btn.className = 'story-option';

      if (opt.outcomes && opt.outcomes.length > 0) {
        // Probabilistic option: show cost + hint, no exact effects
        const costStr = opt.cost ? `Cost: $${opt.cost}` : 'Free';
        const hintStr = opt.hint ?? 'Outcome uncertain';
        btn.innerHTML = `${opt.label}<br><span style="color:#fdcb6e;font-size:9px">${costStr}</span> <span style="color:#aaa;font-size:9px;font-style:italic">· ${hintStr}</span>`;
      } else {
        // Deterministic option: show exact effects
        const effects: string[] = [];
        const eff = opt.effects ?? {};
        if (eff.money) effects.push(`${eff.money > 0 ? '+' : ''}$${eff.money}`);
        if (eff.reputation) effects.push(`${eff.reputation > 0 ? '+' : ''}${eff.reputation} rep`);
        if (eff.socialHeat) effects.push(`${eff.socialHeat > 0 ? '+' : ''}${eff.socialHeat} heat`);
        btn.innerHTML = `${opt.label}${effects.length > 0 ? ` <span style="color:#aaa;font-size:9px">(${effects.join(', ')})</span>` : ''}`;
      }

      btn.addEventListener('click', () => {
        this.store.dispatch(resolveStory(opt.id));
        this.saveSystem.save();
        if (opt.outcomes && opt.outcomes.length > 0) {
          this.showToast(`${story.title}: ${opt.label} — outcome pending...`, 'event');
        } else {
          this.showToast(`${story.title}: ${opt.label}`, 'event');
        }
      });
      optionsEl.appendChild(btn);
    }
  }

  // ── Contracts Panel ────────────────────────────────────────────────

  private updateContractsPanel(): void {
    const s = this.store.getState();

    const contractKey = s.contracts.map(c => `${c.id}:${c.status}:${c.progressDays}`).join(',');
    if (contractKey === this.lastContractKey) return;
    this.lastContractKey = contractKey;

    const active = s.contracts.filter(c => c.status === 'active' || c.status === 'available').length;
    this.el('contracts-summary').textContent = active > 0 ? `${active} active` : 'none';

    const list = this.el('contracts-list');
    list.innerHTML = '';

    if (s.contracts.length === 0) {
      list.innerHTML = '<div style="font-size:9px;color:#636e72;padding:4px">No contracts available yet. Keep playing!</div>';
      return;
    }

    for (const c of s.contracts) {
      const div = document.createElement('div');
      div.className = `contract-item ${c.status}`;
      const progressBar = c.status === 'active'
        ? `<div class="contract-progress">
             <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${Math.round(c.progressDays / c.durationDays * 100)}%;background:#a29bfe"></div></div>
             <span style="font-size:8px;color:#aaa">${c.progressDays}/${c.durationDays}d</span>
           </div>`
        : '';
      const reward = [];
      if (c.reward.money) reward.push(`+$${c.reward.money}`);
      if (c.reward.reputation) reward.push(`+${c.reward.reputation} rep`);

      div.innerHTML = `
        <div class="contract-title">${c.title}</div>
        <div class="contract-desc">${c.description}</div>
        <div style="font-size:8px;color:#55efc4">${reward.join(' · ')}</div>
        ${progressBar}
        ${c.status === 'available' ? `
          <div style="margin-top:3px">
            <button class="contract-btn accept" data-contract="${c.id}">Accept</button>
            <button class="contract-btn decline" data-contract="${c.id}">Decline</button>
          </div>
        ` : ''}
        ${c.status === 'completed' ? '<div style="font-size:8px;color:#55efc4;margin-top:2px">Completed!</div>' : ''}
        ${c.status === 'failed' ? '<div style="font-size:8px;color:#ff6b6b;margin-top:2px">Failed</div>' : ''}
      `;
      list.appendChild(div);
    }

    list.querySelectorAll('.contract-btn.accept').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.contract!;
        this.store.dispatch(acceptContract(id));
        this.saveSystem.save();
        this.showToast('Contract accepted!', 'success');
      });
    });

    list.querySelectorAll('.contract-btn.decline').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).dataset.contract!;
        this.store.dispatch(declineContract(id));
        this.saveSystem.save();
      });
    });
  }

  // ── Day Pass Controls ──────────────────────────────────────────────

  private updateDayPassUI(): void {
    const state = this.store.getState();
    const toggleBtn = this.el('btn-daypass-toggle') as HTMLButtonElement;
    toggleBtn.textContent = state.dayPassEnabled ? 'ON' : 'OFF';
    toggleBtn.className = `daypass-toggle ${state.dayPassEnabled ? 'on' : ''}`;

    const priceInput = this.el('daypass-price-input') as HTMLInputElement;
    priceInput.value = state.dayPassPrice.toString();
  }

  // ── Loan Panel ────────────────────────────────────────────────────

  private static readonly LOAN_OPTIONS = [
    { name: 'Small Loan', amount: 1500, interestRate: 0.01, term: 30, desc: '$1,500 at 1%/day, 30 days' },
    { name: 'Medium Loan', amount: 5000, interestRate: 0.008, term: 60, desc: '$5,000 at 0.8%/day, 60 days' },
    { name: 'Large Loan', amount: 10000, interestRate: 0.005, term: 90, desc: '$10,000 at 0.5%/day, 90 days' },
  ];

  private updateLoanUI(): void {
    const state = this.store.getState();

    // Only rebuild DOM when loan data actually changes
    const loanKey = `${state.loans.length}:${state.loans.map(l => `${l.id}-${Math.round(l.remaining)}`).join(',')}:${state.money}`;
    if (loanKey === this.lastLoanKey) return;
    this.lastLoanKey = loanKey;

    const listEl = this.el('loan-list');
    const optionsEl = this.el('loan-options');

    listEl.innerHTML = '';

    // Show debt warning if in debt
    if (state.money < 0) {
      const warning = document.createElement('div');
      warning.className = 'debt-warning';
      warning.textContent = `⚠ IN DEBT: $${Math.abs(state.money)} — sell buildings or take a loan!`;
      listEl.appendChild(warning);
    }

    // Show existing loans
    for (const loan of state.loans) {
      const div = document.createElement('div');
      div.className = 'loan-item';
      const daysLeft = loan.daysRemaining ?? '?';
      const dailyPmt = loan.dailyPayment ?? loan.dailyInterest;
      div.innerHTML = `
        <div class="loan-name">${loan.name}</div>
        <div class="loan-details">
          Owed: $${Math.round(loan.remaining)} / $${loan.principal}<br>
          Payment: $${dailyPmt}/day &middot; ${daysLeft} days left
        </div>
        <button class="loan-repay-btn" data-loan="${loan.id}" ${state.money <= 0 ? 'disabled' : ''}>
          Repay ${state.money >= loan.remaining ? 'Full' : 'Partial'} ($${Math.min(Math.max(0, state.money), Math.round(loan.remaining))})
        </button>
      `;
      listEl.appendChild(div);
    }

    // Bind repay buttons
    listEl.querySelectorAll('.loan-repay-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const loanId = parseInt((btn as HTMLElement).dataset.loan!);
        this.store.dispatch(repayLoan(loanId));
        this.saveSystem.save();
        this.showToast('Loan payment made!', 'success');
      });
    });

    // Show loan options
    optionsEl.innerHTML = '';
    const totalDebt = getTotalDebt(state);
    const canTakeMore = state.loans.length < 3;

    if (canTakeMore) {
      for (const opt of UIManager.LOAN_OPTIONS) {
        const btn = document.createElement('button');
        btn.className = 'loan-take-btn';
        btn.textContent = `💰 ${opt.desc}`;
        btn.disabled = !canTakeMore;
        btn.addEventListener('click', () => {
          this.store.dispatch(takeLoan(opt.name, opt.amount, opt.interestRate, opt.term));
          this.saveSystem.save();
          this.showToast(`${opt.name} taken! +$${opt.amount}`, 'success');
        });
        optionsEl.appendChild(btn);
      }
    } else {
      const msg = document.createElement('div');
      msg.style.cssText = 'font-size:9px;color:#636e72;padding:4px 0';
      msg.textContent = 'Max 3 loans. Repay existing loans first.';
      optionsEl.appendChild(msg);
    }

    if (totalDebt > 0) {
      const summary = document.createElement('div');
      summary.style.cssText = 'font-size:9px;color:#ffa502;margin-top:4px;padding-top:4px;border-top:1px solid #333';
      summary.textContent = `Total debt: $${Math.round(totalDebt)} · Interest: $${getDailyInterest(state)}/day`;
      optionsEl.appendChild(summary);
    }
  }

  // ── Event Bindings ─────────────────────────────────────────────────

  private bindEvents(): void {
    document.querySelectorAll('.speed-btn[data-speed]').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseInt((btn as HTMLElement).dataset.speed ?? '1') as GameSpeed;
        this.store.dispatch(setSpeed(speed));
      });
    });

    // Zoom buttons
    this.el('btn-zoom-in').addEventListener('click', () => {
      const z = this.store.getState().camera.zoom || 1;
      this.store.dispatch(setZoom(z + 0.1));
    });
    this.el('btn-zoom-out').addEventListener('click', () => {
      const z = this.store.getState().camera.zoom || 1;
      this.store.dispatch(setZoom(z - 0.1));
    });

    // Reputation breakdown toggle
    const repLabel = document.getElementById('hud-rep-label');
    if (repLabel) {
      repLabel.addEventListener('click', () => {
        const bd = document.getElementById('hud-rep-breakdown');
        const toggle = document.getElementById('hud-rep-toggle');
        if (bd) {
          const isHidden = bd.style.display === 'none';
          bd.style.display = isHidden ? 'block' : 'none';
          if (toggle) toggle.textContent = isHidden ? '▲' : '▼';
        }
      });
    }

    this.el('btn-cancel').addEventListener('click', () => {
      this.store.dispatch(setBuildMode(null));
      this.resetBinButton();
      const pathBtn = this.el('btn-build-path') as HTMLButtonElement;
      pathBtn.style.background = '#bfbfaa';
      pathBtn.textContent = '🛤 BUILD PATH ($1)';
    });

    this.el('btn-next-day').addEventListener('click', () => {
      this.economySystem.advanceDay();
      this.saveSystem.save();
    });

    this.el('btn-reset').addEventListener('click', () => {
      if (confirm('Reset the game? All progress will be lost.')) {
        this.saveSystem.clear();
        this.store.dispatch(resetGame());
        this.showToast('Game reset!', 'success');
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const state = this.store.getState();
      const pos = this.renderer.screenToGrid(e.clientX, e.clientY, state.camera);
      if (pos.x >= 0 && pos.x < state.grid.width && pos.y >= 0 && pos.y < state.grid.height) {
        this.store.dispatch(setHoveredTile(pos));
      } else {
        this.store.dispatch(setHoveredTile(null));
      }
    });

    this.canvas.addEventListener('mouseleave', () => this.store.dispatch(setHoveredTile(null)));

    // Keyboard panning (WASD / Arrow keys) and zoom (+/-)
    const BASE_PAN_SPEED = 20;
    document.addEventListener('keydown', (e) => {
      const state = this.store.getState();
      const currentZoom = state.camera.zoom || 1;
      const panSpeed = BASE_PAN_SPEED / currentZoom;
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A':
          this.store.dispatch(panCamera(-panSpeed, 0)); break;
        case 'ArrowRight': case 'd': case 'D':
          this.store.dispatch(panCamera(panSpeed, 0)); break;
        case 'ArrowUp': case 'w': case 'W':
          this.store.dispatch(panCamera(0, -panSpeed)); break;
        case 'ArrowDown': case 's': case 'S':
          this.store.dispatch(panCamera(0, panSpeed)); break;
        case '+': case '=':
          this.store.dispatch(setZoom(currentZoom + 0.1)); break;
        case '-': case '_':
          this.store.dispatch(setZoom(currentZoom - 0.1)); break;
      }
    });

    // Right-click or middle-click drag panning
    let isPanning = false;
    let panStartX = 0, panStartY = 0;
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2 || e.button === 1) {
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        e.preventDefault();
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      const currentZoom = this.store.getState().camera.zoom || 1;
      const dx = (panStartX - e.clientX) / currentZoom;
      const dy = (panStartY - e.clientY) / currentZoom;
      panStartX = e.clientX;
      panStartY = e.clientY;
      this.store.dispatch(panCamera(dx, dy));
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 2 || e.button === 1) isPanning = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // Prevent default middle-click auto-scroll behavior
    this.canvas.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

    // Mouse wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const state = this.store.getState();
      const currentZoom = state.camera.zoom || 1;
      const zoomDelta = e.deltaY < 0 ? 0.1 : -0.1;
      const newZoom = currentZoom + zoomDelta;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const centerX = (e.clientX - rect.left) * scaleX;
      const centerY = (e.clientY - rect.top) * scaleY;
      this.store.dispatch(setZoom(newZoom, centerX, centerY));
    }, { passive: false });

    this.canvas.addEventListener('click', (e) => {
      const state = this.store.getState();
      const pos = this.renderer.screenToGrid(e.clientX, e.clientY, state.camera);

      // Buy land mode
      if (this.buyLandMode) {
        const tile = state.grid.tiles[pos.y]?.[pos.x];
        if (tile && tile.type === 'unowned') {
          this.store.dispatch(buyLand(pos.x, pos.y));
          const afterState = this.store.getState();
          if (afterState.money < state.money) {
            this.saveSystem.save();
            this.showToast('Land purchased!', 'success');
          } else {
            this.showToast('Cannot buy this land (not enough money or invalid)', 'error');
          }
        } else {
          this.showToast('Click on greyed-out unowned land to buy', 'error');
        }
        return;
      }

      if (state.buildMode === 'path') {
        const tile = state.grid.tiles[pos.y]?.[pos.x];
        if (tile && (tile.type === 'sand' || tile.type === 'beach_sand') && state.money >= 1) {
          this.store.dispatch(placePath(pos.x, pos.y));
          this.saveSystem.save();
        } else if (tile && tile.type === 'path') {
          this.store.dispatch(removePath(pos.x, pos.y));
          this.saveSystem.save();
        }
        return;
      }

      if (state.buildMode === 'bin') {
        const tile = state.grid.tiles[pos.y]?.[pos.x];
        if (tile && (tile.type === 'path' || tile.type === 'beach_sand')) {
          // If already has a bin, remove it
          if (state.trashBins.some(b => b.x === pos.x && b.y === pos.y)) {
            this.store.dispatch(removeTrashBin(pos.x, pos.y));
            this.saveSystem.save();
          } else if (state.money >= 15) {
            this.store.dispatch(placeTrashBin(pos.x, pos.y));
            this.saveSystem.save();
          } else {
            this.showToast('Not enough money! ($15)', 'error');
          }
        } else {
          this.showToast('Bins can be placed on paths or beach', 'error');
        }
        return;
      }

      if (state.buildMode) {
        const def = getBuildingDef(state.buildMode);
        const size = getBuildingSize(state.buildMode);
        const hasMoney = canAffordBuilding(state, state.buildMode);
        if (!hasMoney) { this.showToast('Not enough money!', 'error'); return; }
        if (!isValidPlacement(state.grid, pos.x, pos.y, size.width, size.height, hasMoney, def)) {
          const terrain = def.terrain ?? 'any';
          if (terrain === 'beach') {
            this.showToast('This building can only be placed on the beach!', 'error');
          } else if (terrain === 'land') {
            this.showToast('This building cannot be placed on the beach!', 'error');
          } else {
            this.showToast('Invalid placement!', 'error');
          }
          return;
        }
        this.store.dispatch(placeBuilding(state.buildMode, pos.x, pos.y));
        this.saveSystem.save();
        this.showToast(
          def.constructionDays > 0 ? `${def.name} construction started!` : `${def.name} built!`,
          'success'
        );
      } else {
        // Check staff click first, then guest, then building
        const staffVis = this.renderer.getStaffAtScreen(e.clientX, e.clientY, state.camera);
        if (staffVis) {
          this.store.dispatch(selectStaff(staffVis.id));
        } else {
          const guestId = this.renderer.getGuestAtScreen(e.clientX, e.clientY, state.camera, state.guests);
          if (guestId !== null) {
            this.store.dispatch(selectGuest(guestId));
          } else {
            const tile = state.grid.tiles[pos.y]?.[pos.x];
            if (tile && tile.buildingId !== undefined) {
              this.store.dispatch(selectBuilding(tile.buildingId));
            } else {
              this.store.dispatch(selectBuilding(null));
              if (state.selectedGuest !== null) {
                this.store.dispatch(selectGuest(null));
              }
              if (state.selectedStaff !== null) {
                this.store.dispatch(selectStaff(null));
              }
            }
          }
        }
      }
    });

    this.el('price-slider').addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value) / 10;
      const state = this.store.getState();
      if (state.selectedBuilding !== null) {
        this.store.dispatch(setPrice(state.selectedBuilding, val));
      }
    });

    this.el('btn-demolish').addEventListener('click', () => {
      const state = this.store.getState();
      if (state.selectedBuilding !== null) {
        const b = state.buildings.find(bl => bl.id === state.selectedBuilding);
        if (b && confirm(`Sell ${getBuildingDef(b.type).name}? You get 55% refund ($${Math.floor(getBuildingDef(b.type).cost * 0.55)}).`)) {
          this.store.dispatch(demolishBuilding(state.selectedBuilding));
          this.saveSystem.save();
          this.showToast('Building sold!', 'success');
        }
      }
    });

    this.el('btn-repair').addEventListener('click', () => {
      const state = this.store.getState();
      if (state.selectedBuilding !== null) {
        this.store.dispatch(repairBuilding(state.selectedBuilding));
        this.saveSystem.save();
        this.showToast('Building repaired!', 'success');
      }
    });

    this.el('btn-upgrade').addEventListener('click', () => {
      const state = this.store.getState();
      if (state.selectedBuilding !== null) {
        const b = state.buildings.find(bl => bl.id === state.selectedBuilding);
        if (b) {
          const cost = getUpgradeCost(b.type, b.level);
          if (state.money < cost) {
            this.showToast('Not enough money!', 'error');
            return;
          }
          this.store.dispatch(upgradeBuilding(state.selectedBuilding));
          this.saveSystem.save();
          this.showToast(`${getBuildingDef(b.type).name} upgraded to Lv.${b.level + 1}!`, 'success');
        }
      }
    });

    this.el('btn-close-detail').addEventListener('click', () => {
      this.store.dispatch(selectBuilding(null));
    });

    this.el('btn-close-guest').addEventListener('click', () => {
      this.store.dispatch(selectGuest(null));
    });

    this.el('btn-close-staff').addEventListener('click', () => {
      this.store.dispatch(selectStaff(null));
    });

    // Panel collapse toggles
    this.el('btn-toggle-left').addEventListener('click', () => {
      const panel = this.el('left-panel');
      const btn = this.el('btn-toggle-left');
      panel.classList.toggle('collapsed');
      btn.textContent = panel.classList.contains('collapsed') ? '»' : '«';
    });

    this.el('btn-toggle-right').addEventListener('click', () => {
      const panel = this.el('info-panel');
      const btn = this.el('btn-toggle-right');
      panel.classList.toggle('collapsed');
      btn.textContent = panel.classList.contains('collapsed') ? '«' : '»';
    });

    // Build Path mode
    this.el('btn-build-path').addEventListener('click', () => {
      const state = this.store.getState();
      if (state.buildMode === 'path') {
        this.store.dispatch(setPathMode(false));
        const btn = this.el('btn-build-path') as HTMLButtonElement;
        btn.style.background = '#bfbfaa';
        btn.textContent = '🛤 BUILD PATH ($1)';
      } else {
        this.store.dispatch(setPathMode(true));
        this.buyLandMode = false;
        this.el('buy-land-info').style.display = 'none';
        const landBtn = this.el('btn-buy-land') as HTMLButtonElement;
        landBtn.style.background = '#0984e3';
        landBtn.textContent = '🗺 BUY LAND';
        const btn = this.el('btn-build-path') as HTMLButtonElement;
        btn.style.background = '#d63031';
        btn.textContent = '🛤 BUILDING PATHS... (click to stop)';
        // Reset bin mode
        this.resetBinButton();
      }
    });

    // Trash Bin placement mode
    this.el('btn-place-bin').addEventListener('click', () => {
      const state = this.store.getState();
      if (state.buildMode === 'bin') {
        this.store.dispatch(setBuildMode(null));
        this.resetBinButton();
      } else {
        this.store.dispatch(setBuildMode('bin'));
        this.buyLandMode = false;
        this.el('buy-land-info').style.display = 'none';
        const landBtn = this.el('btn-buy-land') as HTMLButtonElement;
        landBtn.style.background = '#0984e3';
        landBtn.textContent = '🗺 BUY LAND';
        // Reset path mode button
        const pathBtn = this.el('btn-build-path') as HTMLButtonElement;
        pathBtn.style.background = '#bfbfaa';
        pathBtn.textContent = '🛤 BUILD PATH ($1)';
        // Activate bin button
        const btn = this.el('btn-place-bin') as HTMLButtonElement;
        btn.style.background = '#d63031';
        btn.textContent = '🗑 PLACING BINS... (click to stop)';
      }
    });

    // Buy Land mode
    this.el('btn-buy-land').addEventListener('click', () => {
      this.buyLandMode = !this.buyLandMode;
      const info = this.el('buy-land-info');
      const btn = this.el('btn-buy-land') as HTMLButtonElement;
      if (this.buyLandMode) {
        info.style.display = 'block';
        btn.style.background = '#d63031';
        btn.textContent = 'BUYING LAND...';
        this.store.dispatch(setBuildMode(null));
        // Reset path mode
        const pathBtn = this.el('btn-build-path') as HTMLButtonElement;
        pathBtn.style.background = '#bfbfaa';
        pathBtn.textContent = '🛤 BUILD PATH ($1)';
        // Reset bin mode
        this.resetBinButton();
      } else {
        info.style.display = 'none';
        btn.style.background = '#0984e3';
        btn.textContent = '🗺 BUY LAND';
      }
    });
    this.el('btn-cancel-land').addEventListener('click', () => {
      this.buyLandMode = false;
      this.el('buy-land-info').style.display = 'none';
      const btn = this.el('btn-buy-land') as HTMLButtonElement;
      btn.style.background = '#0984e3';
      btn.textContent = '🗺 BUY LAND';
    });

    // Day Pass controls
    this.el('btn-daypass-toggle').addEventListener('click', () => {
      this.store.dispatch(toggleDayPass());
      this.saveSystem.save();
      const state = this.store.getState();
      this.showToast(state.dayPassEnabled ? 'Day Pass enabled!' : 'Day Pass disabled', 'success');
    });

    this.el('daypass-price-input').addEventListener('change', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value) || 5;
      this.store.dispatch(setDayPassPrice(val));
      this.saveSystem.save();
    });

    // Staff controls — hire/fire for all 6 roles + salary sliders
    const staffRoles: Array<{ role: import('../state/types').StaffRole; hireBtn: string; fireBtn: string; slider: string }> = [
      { role: 'cleaners',   hireBtn: 'btn-hire-cleaner',   fireBtn: 'btn-fire-cleaner',   slider: 'slider-cleaner' },
      { role: 'animators',  hireBtn: 'btn-hire-animator',  fireBtn: 'btn-fire-animator',  slider: 'slider-animator' },
      { role: 'builders',   hireBtn: 'btn-hire-builder',   fireBtn: 'btn-fire-builder',   slider: 'slider-builder' },
      { role: 'mechanics',  hireBtn: 'btn-hire-mechanic',  fireBtn: 'btn-fire-mechanic',  slider: 'slider-mechanic' },
      { role: 'lifeguards', hireBtn: 'btn-hire-lifeguard', fireBtn: 'btn-fire-lifeguard', slider: 'slider-lifeguard' },
      { role: 'security',   hireBtn: 'btn-hire-security',  fireBtn: 'btn-fire-security',  slider: 'slider-security' },
    ];
    const STAFF_BUILDING_REQS: Record<string, string> = {
      cleaners: 'Cleaners Shack', animators: 'Entertainment building',
      builders: 'Handyman Shack', mechanics: 'Handyman Shack',
      lifeguards: 'Baywatch Tower', security: 'Security Post',
    };
    for (const { role, hireBtn, fireBtn, slider } of staffRoles) {
      this.el(hireBtn).addEventListener('click', () => {
        const staffBefore = this.store.getState().staff;
        const before = staffBefore[role as keyof typeof staffBefore];
        this.store.dispatch(hireStaff(role));
        const staffAfter = this.store.getState().staff;
        const after = staffAfter[role as keyof typeof staffAfter];
        if (before === after) {
          const req = STAFF_BUILDING_REQS[role];
          if (req) this.showToast(`Build a ${req} first to hire ${role}!`, 'warning');
          else this.showToast(`Cannot hire more ${role}`, 'warning');
        }
        this.saveSystem.save();
      });
      this.el(fireBtn).addEventListener('click', () => {
        this.store.dispatch(fireStaff(role));
        this.saveSystem.save();
      });
      this.el(slider).addEventListener('input', (e) => {
        const val = parseInt((e.target as HTMLInputElement).value);
        this.store.dispatch(setSalary(role, val));
        this.saveSystem.save();
      });
    }
  }

  // ── UI Update ──────────────────────────────────────────────────────

  updateUI(): void {
    const s = this.store.getState();
    const summary = getGuestSummary(s);

    this.checkTutorialTriggers();

    // 4 core HUD metrics
    const starTier = getStarTier(s.reputation);
    this.el('hud-reputation').textContent = s.reputation.toString();
    (this.el('hud-rep-bar') as HTMLElement).style.width = `${s.reputation}%`;
    const repColor = s.reputation >= 60 ? '#55efc4' : s.reputation >= 35 ? '#ffeaa7' : '#ff6b6b';
    (this.el('hud-rep-bar') as HTMLElement).style.background = repColor;
    this.el('hud-star-tier').textContent = '★'.repeat(starTier) + starTier;

    // Reputation breakdown bars
    if (s.reputationBreakdown) {
      const rb = s.reputationBreakdown;
      const components: Array<{ key: string; val: number }> = [
        { key: 'beauty', val: rb.beauty },
        { key: 'safety', val: rb.safety },
        { key: 'fun', val: rb.fun },
        { key: 'value', val: rb.value },
        { key: 'nightlife', val: rb.nightlife },
        { key: 'cleanliness', val: rb.cleanliness },
        { key: 'foodQuality', val: rb.foodQuality },
      ];
      for (const c of components) {
        const bar = document.getElementById(`rep-${c.key}`);
        const valEl = document.getElementById(`rep-${c.key}-val`);
        if (bar) {
          bar.style.width = `${c.val}%`;
          // Color gradient based on value
          if (c.val >= 60) bar.style.background = '#55efc4';
          else if (c.val >= 40) bar.style.background = '#ffeaa7';
          else if (c.val >= 20) bar.style.background = '#ffa502';
          else bar.style.background = '#ff6b6b';
        }
        if (valEl) valEl.textContent = c.val.toString();
      }
    }

    const occPct = getOccupancyPercent(s);
    this.el('hud-occupancy').textContent = `${occPct}%`;
    (this.el('hud-occ-bar') as HTMLElement).style.width = `${occPct}%`;
    const occColor = occPct > 80 ? '#55efc4' : occPct > 50 ? '#74b9ff' : occPct > 20 ? '#ffeaa7' : '#ff6b6b';
    (this.el('hud-occ-bar') as HTMLElement).style.background = occColor;
    (this.el('hud-occupancy') as HTMLElement).style.color = occColor;

    const exp = getGuestExperience(s);
    this.el('hud-experience').textContent = exp.toString();
    (this.el('hud-exp-bar') as HTMLElement).style.width = `${exp}%`;
    const expColor = exp >= 70 ? '#55efc4' : exp >= 40 ? '#ffeaa7' : '#ff6b6b';
    (this.el('hud-exp-bar') as HTMLElement).style.background = expColor;
    (this.el('hud-experience') as HTMLElement).style.color = expColor;

    this.el('hud-cash').textContent = s.money < 0 ? `-$${Math.abs(s.money)}` : `$${s.money}`;
    (this.el('hud-cash') as HTMLElement).style.color = s.money >= 100 ? '#55efc4' : s.money >= 0 ? '#ffeaa7' : '#ff6b6b';
    const runway = getRunwayDays(s);
    this.el('hud-runway').textContent = runway === Infinity ? '' : `${runway}d left`;

    // Compact HUD
    this.el('hud-day').textContent = `Day ${s.day}`;
    this.el('hud-weather').textContent = `${getWeatherEmoji(s.weather.current)} ${getWeatherLabel(s.weather.current)}`;
    this.el('hud-guests').textContent = `${getGuestCount(s)} guests`;

    const supply = getPowerSupply(s);
    const demand = getPowerDemand(s);
    const powerEl = this.el('hud-power');
    powerEl.textContent = `⚡${demand}/${supply}`;
    powerEl.style.color = demand > supply ? '#ff6b6b' : '#55efc4';

    // Zoom display
    const zoomPct = Math.round((s.camera.zoom || 1) * 100);
    this.el('hud-zoom').textContent = `${zoomPct}%`;

    // Litter count
    const litterCount = s.litter ? s.litter.items.length : 0;
    const litterEl = this.el('hud-litter');
    litterEl.textContent = `🗑 ${litterCount}`;
    litterEl.style.color = litterCount > 30 ? '#ff6b6b' : litterCount > 10 ? '#fdcb6e' : '#aaa';

    document.querySelectorAll('.speed-btn[data-speed]').forEach(btn => {
      const spd = parseInt((btn as HTMLElement).dataset.speed ?? '1');
      btn.classList.toggle('active', spd === s.gameSpeed);
    });

    // Day progress compact header
    this.el('hud-day2').textContent = `Day ${s.day}`;
    this.el('hud-weather2').textContent = `${getWeatherEmoji(s.weather.current)} ${getWeatherLabel(s.weather.current)}`;
    (this.el('day-progress-bar') as HTMLElement).style.width = `${Math.floor(s.dayProgress * 100)}%`;

    // Finance accordion
    this.el('fin-room').textContent = `$${s.finances.roomRevenue}`;
    this.el('fin-resort-fee').textContent = `$${s.finances.resortFeeRevenue}`;
    const todayAnc = s.pendingAncillary;
    const lastAnc = s.finances.ancillaryRevenue;
    this.el('fin-ancillary').textContent = todayAnc > 0
      ? `$${todayAnc} (prev: $${lastAnc})`
      : `$${lastAnc}`;
    this.el('fin-daypass').textContent = `$${s.finances.dayPassRevenue}`;
    this.el('fin-maint').textContent = `-$${s.finances.maintenanceCost - s.finances.staffCost}`;
    this.el('fin-staff').textContent = s.finances.staffCost > 0 ? `-$${s.finances.staffCost}` : '$0';
    const totalStaff = s.staff.cleaners + s.staff.animators + s.staff.builders + s.staff.mechanics + s.staff.lifeguards + s.staff.security;
    this.el('fin-staff-row').style.display = totalStaff > 0 ? '' : 'none';
    this.el('fin-interest').textContent = s.finances.loanInterest > 0 ? `-$${s.finances.loanInterest}` : '$0';
    this.el('fin-interest-row').style.display = s.loans.length > 0 ? '' : 'none';
    const net = s.finances.netIncome;
    this.el('fin-net').textContent = `${net >= 0 ? '+' : ''}$${net}`;
    this.el('fin-net').className = `value ${net >= 0 ? 'positive' : 'negative'}`;
    // Summary in header
    const finSummary = this.el('fin-net-summary');
    finSummary.textContent = `${net >= 0 ? '+' : ''}$${net}/d`;
    finSummary.style.color = net >= 0 ? '#55efc4' : '#ff6b6b';

    // Star tier finance info
    this.el('fin-star-tier').textContent = '★'.repeat(starTier) + ' ' + starTier;
    this.el('fin-maint-mult').textContent = getMaintenanceMult(s.reputation).toFixed(2);
    this.el('fin-room-mult').textContent = getRoomPriceMult(s.reputation).toFixed(1);

    // Revenue split bar
    const rbr = s.finances.revenueByRole;
    if (rbr) {
      const totalRev = rbr.rooms + rbr.ancillary + rbr.amenities;
      if (totalRev > 0) {
        const roomPct = Math.round((rbr.rooms / totalRev) * 100);
        const ancPct = Math.round((rbr.ancillary / totalRev) * 100);
        const amenPct = 100 - roomPct - ancPct;
        (this.el('rev-bar-rooms') as HTMLElement).style.width = `${roomPct}%`;
        (this.el('rev-bar-ancillary') as HTMLElement).style.width = `${ancPct}%`;
        (this.el('rev-bar-amenities') as HTMLElement).style.width = `${amenPct}%`;
        this.el('rev-pct-rooms').textContent = `${roomPct}%`;
        this.el('rev-pct-ancillary').textContent = `${ancPct}%`;
        this.el('rev-pct-amenities').textContent = `${amenPct}%`;
      }
    }

    // Guests accordion
    this.el('info-guest-count').textContent = summary.count.toString();
    this.el('info-happiness').textContent = summary.count > 0 ? `${summary.avgHappiness}%` : '-';
    this.el('info-top-need').textContent = summary.topNeed ?? '-';
    this.el('info-visiting').textContent = summary.visitingCount.toString();
    this.el('info-served').textContent = s.totalGuestsServed.toString();

    // New economic model stats
    const extendedCount = s.guests.filter(g => g.stayBonusApplied > 0).length;
    const upgradedCount = s.guests.filter(g => g.packageUpgraded).length;
    this.el('info-stay-extended').textContent = extendedCount.toString();
    this.el('info-pkg-upgraded').textContent = upgradedCount.toString();
    if (s.guests.length > 0) {
      const avgBonus = s.guests.reduce((sum, g) => sum + g.stayBonusApplied, 0) / s.guests.length;
      this.el('info-avg-stay-bonus').textContent = avgBonus > 0 ? `+${avgBonus.toFixed(1)}d` : '-';
    } else {
      this.el('info-avg-stay-bonus').textContent = '-';
    }

    const guestsSummary = summary.count > 0 ? `${summary.count} · 😊${summary.avgHappiness}%` : '0';
    this.el('guests-summary').textContent = guestsSummary;

    // Arrival factors — show what influences guest flow
    this.updateArrivalFactors(s);

    // Resort accordion
    this.el('info-buildings').textContent = s.buildings.length.toString();
    this.el('info-constructing').textContent = s.buildings.filter(b => b.isConstructing).length.toString();
    const accomCap = getAccommodationCapacity(s);
    this.el('info-accom-slots').textContent = accomCap.toString();
    this.el('info-occupancy').textContent = `${occPct}%`;
    this.el('resort-summary').textContent = `${s.buildings.length} bldg · ⚡${demand}/${supply}`;

    // Loans section: always visible, summary updates
    const totalDebtVal = getTotalDebt(s);
    this.el('loans-summary').textContent = totalDebtVal > 0 ? `$${Math.round(totalDebtVal)} owed` : 'Available';
    (this.el('loans-summary') as HTMLElement).style.color = totalDebtVal > 0 ? '#ffa502' : '#55efc4';

    (this.el('btn-cancel') as HTMLButtonElement).disabled = s.buildMode === null;

    if (s.buildMode === 'path') {
      this.el('status-text').textContent = 'Building paths — Click sand/beach to place, click path to remove';
    } else if (s.buildMode === 'bin') {
      this.el('status-text').textContent = 'Placing bins — Click path/beach to place, click existing bin to remove';
    } else if (s.buildMode) {
      const def = getBuildingDef(s.buildMode);
      const terrainHint = def.terrain === 'beach' ? ' [Beach only]' : def.terrain === 'land' ? ' [Land only]' : '';
      this.el('status-text').textContent = `Placing: ${def.name} (${def.width}x${def.height})${terrainHint} — Click to build`;
    } else if (s.selectedBuilding !== null) {
      this.el('status-text').textContent = 'Building selected — adjust settings or close';
    } else if (s.selectedGuest !== null) {
      this.el('status-text').textContent = 'Guest selected — view thoughts and needs';
    } else {
      this.el('status-text').textContent = s.gameSpeed === 0 ? 'PAUSED' : 'Click a building or guest to inspect';
    }

    if (this.panelBuilt) this.updateBuildItemStates();
    this.updateBuildingDetail();
    this.updateGuestDetail();
    this.updateStaffDetail();
    this.updateMissionsPanel();
    this.updateEventsPanel();
    this.updateSegmentLegend();
    this.updateDayPassUI();
    this.updateLoanUI();
    this.updateStaffPanel();
    this.updateReviewsPanel();
    this.updateDailyReport();
    this.updateStoryModal();
    this.updateContractsPanel();
    this.updateMarketingPanel();
  }

  // ── Marketing Panel ───────────────────────────────────────────────

  private updateMarketingPanel(): void {
    const s = this.store.getState();
    const activeEl = document.getElementById('marketing-active');
    const availEl = document.getElementById('marketing-available');
    const summaryEl = document.getElementById('marketing-summary');
    if (!activeEl || !availEl || !summaryEl) return;

    const activeCampaigns = s.marketing;
    const totalBonus = activeCampaigns.reduce((sum, c) => {
      const def = getCampaignDef(c.campaignId);
      return sum + (def?.guestBonus ?? 0);
    }, 0);

    summaryEl.textContent = activeCampaigns.length > 0
      ? `${activeCampaigns.length} active (+${totalBonus}/day)`
      : '0 active';
    (summaryEl as HTMLElement).style.color = activeCampaigns.length > 0 ? '#55efc4' : '#aaa';

    // Active campaigns
    if (activeCampaigns.length > 0) {
      let html = `<div class="marketing-active-total">Active boost: +${totalBonus} guests/day</div>`;
      for (const ac of activeCampaigns) {
        const def = getCampaignDef(ac.campaignId);
        if (!def) continue;
        html += `<div class="campaign-card active-campaign">
          <div><span class="campaign-name">${def.name}</span>
          <div class="campaign-stats">+${def.guestBonus}/day · ${ac.daysRemaining}d left${def.revenueMultiplier ? ' · Room rev ×' + def.revenueMultiplier : ''}</div></div>
          <span style="color:#55efc4;font-size:10px">▶</span>
        </div>`;
      }
      activeEl.innerHTML = html;
    } else {
      activeEl.innerHTML = '<div style="font-size:9px;color:#636e72;padding:4px">No active campaigns. Run ads to attract guests!</div>';
    }

    // Available campaigns
    let avHtml = '';
    for (const def of MARKETING_CAMPAIGNS) {
      const isActive = activeCampaigns.some(c => c.campaignId === def.id);
      const canAfford = s.money >= def.cost;
      const repOk = !def.minReputation || s.reputation >= def.minReputation;
      const hotelOk = !def.requiresHotel || s.buildings.some(b => b.type === 'hotel' && !b.isConstructing);
      const unlocked = repOk && hotelOk;
      const canLaunch = !isActive && canAfford && unlocked;

      let lockReason = '';
      if (!repOk) lockReason = `Rep ${def.minReputation}`;
      else if (!hotelOk) lockReason = 'Need Hotel';

      avHtml += `<div class="campaign-card${!unlocked ? ' locked' : ''}">
        <div>
          <span class="campaign-name">${def.name}</span>
          <div class="campaign-stats">$${def.cost} · +${def.guestBonus}/day · ${def.durationDays}d${def.revenueMultiplier ? ' · Rev ×' + def.revenueMultiplier : ''}${def.socialHeatBonus ? ' · Heat +' + def.socialHeatBonus : ''}${def.reputationBonus ? ' · Rep +' + def.reputationBonus : ''}</div>
        </div>
        ${isActive
          ? '<span style="color:#55efc4;font-size:8px;font-weight:700">ACTIVE</span>'
          : !unlocked
            ? `<span style="color:#ff6b6b;font-size:8px">🔒 ${lockReason}</span>`
            : `<button class="campaign-btn launch" data-campaign="${def.id}"${!canLaunch ? ' disabled' : ''}>Launch</button>`
        }
      </div>`;
    }
    availEl.innerHTML = avHtml;

    // Attach launch button handlers
    availEl.querySelectorAll('.campaign-btn.launch').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const campaignId = (e.currentTarget as HTMLElement).getAttribute('data-campaign');
        if (campaignId) {
          this.store.dispatch(startCampaign(campaignId));
        }
      });
    });
  }

  // ── Leaderboard ──────────────────────────────────────────────────

  private setupLeaderboard(): void {
    this.el('btn-leaderboard').addEventListener('click', () => this.openLeaderboard());
    this.el('lb-close').addEventListener('click', () => this.closeLeaderboard());
    this.el('leaderboard-overlay').addEventListener('click', (e) => {
      if (e.target === this.el('leaderboard-overlay')) this.closeLeaderboard();
    });
    this.el('lb-submit-btn').addEventListener('click', () => this.submitScore());
  }

  private async openLeaderboard(): Promise<void> {
    this.el('leaderboard-overlay').style.display = 'flex';
    this.el('lb-loading').style.display = 'block';
    this.el('lb-table').style.display = 'none';

    const user = (window as any).__suncoast_user;
    if (user) {
      (this.el('lb-name') as HTMLInputElement).value = user.name;
      (this.el('lb-name') as HTMLInputElement).disabled = true;
    }

    try {
      const resp = await fetch('/api/leaderboard');
      const entries = await resp.json();
      this.renderLeaderboard(entries);
    } catch {
      this.el('lb-loading').textContent = 'Could not load leaderboard';
    }
  }

  private closeLeaderboard(): void {
    this.el('leaderboard-overlay').style.display = 'none';
  }

  private renderLeaderboard(entries: any[]): void {
    this.el('lb-loading').style.display = 'none';
    this.el('lb-table').style.display = 'table';

    const body = this.el('lb-body');
    if (entries.length === 0) {
      body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#636e72;padding:20px">No scores yet. Be the first!</td></tr>';
      return;
    }

    body.innerHTML = entries.map((e: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td style="font-weight:600">${e.picture ? `<img src="${e.picture}" style="width:16px;height:16px;border-radius:50%;vertical-align:middle;margin-right:4px">` : ''}${e.name}</td>
        <td style="color:#fdcb6e">${'★'.repeat(e.stars)}</td>
        <td>${e.reputation}</td>
        <td>${e.day}</td>
        <td style="color:#55efc4">$${(e.totalEarned || 0).toLocaleString()}</td>
      </tr>
    `).join('');
  }

  private async submitScore(): Promise<void> {
    const jwt = localStorage.getItem('suncoast_jwt');
    if (!jwt) {
      this.el('lb-submit-status').textContent = 'Not signed in';
      return;
    }

    const s = this.store.getState();
    const starTier = getStarTier(s.reputation);

    const payload = {
      reputation: s.reputation,
      stars: starTier,
      day: s.day,
      netIncome: s.finances.netIncome,
      totalEarned: s.totalMoneyEarned,
      buildings: s.buildings.filter(b => !b.isConstructing).length,
    };

    this.el('lb-submit-status').textContent = 'Submitting...';

    try {
      const resp = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await resp.json();
      if (result.ok) {
        this.el('lb-submit-status').innerHTML = `<span style="color:#55efc4">Submitted! Rank #${result.rank}</span>`;
        const listResp = await fetch('/api/leaderboard');
        const entries = await listResp.json();
        this.renderLeaderboard(entries);
      } else {
        this.el('lb-submit-status').textContent = result.error || 'Submit failed';
      }
    } catch {
      this.el('lb-submit-status').textContent = 'Network error';
    }
  }

  // ── Analytics Panel ──────────────────────────────────────────────

  private readonly CHATGPT_PROMPT = `You are an expert management consultant and behavioral analyst. I'm going to give you a complete log of my decisions in a resort management simulation game "Suncoast Resort Tycoon".

Each entry in the log contains:
- "action": what I did (e.g. PLACE_BUILDING, TAKE_LOAN, HIRE_STAFF, SET_PRICE, etc.)
- "payload": details of the action
- "ts": timestamp
- "ctx": game state snapshot at decision time (day, money, reputation, guestCount, buildingCount, staffCount, loanDebt, netIncome, weather)

Please analyze my decision-making patterns and provide:

1. **Management Style Profile** — What type of manager am I? (e.g. aggressive growth, conservative, reactive, strategic planner, etc.)

2. **Financial Management** — How well do I manage money? Do I take risks at the right time? Do I price optimally? How do I handle debt?

3. **Strategic Thinking** — What's my building strategy? Do I diversify or specialize? Do I plan ahead or react to problems?

4. **People Management** — How do I handle staffing decisions? Am I over/understaffed? Do I invest in salary?

5. **Crisis Management** — How do I respond to events, bad reviews, and challenges? Am I proactive or reactive?

6. **Key Strengths** — Top 3 management strengths I demonstrated

7. **Areas for Improvement** — Top 3 weaknesses with specific recommendations

8. **Real-World Advice** — Based on these patterns, what should I watch out for if I were managing a real business?

Be specific, reference actual decisions from the log with day numbers. Be honest but constructive. Write in the same language as the user's game name suggests (if unclear, use English).

Here is my decision log (JSON attached):`;

  private setupAnalytics(): void {
    this.el('btn-analytics').addEventListener('click', () => this.openAnalytics());
    this.el('analytics-close').addEventListener('click', () => this.closeAnalytics());
    this.el('analytics-overlay').addEventListener('click', (e) => {
      if (e.target === this.el('analytics-overlay')) this.closeAnalytics();
    });
    this.el('btn-download-log').addEventListener('click', () => this.downloadLog());
    this.el('btn-copy-prompt').addEventListener('click', () => this.copyPrompt());
    this.el('analytics-prompt-preview').textContent = this.CHATGPT_PROMPT;
  }

  private openAnalytics(): void {
    this.el('analytics-overlay').style.display = 'flex';
    this.el('analytics-status').textContent = '';
  }

  private closeAnalytics(): void {
    this.el('analytics-overlay').style.display = 'none';
  }

  private async downloadLog(): Promise<void> {
    const jwt = localStorage.getItem('suncoast_jwt');
    if (!jwt) {
      this.el('analytics-status').textContent = 'Not signed in';
      return;
    }

    this.el('analytics-status').textContent = 'Fetching your logs...';

    try {
      const resp = await fetch('/api/actions?mode=download', {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!resp.ok) {
        this.el('analytics-status').textContent = 'Failed to fetch logs';
        return;
      }
      const data = await resp.json();

      if (!data.entries || data.entries.length === 0) {
        this.el('analytics-status').textContent = 'No actions recorded yet. Play the game first!';
        return;
      }

      const blob = new Blob([JSON.stringify(data.entries, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `suncoast-log-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      this.el('analytics-status').innerHTML = '<span style="color:#55efc4">Log downloaded! (' + data.entries.length + ' actions)</span>';
    } catch {
      this.el('analytics-status').textContent = 'Network error';
    }
  }

  private async copyPrompt(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.CHATGPT_PROMPT);
      this.el('analytics-status').innerHTML = '<span style="color:#55efc4">Prompt copied to clipboard! Now paste it in ChatGPT and attach the JSON file.</span>';
    } catch {
      this.el('analytics-status').textContent = 'Could not copy — try selecting the prompt text manually from Preview below.';
    }
  }

  // ── Tutorial System ────────────────────────────────────────────────

  private tutorialQueue: string[] = [];

  private readonly TUTORIAL_STEPS: Record<string, string> = {
    welcome: '👋 Welcome to Suncoast!\n\nOpen the <b>Build</b> panel on the left and place a <b>Beach Hut</b> to start receiving guests.',
    first_building: '🏗️ Great start!\n\nNow build a <b>Toilet</b> and a <b>food building</b> (BBQ or Kiosk) so your guests can eat and stay comfortable.',
    first_guest: '🧳 Guests are arriving!\n\nClick on a guest to see their needs and happiness. Keep them happy to grow your reputation!',
    low_cash: '💸 Running low on cash?\n\nOpen the <b>Finance</b> panel to take a loan, or check <b>Missions</b> for rewards you can claim.',
  };

  showTutorial(stepId: string): void {
    const state = this.store.getState();
    if (state.tutorialSeen[stepId]) return;
    if (this.tutorialQueue.includes(stepId)) return;
    this.tutorialQueue.push(stepId);
    if (this.tutorialQueue.length === 1) this.displayNextTutorial();
  }

  private displayNextTutorial(): void {
    if (this.tutorialQueue.length === 0) return;
    const stepId = this.tutorialQueue[0];
    const text = this.TUTORIAL_STEPS[stepId];
    if (!text) { this.tutorialQueue.shift(); this.displayNextTutorial(); return; }

    const overlay = this.el('tutorial-overlay');
    const textEl = this.el('tutorial-text');
    const btn = this.el('tutorial-dismiss');

    textEl.innerHTML = text.replace(/\n/g, '<br>');
    overlay.style.display = 'flex';

    const dismiss = () => {
      btn.removeEventListener('click', dismiss);
      overlay.style.display = 'none';
      const s = this.store.getState();
      s.tutorialSeen[stepId] = true;
      this.tutorialQueue.shift();
      if (this.tutorialQueue.length > 0) {
        setTimeout(() => this.displayNextTutorial(), 500);
      }
    };
    btn.addEventListener('click', dismiss);
  }

  checkTutorialTriggers(): void {
    const s = this.store.getState();
    if (Object.keys(s.tutorialSeen).length > 0 && s.tutorialSeen['welcome']) {
      if (s.buildings.length > 0 && !s.tutorialSeen['first_building']) {
        this.showTutorial('first_building');
      }
      if (s.guests.length > 0 && !s.tutorialSeen['first_guest']) {
        this.showTutorial('first_guest');
      }
      if (s.money < 500 && s.day > 2 && !s.tutorialSeen['low_cash']) {
        this.showTutorial('low_cash');
      }
    }
  }

  // ── Toast ──────────────────────────────────────────────────────────

  showToast(message: string, type: 'success' | 'error' | 'event' | 'warning' = 'success'): void {
    const toast = this.el('toast');
    toast.textContent = message;
    toast.className = `show ${type}`;
    if (this.toastTimeout !== null) clearTimeout(this.toastTimeout);
    this.toastTimeout = window.setTimeout(() => {
      toast.classList.remove('show');
      this.toastTimeout = null;
    }, type === 'event' ? 4000 : 2500);
  }
}
