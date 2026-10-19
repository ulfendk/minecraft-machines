package dk.ulfen.machines.machine;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import dk.ulfen.machines.ModRegistry;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.tags.TagKey;
import net.minecraft.core.registries.Registries;
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/**
 * Every change machines make to the world goes through here, so the same rules apply
 * everywhere: the game rule, spawn protection, adventure mode, claim mods (via the
 * block-break event), no block entities and never the blocks in machines:never.
 */
public final class TerrainOps {
	public static final TagKey<Block> DIGGABLE = TagKey.create(Registries.BLOCK, ModRegistry.id("diggable"));
	public static final TagKey<Block> LIFTABLE = TagKey.create(Registries.BLOCK, ModRegistry.id("liftable"));
	public static final TagKey<Block> NEVER = TagKey.create(Registries.BLOCK, ModRegistry.id("never"));

	/** Dug block -> what goes into the load (empty string: nothing). Mirrors DROPS in src/diggable.mjs. */
	private static final Map<String, String> DROPS = Map.ofEntries(
		Map.entry("minecraft:grass_block", "minecraft:dirt"), Map.entry("minecraft:mycelium", "minecraft:dirt"),
		Map.entry("minecraft:podzol", "minecraft:dirt"), Map.entry("minecraft:dirt_path", "minecraft:dirt"),
		Map.entry("minecraft:farmland", "minecraft:dirt"), Map.entry("minecraft:rooted_dirt", "minecraft:dirt"),
		Map.entry("minecraft:moss_block", "minecraft:dirt"), Map.entry("minecraft:stone", "minecraft:cobblestone"),
		Map.entry("minecraft:deepslate", "minecraft:cobbled_deepslate"), Map.entry("minecraft:snow", ""));

	private TerrainOps() {}

	public static boolean enabled(ServerLevel level) {
		return level.getGameRules().get(ModRegistry.TERRAIN_RULE);
	}

	/** May this operator change this position at all? (No operator: only the game rule counts.) */
	public static boolean mayEdit(ServerLevel level, @Nullable Player operator, BlockPos pos) {
		if (!enabled(level) || !level.isInWorldBounds(pos) || !level.getWorldBorder().isWithinBounds(pos)) return false;
		if (operator == null) return true;
		return level.mayInteract(operator, pos) && !operator.blockActionRestricted(level, pos, operator.gameMode());
	}

	private static boolean untouchable(BlockState state) {
		return state.is(NEVER) || state.hasBlockEntity() || !state.getFluidState().isEmpty() && state.getFluidState().isSource();
	}

	public static boolean canDig(ServerLevel level, BlockPos pos, BlockState state, float maxHardness) {
		if (state.isAir() || untouchable(state) || !state.is(DIGGABLE)) return false;
		float hardness = state.getDestroySpeed(level, pos);
		return hardness >= 0 && hardness <= maxHardness;
	}

	public static boolean canLift(ServerLevel level, BlockPos pos, BlockState state) {
		if (state.isAir() || untouchable(state) || !state.is(LIFTABLE)) return false;
		float hardness = state.getDestroySpeed(level, pos);
		return hardness >= 0 && hardness <= 5.0F;
	}

	/** What a dug block adds to a load, or null for nothing (plants are just flattened). */
	public static @Nullable String dropOf(BlockState state) {
		String id = BuiltInRegistries.BLOCK.getKey(state.getBlock()).toString();
		if (DROPS.containsKey(id)) return DROPS.get(id).isEmpty() ? null : DROPS.get(id);
		if (state.canBeReplaced()) return null; // grass, flowers
		return id;
	}

	/** Removes a block with particles and sound, if the operator may. */
	public static boolean breakBlock(ServerLevel level, @Nullable Player operator, BlockPos pos) {
		BlockState state = level.getBlockState(pos);
		if (!mayEdit(level, operator, pos)) return false;
		if (operator != null && !PlayerBlockBreakEvents.BEFORE.invoker().beforeBlockBreak(level, operator, pos, state, null)) return false;
		return level.destroyBlock(pos, false, operator, 512);
	}

	public static boolean replaceable(BlockState state) {
		return state.isAir() || state.canBeReplaced() && !state.hasBlockEntity();
	}

	public static @Nullable BlockState blockFor(String itemId) {
		Item item = BuiltInRegistries.ITEM.getValue(Identifier.parse(itemId));
		return item instanceof BlockItem bi ? bi.getBlock().defaultBlockState() : null;
	}

	public static boolean place(ServerLevel level, @Nullable Player operator, BlockPos pos, BlockState state) {
		if (!replaceable(level.getBlockState(pos)) || !mayEdit(level, operator, pos)) return false;
		if (!state.canSurvive(level, pos)) return false;
		level.setBlockAndUpdate(pos, state);
		var sound = state.getSoundType();
		level.playSound(null, pos, sound.getPlaceSound(), net.minecraft.sounds.SoundSource.BLOCKS, (sound.getVolume() + 1) / 2F, sound.getPitch() * 0.8F);
		return true;
	}

	public static void drop(ServerLevel level, Vec3 at, String itemId, int count) {
		Item item = BuiltInRegistries.ITEM.getValue(Identifier.parse(itemId));
		if (item == null || item == net.minecraft.world.item.Items.AIR) return;
		while (count > 0) {
			int n = Math.min(count, item.getDefaultMaxStackSize());
			level.addFreshEntity(new ItemEntity(level, at.x, at.y, at.z, new ItemStack(item, n)));
			count -= n;
		}
	}

	/**
	 * Pours one item at `at` like a pile: it lands in the lowest free spot of the 3x3 columns
	 * below the point (centre first on ties). Items that are not blocks drop as items.
	 * Returns false if there was nowhere to put it (the caller keeps it).
	 */
	public static boolean pour(ServerLevel level, @Nullable Player operator, Vec3 at, String itemId) {
		BlockState state = blockFor(itemId);
		if (state == null) {
			drop(level, at, itemId, 1);
			return true;
		}
		BlockPos top = BlockPos.containing(at);
		List<BlockPos> spots = new ArrayList<>();
		for (int dx = -1; dx <= 1; dx++)
			for (int dz = -1; dz <= 1; dz++) {
				BlockPos column = top.offset(dx, 0, dz);
				if (!replaceable(level.getBlockState(column))) continue;
				BlockPos p = column;
				for (int i = 0; i < 24 && replaceable(level.getBlockState(p.below())) && p.getY() > level.getMinY(); i++) p = p.below();
				spots.add(p);
			}
		spots.sort(Comparator.<BlockPos>comparingInt(BlockPos::getY).thenComparingInt(p -> p.distManhattan(top)));
		for (BlockPos p : spots) if (place(level, operator, p, state)) return true;
		return false;
	}

	/** Blocks within `radius` of a point, nearest first. */
	public static List<BlockPos> around(Vec3 at, double radius) {
		List<BlockPos> out = new ArrayList<>();
		int r = (int) Math.ceil(radius);
		BlockPos c = BlockPos.containing(at);
		for (int dx = -r; dx <= r; dx++)
			for (int dy = -r; dy <= r; dy++)
				for (int dz = -r; dz <= r; dz++) {
					BlockPos p = c.offset(dx, dy, dz);
					if (Vec3.atCenterOf(p).distanceToSqr(at) <= radius * radius) out.add(p);
				}
		out.sort(Comparator.comparingDouble(p -> Vec3.atCenterOf(p).distanceToSqr(at)));
		return out;
	}

	public static boolean isMast(BlockState state) {
		return state.is(ModRegistry.CRANE_MAST);
	}

	public static BlockState air() {
		return Blocks.AIR.defaultBlockState();
	}
}
