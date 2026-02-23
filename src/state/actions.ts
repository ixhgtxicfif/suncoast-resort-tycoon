import { Action, BuildMode, BuildingType, GameSpeed, GameState } from './types';

// ── Loan Actions ────────────────────────────────────────────────────

export const takeLoan = (name: string, amount: number, interestRate: number, term?: number): Action => ({
  type: 'TAKE_LOAN', payload: { name, amount, interestRate, term },
});

export const repayLoan = (loanId: number): Action => ({
  type: 'REPAY_LOAN', payload: loanId,
});

export const setBuildMode = (mode: BuildMode): Action => ({
  type: 'SET_BUILD_MODE', payload: mode,
});

export const setHoveredTile = (tile: { x: number; y: number } | null): Action => ({
  type: 'SET_HOVERED_TILE', payload: tile,
});

export const placeBuilding = (buildingType: BuildingType, x: number, y: number): Action => ({
  type: 'PLACE_BUILDING', payload: { buildingType, x, y },
});

export const setSpeed = (speed: GameSpeed): Action => ({
  type: 'SET_SPEED', payload: speed,
});

export const tickDay = (deltaProgress: number): Action => ({
  type: 'TICK_DAY', payload: { deltaProgress },
});

export const selectBuilding = (id: number | null): Action => ({
  type: 'SELECT_BUILDING', payload: id,
});

export const selectGuest = (id: number | null): Action => ({
  type: 'SELECT_GUEST', payload: id,
});

export const selectStaff = (id: number | null): Action => ({
  type: 'SELECT_STAFF', payload: id,
});

export const setPrice = (buildingId: number, multiplier: number): Action => ({
  type: 'SET_PRICE', payload: { buildingId, multiplier },
});

export const setPackagePrice = (buildingId: number, packageId: string, price: number): Action => ({
  type: 'SET_PACKAGE_PRICE', payload: { buildingId, packageId, price },
});

export const togglePackage = (buildingId: number, packageId: string): Action => ({
  type: 'TOGGLE_PACKAGE', payload: { buildingId, packageId },
});

export const setDayPassPrice = (price: number): Action => ({
  type: 'SET_DAYPASS_PRICE', payload: price,
});

export const toggleDayPass = (): Action => ({
  type: 'TOGGLE_DAYPASS',
});

export const demolishBuilding = (buildingId: number): Action => ({
  type: 'DEMOLISH_BUILDING', payload: buildingId,
});

export const repairBuilding = (buildingId: number): Action => ({
  type: 'REPAIR_BUILDING', payload: buildingId,
});

export const upgradeBuilding = (buildingId: number): Action => ({
  type: 'UPGRADE_BUILDING', payload: buildingId,
});

export const toggleOffering = (buildingId: number, offeringId: string): Action => ({
  type: 'TOGGLE_OFFERING', payload: { buildingId, offeringId },
});

export const claimMission = (missionId: string): Action => ({
  type: 'CLAIM_MISSION', payload: missionId,
});

export const dismissEvent = (eventDay: number): Action => ({
  type: 'DISMISS_EVENT', payload: eventDay,
});

export const resetGame = (): Action => ({
  type: 'RESET_GAME',
});

export const loadState = (state: GameState): Action => ({
  type: 'LOAD_STATE', payload: state,
});

export const respondReview = (reviewId: number, responseType: 'respond' | 'compensate' | 'ignore'): Action => ({
  type: 'RESPOND_REVIEW', payload: { reviewId, responseType },
});

export const hireStaff = (role: import('./types').StaffRole): Action => ({
  type: 'HIRE_STAFF', payload: { role },
});

export const fireStaff = (role: import('./types').StaffRole): Action => ({
  type: 'FIRE_STAFF', payload: { role },
});

export const setSalary = (role: import('./types').StaffRole, salary: number): Action => ({
  type: 'SET_SALARY', payload: { role, salary },
});

export const resolveStory = (optionId: string): Action => ({
  type: 'RESOLVE_STORY', payload: { optionId },
});

export const acceptContract = (contractId: string): Action => ({
  type: 'ACCEPT_CONTRACT', payload: contractId,
});

export const declineContract = (contractId: string): Action => ({
  type: 'DECLINE_CONTRACT', payload: contractId,
});

export const buyLand = (x: number, y: number): Action => ({
  type: 'BUY_LAND', payload: { x, y },
});

export const sellLand = (x: number, y: number): Action => ({
  type: 'SELL_LAND', payload: { x, y },
});

export const panCamera = (dx: number, dy: number): Action => ({
  type: 'PAN_CAMERA', payload: { dx, dy },
});

export const setZoom = (zoom: number, centerX?: number, centerY?: number): Action => ({
  type: 'SET_ZOOM', payload: { zoom, centerX, centerY },
});

export const startCampaign = (campaignId: string): Action => ({
  type: 'START_CAMPAIGN', payload: campaignId,
});

export const placePath = (x: number, y: number): Action => ({
  type: 'PLACE_PATH', payload: { x, y },
});

export const removePath = (x: number, y: number): Action => ({
  type: 'REMOVE_PATH', payload: { x, y },
});

export const setPathMode = (enabled: boolean): Action => ({
  type: 'SET_PATH_MODE', payload: enabled,
});

export const placeTrashBin = (x: number, y: number): Action => ({
  type: 'PLACE_TRASH_BIN', payload: { x, y },
});

export const removeTrashBin = (x: number, y: number): Action => ({
  type: 'REMOVE_TRASH_BIN', payload: { x, y },
});

export const setEventProgram = (buildingId: number, eventType: import('./types').EventProgramType | null): Action => ({
  type: 'SET_EVENT_PROGRAM', payload: { buildingId, eventType },
});
