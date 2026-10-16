import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sceneSourceUrl = new URL('../src/game/scenes/FloorScene.ts', import.meta.url);

describe('FloorScene restart lifecycle', () => {
  it('recreates HUD resources before the first status update in create()', async () => {
    const source = await readFile(fileURLToPath(sceneSourceUrl), 'utf8');
    const createStart = source.indexOf('  create() {');
    const createEnd = source.indexOf('  update(time:', createStart);
    const createBody = source.slice(createStart, createEnd);

    const firstStatusUpdate = createBody.indexOf('this.updateStatusText();');
    expect(firstStatusUpdate).toBeGreaterThan(-1);
    expect(createBody.indexOf('this.healthBarText = this.add.text')).toBeLessThan(firstStatusUpdate);
    expect(source).not.toContain('DANGER: ${danger}%');
    expect(createBody).toContain('this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)');
  });

  it('clears references to destroyed per-floor HUD and lighting resources in init()', async () => {
    const source = await readFile(fileURLToPath(sceneSourceUrl), 'utf8');
    const initStart = source.indexOf('  init(data: FloorSceneData) {');
    const initEnd = source.indexOf('  create() {', initStart);
    const initBody = source.slice(initStart, initEnd);

    for (const resource of [
      'this.statusText = undefined',
      'this.healthBarFill = undefined',
      'this.healthBarText = undefined',
      'this.lightmapTexture = undefined',
      'this.lightmapGraphics = undefined',
    ]) {
      expect(initBody).toContain(resource);
    }
  });

  it('stops floor ambience on floor restart, death, victory, and scene shutdown', async () => {
    const source = await readFile(fileURLToPath(sceneSourceUrl), 'utf8');
    const transitionStart = source.indexOf('  private completeFloor(');
    const transitionEnd = source.indexOf('\n  private ', transitionStart + 10);
    const transitionBody = source.slice(transitionStart, transitionEnd);
    expect(transitionBody).toContain('this.scene.restart({ runState: this.runState })');
    expect(transitionBody).toContain('AUDIO_KEYS.interaction.floorTransition');
    expect(transitionBody).toContain("fadeOutCategory('ambience', 850)");

    const terminalStart = source.indexOf("if (state.status === 'won') {");
    const terminalEnd = source.indexOf('\n      }', source.indexOf("} else if (state.status === 'lost')", terminalStart));
    const terminalBody = source.slice(terminalStart, terminalEnd);
    expect(terminalBody.match(/stopCategory\('ambience'\)/g)).toHaveLength(1);
    expect(terminalBody).toContain('this.beginVictoryEpilogue()');
    expect(terminalBody).toContain('this.playerDeath()');

    const shutdownStart = source.indexOf('  shutdown() {');
    const shutdownEnd = source.indexOf('\n  private ', shutdownStart + 10);
    expect(source.slice(shutdownStart, shutdownEnd)).toContain('this.audioDirector.shutdown()');
    expect(source).toContain("this.audioDirector.fadeInCategory('ambience', 1000)");
    expect(source).toContain('this.audioDirector?.pausePresentation()');
    expect(source).toContain('this.audioDirector?.resumePresentation()');
  });

  it('clears and restores the pursuit-only ambience duck across pause and terminal lifecycle', async () => {
    const source = await readFile(fileURLToPath(sceneSourceUrl), 'utf8');
    const clearStart = source.indexOf('  private clearFinalChaseAmbience()');
    const clearEnd = source.indexOf('\n  private ', clearStart + 10);
    const clearBody = source.slice(clearStart, clearEnd);
    expect(clearBody).toContain("setCategoryDucking('ambience', 1, 'final-stalker-chase')");
    expect(clearBody).toContain('this.tweens.killTweensOf(this.finalChaseAmbienceTween)');

    const pauseStart = source.indexOf('  private showPauseMenu()');
    const pauseEnd = source.indexOf('\n  private ', pauseStart + 10);
    const pauseBody = source.slice(pauseStart, pauseEnd);
    expect(pauseBody).toContain('this.clearFinalChaseAmbience()');
    expect(pauseBody).toContain('this.setFinalChaseAmbience(isBlock13Floor(state.floor) && state.hasKey && state.stalker.state === \'hunting\'');

    for (const method of ['  private completeFloor(', '  private beginVictoryEpilogue()', '  private playerDeath()', '  shutdown() {']) {
      const start = source.indexOf(method);
      const end = source.indexOf('\n  private ', start + 10);
      expect(source.slice(start, end)).toContain('this.clearFinalChaseAmbience()');
    }
  });
});
