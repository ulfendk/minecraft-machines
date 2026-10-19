package dk.ulfen.machines.machine;

import dk.ulfen.machines.ModRegistry;
import net.minecraft.core.Direction;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.context.UseOnContext;

/** Places a machine on the clicked block, facing the same way as the player. */
public class MachineItem extends Item {
	private final String id;

	public MachineItem(Item.Properties props, String id) {
		super(props);
		this.id = id;
	}

	@Override
	public InteractionResult useOn(UseOnContext ctx) {
		if (ctx.getClickedFace() == Direction.DOWN) return InteractionResult.FAIL;
		if (!(ctx.getLevel() instanceof ServerLevel level)) return InteractionResult.SUCCESS;
		var pos = ctx.getClickedPos().relative(ctx.getClickedFace());
		MachineEntity m = ModRegistry.type(id).create(level, EntitySpawnReason.SPAWN_ITEM_USE);
		if (m == null) return InteractionResult.FAIL;
		float yaw = ctx.getPlayer() != null ? ctx.getPlayer().getYRot() : ctx.getRotation();
		m.snapTo(pos.getX() + 0.5, pos.getY(), pos.getZ() + 0.5, yaw, 0);
		m.setYBodyRot(yaw);
		m.setYHeadRot(yaw);
		if (!level.noCollision(m, m.getBoundingBox())) {
			if (ctx.getPlayer() != null) ctx.getPlayer().sendOverlayMessage(net.minecraft.network.chat.Component.translatable("machines.no_room"));
			return InteractionResult.FAIL;
		}
		level.addFreshEntity(m);
		level.playSound(null, pos, SoundEvents.IRON_GOLEM_REPAIR, m.getSoundSource(), 0.8F, 1.0F);
		ctx.getItemInHand().consume(1, ctx.getPlayer());
		return InteractionResult.SUCCESS_SERVER;
	}
}
