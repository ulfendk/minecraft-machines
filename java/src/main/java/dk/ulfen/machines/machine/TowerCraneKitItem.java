package dk.ulfen.machines.machine;

import dk.ulfen.machines.ModRegistry;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.CustomData;
import net.minecraft.world.item.context.UseOnContext;
import net.minecraft.world.level.Level;

/**
 * Builds a tower crane: a mast of crane mast blocks with the slewing top on it.
 * Use it in the air to choose the height (12, 20 or 32 blocks).
 */
public class TowerCraneKitItem extends Item {
	public static final int[] HEIGHTS = {12, 20, 32};

	public TowerCraneKitItem(Item.Properties props) {
		super(props);
	}

	public static int height(ItemStack stack) {
		CustomData data = stack.get(DataComponents.CUSTOM_DATA);
		return data == null ? HEIGHTS[0] : data.copyTag().getIntOr("Height", HEIGHTS[0]);
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		ItemStack stack = player.getItemInHand(hand);
		int current = height(stack);
		int next = HEIGHTS[0];
		for (int i = 0; i < HEIGHTS.length; i++) if (HEIGHTS[i] == current) next = HEIGHTS[(i + 1) % HEIGHTS.length];
		int h = next;
		CustomData.update(DataComponents.CUSTOM_DATA, stack, tag -> tag.putInt("Height", h));
		if (!level.isClientSide()) player.sendOverlayMessage(Component.translatable("machines.kit.height", h));
		player.playSound(SoundEvents.UI_BUTTON_CLICK.value(), 0.5F, 1.2F);
		return InteractionResult.SUCCESS;
	}

	@Override
	public InteractionResult useOn(UseOnContext ctx) {
		if (ctx.getClickedFace() != Direction.UP) return InteractionResult.FAIL;
		if (!(ctx.getLevel() instanceof ServerLevel level)) return InteractionResult.SUCCESS;
		Player player = ctx.getPlayer();
		int height = height(ctx.getItemInHand());
		BlockPos base = ctx.getClickedPos().above();
		// Room for the mast and the top (the jib swings above the mast).
		for (int y = 0; y < height + 3; y++) {
			BlockPos p = base.above(y);
			if (!TerrainOps.replaceable(level.getBlockState(p)) || player != null && !level.mayInteract(player, p) || !level.isInWorldBounds(p)) {
				if (player != null) player.sendOverlayMessage(Component.translatable("machines.no_room"));
				return InteractionResult.FAIL;
			}
		}
		MachineEntity top = ModRegistry.type("tower_crane").create(level, EntitySpawnReason.SPAWN_ITEM_USE);
		if (top == null) return InteractionResult.FAIL;
		for (int y = 0; y < height; y++) level.setBlockAndUpdate(base.above(y), ModRegistry.CRANE_MAST.defaultBlockState());
		float yaw = player != null ? player.getYRot() : 0;
		top.snapTo(base.getX() + 0.5, base.getY() + height, base.getZ() + 0.5, yaw, 0);
		top.setYBodyRot(yaw);
		top.setYHeadRot(yaw);
		level.addFreshEntity(top);
		level.playSound(null, base, SoundEvents.ANVIL_USE, top.getSoundSource(), 0.8F, 0.8F);
		ctx.getItemInHand().consume(1, player);
		return InteractionResult.SUCCESS_SERVER;
	}
}
