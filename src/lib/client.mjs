// Machine spec -> Bedrock resource-pack client entity and render controller.
import { NS } from './constants.mjs';

/**
 * Smooths the synced channel values on the client so moving parts glide between
 * property updates. A jump of more than 180 (a slewing cab wrapping round) snaps.
 */
function preAnimation(m) {
  const lines = [];
  m.channels.forEach((c, i) => {
    const p = `q.property('${NS}:c${i}')`;
    lines.push(`t.d = ${p} - (v.c${i} ?? ${p});`);
    lines.push(`v.c${i} = math.abs(t.d) > 180 ? ${p} : (v.c${i} ?? ${p}) + t.d * 0.35;`);
  });
  lines.push(`v.load = q.property('${NS}:load');`);
  lines.push(`v.steer = (v.steer ?? 0) + (q.property('${NS}:steer') - (v.steer ?? 0)) * 0.3;`);
  return lines;
}

export function buildClientEntity(m) {
  return {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: `${NS}:${m.id}`,
        materials: { default: 'entity_alphablend' },
        textures: { default: `textures/entity/${NS}/${m.id}` },
        geometry: { default: `geometry.${NS}.${m.id}` },
        animations: { move: `animation.${NS}.${m.id}.move` },
        scripts: {
          pre_animation: preAnimation(m),
          animate: ['move'],
          ...(m.scale !== 1 ? { scale: String(m.scale) } : {}),
        },
        render_controllers: [`controller.render.${NS}.${m.id}`],
        enable_attachables: false,
      },
    },
  };
}

export function buildRenderController(m) {
  return {
    format_version: '1.8.0',
    render_controllers: {
      [`controller.render.${NS}.${m.id}`]: {
        geometry: 'Geometry.default',
        materials: [{ '*': 'Material.default' }],
        textures: ['Texture.default'],
      },
    },
  };
}
