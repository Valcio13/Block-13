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
});
