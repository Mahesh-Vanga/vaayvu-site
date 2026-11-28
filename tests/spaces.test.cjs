const test = require('node:test');
const assert = require('node:assert/strict');
const spaces = require('../chrome/spaces');

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    dump: () => Object.fromEntries(data),
  };
}

test('spaces normalize garbage into a usable default workspace', () => {
  for (const value of [null, undefined, 12, 'nope', {}, { list: [] }, { list: [null] }]) {
    const state = spaces.normalize(value);
    assert.equal(state.list.length, 1);
    assert.equal(state.active, state.list[0].id);
    assert.equal(state.list[0].name, 'Personal');
  }
});

test('spaces reject duplicate ids, bad themes and cap the list', () => {
  const state = spaces.normalize({
    active: 'missing',
    list: [
      { id: 'work', name: '  Work   stuff ', emoji: '💼', theme: 'ember' },
      { id: 'work', name: 'Duplicate', theme: 'aurora' },
      { id: 'bad id!', name: '', theme: 'not-a-theme' },
    ],
  });
  assert.deepEqual(
    state.list.map((space) => [space.id, space.name, space.theme]),
    [
      ['work', 'Work stuff', 'ember'],
      ['space-1', 'Space 2', 'aurora'],
    ],
  );
  assert.equal(state.active, 'work');
  assert.equal(spaces.normalize({ list: [{ id: 'x' }], active: 'nope' }).active, 'x');
});

test('spaces create, update, reorder and remove without mutating the input', () => {
  const base = spaces.defaultState();
  const created = spaces.create(base, { name: 'Research', emoji: '🧪', theme: 'forest' });
  assert.ok(created.space);
  assert.equal(created.state.active, created.space.id);
  assert.equal(base.list.length, 1, 'input state must not change');

  const renamed = spaces.update(created.state, created.space.id, { name: 'Lab', theme: 'ocean' });
  assert.equal(spaces.spaceByID(renamed, created.space.id).name, 'Lab');
  assert.equal(spaces.spaceByID(renamed, created.space.id).theme, 'ocean');

  const moved = spaces.move(renamed, created.space.id, -1);
  assert.equal(moved.list[0].id, created.space.id);

  const removed = spaces.remove(moved, created.space.id);
  assert.equal(removed.removed.name, 'Lab');
  assert.equal(removed.state.list.length, 1);
  assert.equal(removed.state.active, 'personal');
  assert.equal(spaces.remove(removed.state, 'personal').reason, 'last');
});

test('spaces partition tabs without losing tabs from other spaces', () => {
  const state = spaces.create(spaces.defaultState(), { name: 'Work' }).state;
  const work = state.active;
  const tabs = [
    { id: 'a', space: 'personal' },
    { id: 'b', space: work },
    { id: 'c' },
    { id: 'd', space: 'removed-space' },
  ];
  const split = spaces.partition(tabs, state);
  assert.deepEqual(
    split.active.map((t) => t.id),
    ['b', 'c', 'd'],
  );
  assert.deepEqual(
    split.other.map((t) => t.id),
    ['a'],
  );
  const totals = spaces.count(tabs, state);
  assert.equal(totals.get('personal'), 1);
  assert.equal(totals.get(work), 3);
});

test('spaces persist through a storage key and survive corrupt JSON', () => {
  const storage = memoryStorage();
  const state = spaces.create(spaces.defaultState(), { name: 'Reading', theme: 'rose' }).state;
  assert.equal(spaces.save(state, storage), true);
  assert.deepEqual(spaces.load(storage), state);
  assert.equal(spaces.load(memoryStorage({ [spaces.KEY]: '{oops' })).list[0].name, 'Personal');
});
