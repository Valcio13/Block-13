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
    expect(createBody.indexOf('this.dangerIndicator = this.add.text')).toBeLessThan(firstStatusUpdate);
    expect(createBody.indexOf('this.healthBarText = this.add.text')).toBeLessThan(firstStatusUpdate);
    expect(createBody.indexOf('this.cameras.main.ignore(this.dangerIndicator)')).toBeLessThan(firstStatusUpdate);
    expect(createBody).toContain('this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this)');
  });

  it('clears references to destroyed per-floor HUD and lighting resources in init()', async () => {
    const source = await readFile(fileURLToPath(sceneSourceUrl), 'utf8');
    const initStart = source.indexOf('  init(data: FloorSceneData) {');
    const initEnd = source.indexOf('  create() {', initStart);
    const initBody = source.slice(initStart, initEnd);

    for (const resource of [
      'this.statusText = undefined',
      'this.dangerIndicator = undefined',
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

    const terminalStart = source.indexOf("if (state.status === 'won') {");
    const terminalEnd = source.indexOf('\n      }', source.indexOf("} else if (state.status === 'lost')", terminalStart));
    const terminalBody = source.slice(terminalStart, terminalEnd);
    expect(terminalBody.match(/stopCategory\('ambience'\)/g)).toHaveLength(2);
    expect(terminalBody).toContain('this.showVictoryScreen(this.runState)');
    expect(terminalBody).toContain('this.playerDeath()');

    const shutdownStart = source.indexOf('  shutdown() {');
    const shutdownEnd = source.indexOf('\n  private ', shutdownStart + 10);
    expect(source.slice(shutdownStart, shutdownEnd)).toContain('this.audioDirector.shutdown()');
  });
});
