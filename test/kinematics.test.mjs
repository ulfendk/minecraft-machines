import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chainTo, pointOn, pose, toLocal, toWorld } from '../src/lib/kinematics.mjs';

const bones = [
  { name: 'root', pivot: [0, 0, 0] },
  { name: 'arm', parent: 'root', pivot: [0, 10, 0] },
  { name: 'hand', parent: 'arm', pivot: [0, 10, -10] },
];
const near = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9, `${a} vs ${b}`));

test('a point on an unposed chain stays where it is', () => {
  near(pointOn(chainTo(bones, 'hand'), [], {}, [0, 10, -20]), [0, 10, -20]);
});

test('a positive x rotation tips a forward-pointing arm down', () => {
  const drivers = [{ bone: 'arm', prop: 'rotation', axis: 0, terms: [['c0', 1]] }];
  near(pointOn(chainTo(bones, 'arm'), drivers, { c0: 90 }, [0, 10, -10]), [0, 0, 0]);
});

test('rotations around y turn the arm sideways, and child bones follow', () => {
  const drivers = [{ bone: 'arm', prop: 'rotation', axis: 1, terms: [['c0', 1]] }];
  near(pointOn(chainTo(bones, 'hand'), drivers, { c0: 90 }, [0, 10, -20]), [-20, 10, 0]);
});

test('position drivers move bones in pixels and add up', () => {
  const drivers = [
    { bone: 'hand', prop: 'position', axis: 1, terms: [['c0', -2], ['c1', 1]], base: 1 },
  ];
  assert.deepEqual(pose(drivers, { c0: 3, c1: 4 }).hand.position, [0, -1, 0]);
});

test('model pixels map to entity space: -z is forward, scale multiplies', () => {
  near(toLocal([16, 32, -16], 2), [2, 4, 2]);
});

test('entity space turns with the yaw like Minecraft (0 faces +z, 90 faces -x)', () => {
  near(toWorld([0, 0, 1], 0), [0, 0, 1]);
  near(toWorld([0, 0, 1], 90), [-1, 0, 0]);
  near(toWorld([1, 0, 0], 90), [0, 0, 1]);
});
