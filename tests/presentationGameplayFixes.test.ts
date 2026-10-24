import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const scene = readFileSync(new URL('../src/game/scenes/FloorScene.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

describe('confirmed presentation gameplay fixes', () => {
  it('routes Tab from an evidence modal directly into the notebook', () => {
    const handlerStart = scene.indexOf('this.notebookToggleKey.on(\'down\'');
    const handlerEnd = scene.indexOf('this.puzzleHintKey', handlerStart);
    const handler = scene.slice(handlerStart, handlerEnd);
    expect(handler).toContain('closeModal();');
    expect(handler).toContain('this.openNotebook();');
    expect(scene).toContain('RECORDED IN NOTEBOOK  ·  OPEN [TAB]');
  });

  it('marks every objective evidence container with the shared subtle marker', () => {
    const searchablesStart = scene.indexOf('private createSearchables(');
    const searchablesEnd = scene.indexOf('\n  private ', searchablesStart + 10);
    const method = scene.slice(searchablesStart, searchablesEnd);
    expect(method).toContain('const isObjectiveEvidence = searchable.objectiveStep !== undefined;');
    expect(method).toContain("'PUZZLE EVIDENCE'");
    expect(method).toContain('isObjectiveEvidence ? evidenceAccent : accent');
  });

  it('projects the authoritative Watcher LOS into presentation warnings', () => {
    expect(scene).toContain('watcherIsCausingCurse(this.watcherExposureState(state))');
    expect(scene).toContain('watcherIndividuallyCausingCurse(this.watcherExposureState(state), enemy)');
    expect(scene).toContain('authoritativeLineOfSight(this.floorData.tiles, state.x, state.y, watcher.x, watcher.y)');
  });

  it('presents the final memory puzzle as a single clear selection flow', () => {
    expect(scene).toContain('SELECT A MEMORY  →  CHOOSE WHERE IT BELONGS  →  CONFIRM');
    expect(scene).toContain('MATCHES CONFIRMED');
    expect(scene).toContain('UP / DOWN  ·  CHANGE MATCHING FLOOR');
    expect(scene).toContain('E  ·  CONFIRM MATCH');
    expect(scene).toContain('MATCH CONFIRMED  ·  UP / DOWN TO REVISE (UNCONFIRMS)');
    expect(scene).toContain('case \'memory\': return \'MATCH EACH MEMORY TO THE FLOOR IT REMEMBERS\';');
  });
});
