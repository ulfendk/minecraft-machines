package dk.ulfen.machines.machine;

import net.minecraft.core.BlockPos;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.BlockHitResult;

/** A lattice mast section. Right-click it to ride up into the tower crane on top. */
public class MastBlock extends Block {
	public MastBlock(Properties props) {
		super(props);
	}

	@Override
	protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos, Player player, BlockHitResult hit) {
		BlockPos top = pos;
		while (TerrainOps.isMast(level.getBlockState(top.above())) && top.getY() < level.getMaxY()) top = top.above();
		var cranes = level.getEntitiesOfClass(MachineEntity.class, new AABB(top.above()).inflate(0.5, 1, 0.5), m -> !m.spec.drives());
		if (cranes.isEmpty()) return InteractionResult.PASS;
		if (!level.isClientSide()) player.startRiding(cranes.getFirst());
		return InteractionResult.SUCCESS;
	}
}
