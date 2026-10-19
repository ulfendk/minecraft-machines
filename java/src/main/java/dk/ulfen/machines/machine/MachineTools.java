package dk.ulfen.machines.machine;

import java.util.List;
import java.util.Set;

import dk.ulfen.machines.ModRegistry;
import dk.ulfen.machines.mixin.BlockDisplayAccessor;
import dk.ulfen.machines.mixin.DisplayAccessor;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.TagKey;
import net.minecraft.core.registries.Registries;
import net.minecraft.util.Mth;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.Display;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.DyeItem;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/**
 * What each kind of tool does: buckets dig and dump, blades level, beds tip, hooks lift,
 * forks carry, the mixer pours concrete and the roller packs the ground. The same rules
 * are implemented for Bedrock in src/packs/behavior_pack/scripts/tools.js.
 */
public final class MachineTools {
	public static final TagKey<EntityType<?>> UNLIFTABLE = TagKey.create(Registries.ENTITY_TYPE, ModRegistry.id("unliftable"));
	private static final Set<String> MIXABLE = Set.of("minecraft:sand", "minecraft:red_sand", "minecraft:gravel");
	private static final Set<String> PATHABLE = Set.of("minecraft:grass_block", "minecraft:dirt", "minecraft:coarse_dirt",
		"minecraft:podzol", "minecraft:mycelium", "minecraft:rooted_dirt");
	private static final String[] COLOURS = {"white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
		"light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"};

	private MachineTools() {}

	private static String kind(MachineEntity m) {
		return m.spec.tool.kind;
	}

	private static void tell(MachineEntity m, String key, Object... args) {
		if (m.operator() != null) m.operator().sendOverlayMessage(Component.translatable("machines." + key, args));
	}

	/** Horizontal movement since last tick along the machine's facing (blocks; negative when reversing). */
	private static double forwardMotion(MachineEntity m) {
		Vec3 d = m.position().subtract(m.lastPos);
		Vec3 f = Vec3.directionFromRotation(0, m.getYRot());
		return d.x * f.x + d.z * f.z;
	}

	// ------------------------------------------------------------ action button

	public static void action(MachineEntity m, ServerLevel level) {
		switch (kind(m)) {
			case "bucket" -> bucketAction(m, level);
			case "blade" -> {
				m.setMode(!m.mode());
				m.playSound(SoundEvents.LEVER_CLICK, 0.6F, m.mode() ? 1.2F : 0.9F);
			}
			case "bed" -> m.setChannel(0, m.channel(0) > 20 ? m.spec.channels.get(0).min : m.spec.channels.get(0).max);
			case "hook" -> hookAction(m, level);
			case "forks" -> forksAction(m, level);
			case "drum" -> {
				m.setMode(!m.mode() && !m.load.isEmpty());
				m.playSound(SoundEvents.LEVER_CLICK, 0.6F, m.mode() ? 1.2F : 0.9F);
			}
			default -> m.hornSound();
		}
	}

	public static void tick(MachineEntity m, ServerLevel level) {
		m.toolTicks++;
		switch (kind(m)) {
			case "bucket" -> scoopTick(m, level);
			case "blade" -> bladeTick(m, level);
			case "bed" -> bedTick(m, level);
			case "hook" -> hookTick(m, level);
			case "forks" -> carryTick(m, level, m.tip().add(0, 0.05, 0));
			case "drum" -> drumTick(m, level);
			case "roller" -> rollerTick(m, level);
			default -> {}
		}
	}

	// ------------------------------------------------------------ bucket: dig and dump

	private static void bucketAction(MachineEntity m, ServerLevel level) {
		Vec3 tip = m.tip();
		if (m.load.isEmpty()) {
			int dug = dig(m, level, tip, m.spec.tool.reach, Integer.MIN_VALUE);
			if (dug == 0) tell(m, "nothing");
			return;
		}
		MachineEntity receiver = receiverAt(m, level, tip);
		if (receiver != null) {
			int moved = 0;
			var it = m.load.view().entrySet().iterator();
			while (it.hasNext() && receiver.load.room() > 0) {
				var e = it.next();
				if ("drum".equals(receiver.spec.tool.kind) && !MIXABLE.contains(e.getKey())) continue;
				int n = Math.min(e.getValue(), receiver.load.room());
				receiver.load.add(e.getKey(), n);
				moved += n;
				if (n == e.getValue()) it.remove();
				else e.setValue(e.getValue() - n);
			}
			if (moved == 0 && "drum".equals(receiver.spec.tool.kind)) tell(m, "mixer.only");
			receiver.syncLoad();
			level.playSound(null, tip.x, tip.y, tip.z, SoundEvents.GRAVEL_BREAK, SoundSource.BLOCKS, 1F, 0.7F);
		} else {
			while (!m.load.isEmpty()) {
				String id = m.load.takeOne();
				if (!TerrainOps.pour(level, m.operator(), tip, id)) {
					m.load.add(id, 1);
					tell(m, "no_room");
					break;
				}
			}
		}
		m.syncLoad();
	}

	/** Digs diggable blocks around a point into the load, nearest first. Returns how many. */
	private static int dig(MachineEntity m, ServerLevel level, Vec3 at, double reach, int minY) {
		int dug = 0;
		for (BlockPos p : TerrainOps.around(at, reach)) {
			if (m.load.isFull()) break;
			if (p.getY() < minY) continue;
			BlockState state = level.getBlockState(p);
			if (!TerrainOps.canDig(level, p, state, m.spec.tool.maxHardness)) continue;
			String drop = TerrainOps.dropOf(state);
			if (!TerrainOps.breakBlock(level, m.operator(), p)) continue;
			if (drop != null) m.load.add(drop, 1);
			dug++;
		}
		if (dug > 0) m.syncLoad();
		return dug;
	}

	/** Wheel loaders and skid steers also fill the bucket by driving into a pile with the bucket down. */
	private static void scoopTick(MachineEntity m, ServerLevel level) {
		if (!m.spec.tool.scoop || m.toolTicks % 3 != 0 || m.load.isFull()) return;
		if (m.channel(0) > m.spec.channels.get(0).min + 4 || forwardMotion(m) < 0.02) return;
		dig(m, level, m.tip(), m.spec.tool.reach, Mth.floor(m.getY() + 0.2));
	}

	private static @Nullable MachineEntity receiverAt(MachineEntity m, ServerLevel level, Vec3 tip) {
		for (MachineEntity e : level.getEntitiesOfClass(MachineEntity.class, new AABB(tip, tip).inflate(4, 5, 4))) {
			if (e == m || !("bed".equals(e.spec.tool.kind) || "drum".equals(e.spec.tool.kind))) continue;
			AABB box = e.getBoundingBox().inflate(0.6, 3, 0.6);
			if (box.contains(tip) && tip.y >= e.getY() + 0.5 && e.load.room() > 0) return e;
		}
		return null;
	}

	// ------------------------------------------------------------ bulldozer blade

	private static void bladeTick(MachineEntity m, ServerLevel level) {
		if (m.toolTicks % 2 != 0 || forwardMotion(m) < 0.02) return;
		MachineSpec.Strip strip = m.spec.tool.strip;
		int cutY = Mth.floor(m.getY() + 0.2) + Math.round(m.channel(0));
		Vec3 f = Vec3.directionFromRotation(0, m.getYRot());
		Vec3 right = new Vec3(-f.z, 0, f.x);
		boolean changed = false;
		for (double d = -(strip.width - 1) / 2.0; d <= (strip.width - 1) / 2.0 + 0.01; d += 1) {
			Vec3 c = m.position().add(f.scale(strip.ahead)).add(right.scale(d));
			for (int y = cutY; y <= cutY + 2; y++) {
				BlockPos p = BlockPos.containing(c.x, y, c.z);
				BlockState state = level.getBlockState(p);
				if (!TerrainOps.canDig(level, p, state, m.spec.tool.maxHardness) || m.load.isFull()) continue;
				String drop = TerrainOps.dropOf(state);
				if (TerrainOps.breakBlock(level, m.operator(), p)) {
					if (drop != null) m.load.add(drop, 1);
					changed = true;
				}
			}
		}
		if (m.mode() || m.load.isFull()) {
			for (double d = -(strip.width - 1) / 2.0; d <= (strip.width - 1) / 2.0 + 0.01; d += 1) {
				if (m.load.isEmpty()) break;
				Vec3 c = m.position().add(f.scale(strip.ahead)).add(right.scale(d));
				BlockPos hole = BlockPos.containing(c.x, cutY - 1, c.z);
				if (!TerrainOps.replaceable(level.getBlockState(hole))) continue;
				String id = m.load.takeOne();
				BlockState fill = TerrainOps.blockFor(id);
				if (fill == null || !TerrainOps.place(level, m.operator(), hole, fill)) m.load.add(id, 1);
				else changed = true;
			}
		}
		if (changed) m.syncLoad();
	}

	// ------------------------------------------------------------ dump truck bed

	private static void bedTick(MachineEntity m, ServerLevel level) {
		if (m.channel(0) < 40 || m.load.isEmpty() || m.toolTicks % 3 != 0) return;
		Vec3 at = m.bodyPoint(m.spec.tool.pour);
		String id = m.load.takeOne();
		if (!TerrainOps.pour(level, m.operator(), at, id)) m.load.add(id, 1);
		m.syncLoad();
	}

	// ------------------------------------------------------------ crane hook

	private static Vec3 hookPoint(MachineEntity m) {
		return m.tip();
	}

	private static void hookTick(MachineEntity m, ServerLevel level) {
		Integer ropeChannel = m.spec.tool.rope;
		Entity carried = carriedEntity(m, level);
		double below = carried != null ? carried.getBbHeight() + 0.1 : m.carriedBlock != null ? 1.05 : 0;
		// The hook (and what hangs on it) stops on the ground: shorten the rope while it is in a block.
		if (ropeChannel != null) {
			for (int i = 0; i < 40; i++) {
				Vec3 h = hookPoint(m);
				BlockPos low = BlockPos.containing(h.x, h.y - below + 0.05, h.z);
				if (TerrainOps.replaceable(level.getBlockState(low)) && TerrainOps.replaceable(level.getBlockState(BlockPos.containing(h)))) break;
				if (m.channel(ropeChannel) <= m.spec.channels.get(ropeChannel).min) break;
				m.setChannel(ropeChannel, m.channel(ropeChannel) - 0.25F);
			}
		}
		Vec3 h = hookPoint(m);
		if (carried != null) {
			carried.setPos(h.x, h.y - carried.getBbHeight() - 0.1, h.z);
			carried.setDeltaMovement(Vec3.ZERO);
			carried.resetFallDistance();
		} else if (m.carriedEntity != null) {
			m.carriedEntity = null;
			m.setCarrying(m.carriedBlock != null);
		}
		if (m.carriedBlock != null) carryTick(m, level, h.add(0, -1.05, 0));
		// A tower crane stands on its mast: if the mast is gone, it comes down as a kit.
		if (!m.spec.drives() && m.toolTicks % 20 == 0 && !TerrainOps.isMast(level.getBlockState(m.blockPosition().below()))) {
			m.breakApart(level, true);
		}
	}

	private static @Nullable Entity carriedEntity(MachineEntity m, ServerLevel level) {
		if (m.carriedEntity == null) return null;
		Entity e = level.getEntity(m.carriedEntity);
		return e == null || e.isRemoved() || e.isPassenger() ? null : e;
	}

	private static void hookAction(MachineEntity m, ServerLevel level) {
		Vec3 h = hookPoint(m);
		if (m.carriedEntity != null || m.carriedBlock != null) {
			release(m, level, h);
			return;
		}
		AABB area = new AABB(h, h).inflate(1.5, 0.5, 1.5).expandTowards(0, -2.5, 0);
		// 1. another machine
		for (MachineEntity other : level.getEntitiesOfClass(MachineEntity.class, area, e -> e != m && e.spec.drives() && !e.isVehicle())) {
			if (other.spec.mass > m.spec.tool.lift) {
				tell(m, "too_heavy");
				level.playSound(null, h.x, h.y, h.z, SoundEvents.ANVIL_LAND, SoundSource.BLOCKS, 0.5F, 1.4F);
				return;
			}
			attach(m, other);
			return;
		}
		// 2. a mob
		for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, area, e -> !(e instanceof Player) && !(e instanceof MachineEntity)
			&& !e.getType().builtInRegistryHolder().is(UNLIFTABLE) && !e.isPassenger() && e.isAlive())) {
			attach(m, e);
			return;
		}
		// 3. the block under the hook
		for (int dy = 0; dy <= 1; dy++) {
			BlockPos p = BlockPos.containing(h.x, h.y - 0.4 - dy, h.z);
			if (pickUp(m, level, p)) return;
		}
	}

	private static void attach(MachineEntity m, Entity e) {
		m.carriedEntity = e.getUUID();
		m.setCarrying(true);
		m.playSound(SoundEvents.CHAIN_PLACE, 1F, 0.8F);
	}

	private static boolean pickUp(MachineEntity m, ServerLevel level, BlockPos p) {
		BlockState state = level.getBlockState(p);
		if (!TerrainOps.canLift(level, p, state) || !TerrainOps.mayEdit(level, m.operator(), p)) return false;
		if (m.operator() != null && !net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents.BEFORE.invoker().beforeBlockBreak(level, m.operator(), p, state, null)) return false;
		level.levelEvent(2001, p, net.minecraft.world.level.block.Block.getId(state));
		level.setBlockAndUpdate(p, Blocks.AIR.defaultBlockState());
		m.carriedBlock = state;
		m.setCarrying(true);
		m.playSound(SoundEvents.CHAIN_PLACE, 1F, 1.0F);
		return true;
	}

	/** Lets go of whatever hangs on the hook or sits on the forks. */
	private static void release(MachineEntity m, ServerLevel level, Vec3 at) {
		Entity e = carriedEntity(m, level);
		if (e != null) {
			if (e instanceof LivingEntity living && !level.getBlockState(BlockPos.containing(at).below(3)).isSolid()) {
				living.addEffect(new MobEffectInstance(MobEffects.SLOW_FALLING, 60, 0, false, false));
			}
			e.resetFallDistance();
			m.carriedEntity = null;
		}
		if (m.carriedBlock != null) {
			BlockPos p = BlockPos.containing(at.x, at.y - 0.5, at.z);
			for (int i = 0; i < 24 && TerrainOps.replaceable(level.getBlockState(p.below())) && p.getY() > level.getMinY(); i++) p = p.below();
			if (TerrainOps.place(level, m.operator(), p, m.carriedBlock) || TerrainOps.place(level, m.operator(), p.above(), m.carriedBlock)) {
				m.carriedBlock = null;
			} else {
				tell(m, "no_room");
				return;
			}
			removeDisplay(m, level);
		}
		m.setCarrying(false);
		m.playSound(SoundEvents.CHAIN_BREAK, 1F, 1.0F);
	}

	/** Drops anything carried as items (when the machine is broken). */
	public static void releaseAll(MachineEntity m, ServerLevel level) {
		if (m.carriedBlock != null) {
			TerrainOps.drop(level, m.tip(), BuiltInRegistries.ITEM.getKey(m.carriedBlock.getBlock().asItem()).toString(), 1);
			m.carriedBlock = null;
		}
		m.carriedEntity = null;
		removeDisplay(m, level);
	}

	// ------------------------------------------------------------ forks (and carried blocks)

	private static void forksAction(MachineEntity m, ServerLevel level) {
		Vec3 tip = m.tip();
		if (m.carriedBlock != null) {
			BlockPos p = BlockPos.containing(tip.x, tip.y + 0.5, tip.z);
			if (TerrainOps.place(level, m.operator(), p, m.carriedBlock)) {
				m.carriedBlock = null;
				m.setCarrying(false);
				removeDisplay(m, level);
			} else {
				tell(m, "no_room");
			}
			return;
		}
		if (!pickUp(m, level, BlockPos.containing(tip.x, tip.y + 0.3, tip.z))) pickUp(m, level, BlockPos.containing(tip.x, tip.y - 0.3, tip.z));
	}

	/** Keeps a block display (the carried block) at `at`, the centre of the block's bottom face. */
	private static void carryTick(MachineEntity m, ServerLevel level, Vec3 at) {
		if (m.carriedBlock == null) {
			if (m.displayId != null) removeDisplay(m, level);
			return;
		}
		Entity display = m.displayId != null ? level.getEntity(m.displayId) : null;
		if (display == null) {
			Display.BlockDisplay d = net.minecraft.world.entity.EntityTypes.BLOCK_DISPLAY.create(level, EntitySpawnReason.TRIGGERED);
			if (d == null) return;
			((BlockDisplayAccessor) d).machines$setBlockState(m.carriedBlock);
			((DisplayAccessor) d).machines$setPosRotInterpolationDuration(2);
			d.addTag("machines_carried");
			d.setPos(at.x - 0.5, at.y, at.z - 0.5);
			level.addFreshEntity(d);
			m.displayId = d.getUUID();
			display = d;
		}
		display.setPos(at.x - 0.5, at.y, at.z - 0.5);
	}

	private static void removeDisplay(MachineEntity m, ServerLevel level) {
		if (m.displayId == null) return;
		Entity d = level.getEntity(m.displayId);
		if (d != null) d.discard();
		m.displayId = null;
	}

	/** Block displays left over from before a restart (machines keep their display only in memory). */
	public static void sweepDisplays(ServerLevel level, Entity near) {
		for (Display.BlockDisplay d : level.getEntitiesOfClass(Display.BlockDisplay.class, near.getBoundingBox().inflate(48), d -> d.entityTags().contains("machines_carried"))) {
			boolean owned = false;
			for (MachineEntity m : level.getEntitiesOfClass(MachineEntity.class, d.getBoundingBox().inflate(48))) owned |= d.getUUID().equals(m.displayId);
			if (!owned) d.discard();
		}
	}

	// ------------------------------------------------------------ mixer

	private static void drumTick(MachineEntity m, ServerLevel level) {
		if (!m.mode()) return;
		if (m.load.isEmpty()) {
			m.setMode(false);
			return;
		}
		if (m.toolTicks % 4 != 0) return;
		String concrete = "minecraft:" + COLOURS[Mth.clamp(m.concreteColour, 0, 15)] + "_concrete";
		Vec3 at = m.tip();
		if (TerrainOps.pour(level, m.operator(), at, concrete)) {
			m.load.takeOne();
			m.syncLoad();
			level.playSound(null, at.x, at.y, at.z, SoundEvents.MUD_PLACE, SoundSource.BLOCKS, 0.8F, 0.8F);
		} else {
			m.setMode(false);
			tell(m, "no_room");
		}
	}

	public static InteractionResult interact(MachineEntity m, Player player, ItemStack held) {
		if (!"drum".equals(kind(m)) || held.isEmpty()) return InteractionResult.PASS;
		String id = BuiltInRegistries.ITEM.getKey(held.getItem()).toString();
		var dye = held.get(net.minecraft.core.component.DataComponents.DYE);
		if (held.getItem() instanceof DyeItem && dye != null) {
			if (!m.level().isClientSide()) {
				m.concreteColour = dye.getId();
				player.sendOverlayMessage(Component.translatable("machines.mixer.colour"));
			}
			return InteractionResult.SUCCESS;
		}
		if (MIXABLE.contains(id)) {
			if (!m.level().isClientSide()) {
				int n = Math.min(held.getCount(), m.load.room());
				m.load.add(id, n);
				held.consume(n, player);
				m.syncLoad();
				m.playSound(SoundEvents.SAND_PLACE, 1F, 0.8F);
			}
			return InteractionResult.SUCCESS;
		}
		return InteractionResult.PASS;
	}

	// ------------------------------------------------------------ road roller

	private static void rollerTick(MachineEntity m, ServerLevel level) {
		if (m.toolTicks % 2 != 0 || Math.abs(forwardMotion(m)) < 0.02) return;
		MachineSpec.Strip strip = m.spec.tool.strip;
		int y = Mth.floor(m.getY() + 0.2);
		Vec3 f = Vec3.directionFromRotation(0, m.getYRot());
		Vec3 right = new Vec3(-f.z, 0, f.x);
		boolean changed = false;
		for (double d = -(strip.width - 1) / 2.0; d <= (strip.width - 1) / 2.0 + 0.01; d += 1) {
			Vec3 c = m.position().add(f.scale(strip.ahead)).add(right.scale(d));
			BlockPos at = BlockPos.containing(c.x, y, c.z);
			BlockState here = level.getBlockState(at);
			// Flatten plants and one-block bumps.
			if (!here.isAir() && TerrainOps.canDig(level, at, here, 1.0F) && level.getBlockState(at.above()).isAir()) {
				String drop = TerrainOps.dropOf(here);
				if ((drop == null || !m.load.isFull()) && TerrainOps.breakBlock(level, m.operator(), at)) {
					if (drop != null) m.load.add(drop, 1);
					changed = true;
				}
			}
			BlockPos ground = at.below();
			BlockState g = level.getBlockState(ground);
			if (TerrainOps.replaceable(g) && !m.load.isEmpty()) {
				String id = m.load.takeOne();
				BlockState fill = TerrainOps.blockFor(id);
				if (fill == null || !TerrainOps.place(level, m.operator(), ground, fill)) m.load.add(id, 1);
				changed = true;
			} else if (PATHABLE.contains(BuiltInRegistries.BLOCK.getKey(g.getBlock()).toString())
				&& level.getBlockState(at).isAir() && TerrainOps.mayEdit(level, m.operator(), ground)) {
				level.setBlockAndUpdate(ground, Blocks.DIRT_PATH.defaultBlockState());
			}
		}
		if (changed) m.syncLoad();
	}

	// ------------------------------------------------------------ tower crane

	/** Getting out of a tower crane puts you next to the bottom of its mast. */
	public static Vec3 towerDismount(MachineEntity m) {
		BlockPos p = m.blockPosition().below();
		while (TerrainOps.isMast(m.level().getBlockState(p)) && p.getY() > m.level().getMinY()) p = p.below();
		BlockPos base = p.above();
		for (BlockPos side : List.of(base.east(), base.west(), base.north(), base.south())) {
			if (m.level().getBlockState(side).isAir() && m.level().getBlockState(side.above()).isAir()) return Vec3.atBottomCenterOf(side);
		}
		return Vec3.atBottomCenterOf(base.east());
	}
}
